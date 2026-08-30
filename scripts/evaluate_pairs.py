"""
scripts/evaluate_pairs.py
=========================
F22 — Ground Truth Evaluation Bridge (ARCHITECTURE.md L7, VALIDATION.md §4).

Evaluates geometric models and correspondence match results against
manual or synthetic Ground Truth (GT) checkpoints (INTERFACES.md §7).

Rules (per VALIDATION.md §4 & INTERFACES.md §4, §7):
  1. RMSE is computed STRICTLY on GT checkpoints with partition="eval".
  2. "fit" checkpoints are for model consistency validation and MUST NOT affect reported RMSE.
  3. "qc" checkpoints are for computing gt_interannotator_rmse_px.
  4. Coordinate convention: (col, row) = (x, y), 0-indexed float. NEVER (row, col).
  5. Outputs EvaluationRecord JSONs to results/pair_results/<pair_id>__<matcher>.json.

Usage:
  python scripts/evaluate_pairs.py \\
      --manifest data/pairs/manifest.jsonl \\
      --results results/ \\
      --gt data/metadata/gt/ \\
      --out-dir results/pair_results/
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

from src.evaluation.metrics import (
    compute_all_metrics,
    gt_interannotator_rmse,
    precision_recall_matching_score,
    refinement_gain,
    rmse,
)
from src.provenance import hash_config, get_code_commit

logging.basicConfig(
    format="[%(asctime)s %(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
    level=logging.INFO,
)
logger = logging.getLogger("evaluate_pairs")


# ── Transform Projection Helpers ─────────────────────────────────────────────

def project_coordinates(
    src_xy: np.ndarray,
    model_matrix: np.ndarray,
    model_type: str = "homography",
) -> np.ndarray:
    """
    Project (col, row) coordinates from source to reference image using model matrix.

    Parameters:
      src_xy: (N, 2) float array (col, row)
      model_matrix: (3, 3) or (2, 3) float array
      model_type: "similarity" | "affine" | "homography"

    Returns:
      predicted_ref_xy: (N, 2) float array (col, row)
    """
    assert src_xy.ndim == 2 and src_xy.shape[-1] == 2, "Expected (N,2) array: (col, row)"
    M = np.asarray(model_matrix, dtype=np.float64)
    n = len(src_xy)
    if n == 0:
        return np.zeros((0, 2), dtype=np.float64)

    pts_h = np.hstack([src_xy.astype(np.float64), np.ones((n, 1), dtype=np.float64)])  # (N, 3)

    if model_type == "homography" or M.shape == (3, 3):
        proj = (M @ pts_h.T).T  # (N, 3)
        denom = np.maximum(np.abs(proj[:, 2:3]), 1e-12) * np.sign(proj[:, 2:3] + 1e-15)
        pred_xy = proj[:, :2] / denom
    elif model_type in ("affine", "similarity") and M.shape == (2, 3):
        pred_xy = (M @ pts_h.T).T  # (N, 2)
    elif M.shape == (3, 2):
        pred_xy = pts_h @ M  # (N, 2)
    else:
        # Fallback linear projection
        pred_xy = (M[:2, :2] @ src_xy.T).T + (M[:2, 2] if M.shape[1] > 2 else 0.0)

    assert pred_xy.shape[-1] == 2, "Expected (N,2) array: (col, row)"
    return pred_xy.astype(np.float64)


# ── Stratum Binning Helpers ──────────────────────────────────────────────────

def derive_stratum(pair_record: Dict[str, Any]) -> Dict[str, str]:
    """Derive standard stratification tags from PairRecord metadata."""
    src = pair_record.get("src", {})
    ref = pair_record.get("ref", {})
    src_sensor = src.get("sensor", "OHRC")
    ref_type = ref.get("type", "NAC")

    sensor_pair = f"{src_sensor}-{ref_type}"
    terrain = pair_record.get("terrain_class", "unknown")

    lat = pair_record.get("latitude_center_deg")
    if lat is None:
        lat = src.get("latitude_center_deg")

    if lat is None:
        lat_bin = "unknown"
    elif abs(lat) > 55.0:
        lat_bin = "polar"
    elif abs(lat) > 30.0:
        lat_bin = "mid_latitude"
    else:
        lat_bin = "equatorial"

    daz = pair_record.get("delta_azimuth_deg")
    if daz is None:
        daz_bin = "unknown"
    elif daz < 30.0:
        daz_bin = "lt30"
    elif daz < 90.0:
        daz_bin = "30_90"
    else:
        daz_bin = "gt90"

    density = pair_record.get("crater_density_per_km2")
    if density is None:
        den_bin = "unknown"
    elif density < 1.0:
        den_bin = "low"
    elif density < 5.0:
        den_bin = "medium"
    else:
        den_bin = "high"

    return {
        "sensor_pair": sensor_pair,
        "terrain_class": terrain,
        "latitude_bin": lat_bin,
        "delta_az_bin": daz_bin,
        "crater_density_bin": den_bin,
        "ref_type": ref_type,
    }


# ── Evaluation of Single Pair ────────────────────────────────────────────────

def evaluate_pair(
    pair_record: Dict[str, Any],
    gt_data: Dict[str, Any],
    geometry_or_model: Dict[str, Any],
    matcher: str = "lightglue",
    matches_data: Optional[Dict[str, Any]] = None,
    image_shape: Optional[Tuple[int, int]] = None,
    is_arbitration_winner: bool = True,
) -> Dict[str, Any]:
    """
    Evaluate a pair's recovered registration against Ground Truth checkpoints.

    Parameters:
      pair_record: PairRecord dictionary from manifest.jsonl
      gt_data: Ground Truth dictionary adhering to INTERFACES.md §7
      geometry_or_model: GeometryRecord dict or ModelResult dict containing model_matrix & model_type
      matcher: name of matcher (e.g. "sift", "lightglue", "rift2")
      matches_data: optional MatchRecord dict for spatial coverage / inlier metrics
      image_shape: (H, W) optional
      is_arbitration_winner: whether this matcher won arbitration

    Returns:
      EvaluationRecord dictionary per INTERFACES.md §4
    """
    pair_id = pair_record.get("pair_id", gt_data.get("pair_id", "unknown_pair"))
    split = pair_record.get("split", "test")
    stratum = derive_stratum(pair_record)

    checkpoints = gt_data.get("checkpoints", [])
    eval_pts = [c for c in checkpoints if c.get("partition") == "eval"]
    qc_pts = [c for c in checkpoints if c.get("partition") == "qc"]

    # Extract model matrix
    model_matrix = geometry_or_model.get("model_matrix")
    model_type = geometry_or_model.get("model_type", "homography")
    if model_matrix is None and "H" in geometry_or_model:
        model_matrix = geometry_or_model["H"]

    # Compute inter-annotator RMSE from QC partition if present
    interann_rmse: Optional[float] = None
    if qc_pts:
        # Match QC points to eval points by ID or coordinate
        eval_by_id = {c.get("id"): c for c in eval_pts if c.get("id") is not None}
        orig_coords = []
        qc_coords = []
        for qc in qc_pts:
            qid = qc.get("id")
            if qid in eval_by_id:
                orig = eval_by_id[qid]
                orig_coords.append(orig["ref_xy"])
                qc_coords.append(qc["ref_xy"])

        if orig_coords:
            orig_arr = np.array(orig_coords, dtype=np.float64)
            qc_arr = np.array(qc_coords, dtype=np.float64)
            interann_rmse = gt_interannotator_rmse(orig_arr, qc_arr)
        else:
            # Pair by index if lengths match
            n_min = min(len(eval_pts), len(qc_pts))
            if n_min > 0:
                orig_arr = np.array([c["ref_xy"] for c in eval_pts[:n_min]], dtype=np.float64)
                qc_arr = np.array([c["ref_xy"] for c in qc_pts[:n_min]], dtype=np.float64)
                interann_rmse = gt_interannotator_rmse(orig_arr, qc_arr)

    # Compute predicted coordinates on eval checkpoints
    if eval_pts and model_matrix is not None:
        src_eval = np.array([[c["src_xy"][0], c["src_xy"][1]] for c in eval_pts], dtype=np.float64)
        pred_ref_eval = project_coordinates(src_eval, np.array(model_matrix), model_type=model_type)

        # Match coordinates for coverage & inliers from matches_data if available
        match_xy_cov = None
        inlier_count = int(geometry_or_model.get("inlier_count", 0))
        inlier_ratio = float(geometry_or_model.get("inlier_ratio", 0.0))
        runtime_s = float(geometry_or_model.get("runtime_s", matches_data.get("stats", {}).get("runtime_s", 0.0) if matches_data else 0.0))

        if matches_data:
            matches_list = matches_data.get("matches", [])
            if matches_list:
                match_xy_cov = np.array([m["src_xy"] for m in matches_list], dtype=np.float64)

        metrics = compute_all_metrics(
            predicted_ref_xy=pred_ref_eval,
            gt_checkpoints=checkpoints,
            rmse_coarse_px=geometry_or_model.get("rmse_before_refine_px"),
            match_xy_for_coverage=match_xy_cov,
            image_shape=image_shape,
            runtime_s=runtime_s,
            inlier_count=inlier_count,
            inlier_ratio=inlier_ratio,
        )
    else:
        # Fallback if no evaluation checkpoints or failed geometry
        metrics = {
            "rmse_px": None,
            "rmse_before_refine_px": None,
            "pct_lt_1px": 0.0,
            "pct_lt_0p5px": 0.0,
            "medae_px": None,
            "inlier_count": int(geometry_or_model.get("inlier_count", 0)),
            "inlier_ratio": float(geometry_or_model.get("inlier_ratio", 0.0)),
            "spatial_coverage": 0.0,
            "grid_density_std": 0.0,
            "refinement_gain_px": None,
            "runtime_s": float(geometry_or_model.get("runtime_s", 0.0)),
            "precision": None,
            "recall": None,
            "matching_score": None,
        }

    eval_record: Dict[str, Any] = {
        "pair_id": pair_id,
        "matcher": matcher,
        "split": split,
        "stratum": stratum,
        "metrics": metrics,
        "gt_checkpoint_count": len(eval_pts),
        "gt_interannotator_rmse_px": round(interann_rmse, 4) if interann_rmse is not None else None,
        "arbitration_winner": bool(is_arbitration_winner),
        "created_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }

    return eval_record


# ── Batch Evaluation CLI Execution ───────────────────────────────────────────

def evaluate_all(
    manifest_path: Path,
    results_dir: Path,
    gt_dir: Path,
    out_dir: Path,
    split_filter: Optional[str] = "test",
) -> List[Dict[str, Any]]:
    """
    Run GT evaluation over all pairs in manifest.jsonl and write pair_results.
    """
    out_dir.mkdir(parents=True, exist_ok=True)

    # Load manifest
    manifest_records = []
    with open(manifest_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                manifest_records.append(json.loads(line))

    logger.info("Loaded %d manifest records from %s", len(manifest_records), manifest_path)

    evaluated_records = []

    for pair in manifest_records:
        pair_id = pair.get("pair_id")
        split = pair.get("split", "train")

        if split_filter and split != split_filter:
            continue

        # Look up GT file
        gt_path = pair.get("gt_path")
        if gt_path:
            p_gt = Path(gt_path)
            if not p_gt.is_absolute():
                p_gt = manifest_path.parent.parent / gt_path
        else:
            p_gt = gt_dir / f"{pair_id}_gt.json"

        if not p_gt.exists():
            logger.debug("No GT file for %s at %s, skipping GT evaluation", pair_id, p_gt)
            continue

        with open(p_gt, "r", encoding="utf-8") as f:
            gt_data = json.load(f)

        # Look for geometry records in results/
        geo_files = list(results_dir.glob(f"**/{pair_id}*geometry*.json")) + \
                    list(results_dir.glob(f"**/{pair_id}*result*.json"))

        if not geo_files:
            logger.warning("No geometry output found for %s in %s", pair_id, results_dir)
            continue

        for g_file in geo_files:
            try:
                with open(g_file, "r", encoding="utf-8") as gf:
                    geo_data = json.load(gf)

                matcher = geo_data.get("matcher", "primary")
                if "sensor_pair" in geo_data and geo_data.get("sensor_pair") == "IIRS-WAC":
                    matcher = "iirs"

                eval_rec = evaluate_pair(
                    pair_record=pair,
                    gt_data=gt_data,
                    geometry_or_model=geo_data.get("geometry", geo_data),
                    matcher=matcher,
                    is_arbitration_winner=True,
                )

                out_file = out_dir / f"{pair_id}__{matcher}.json"
                with open(out_file, "w", encoding="utf-8") as out_f:
                    json.dump(eval_rec, out_f, indent=2)

                evaluated_records.append(eval_rec)
                logger.info("Evaluated %s (%s) → RMSE = %s px", pair_id, matcher, eval_rec["metrics"].get("rmse_px"))

            except Exception as exc:
                logger.error("Failed to evaluate %s from %s: %s", pair_id, g_file, exc)

    logger.info("Finished evaluation: wrote %d EvaluationRecord JSONs to %s", len(evaluated_records), out_dir)
    return evaluated_records


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Evaluate pair registrations against Ground Truth")
    parser.add_argument("--manifest", required=True, help="Path to manifest.jsonl")
    parser.add_argument("--results", required=True, help="Path to results/ directory")
    parser.add_argument("--gt", required=True, help="Path to GT directory (data/metadata/gt/)")
    parser.add_argument("--out-dir", default="results/pair_results/", help="Path to output pair_results directory")
    parser.add_argument("--split", default="test", choices=["train", "test", "all"], help="Filter to split")

    args = parser.parse_args()
    split_f = None if args.split == "all" else args.split
    evaluate_all(
        manifest_path=Path(args.manifest),
        results_dir=Path(args.results),
        gt_dir=Path(args.gt),
        out_dir=Path(args.out_dir),
        split_filter=split_f,
    )
