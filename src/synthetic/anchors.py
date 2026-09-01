"""
src/synthetic/anchors.py — GT Anchor Extraction Engine

Extracts natural high-gradient floating-point anchor points from a source image
to serve as hidden Ground Truth reference points for the Synthetic Benchmark.

Two extraction phases (per SYNTHETIC_BENCHMARK_ARCHITECTURE.md §4.1):
  Phase 1 (baseline): Shi-Tomasi corner detection across uniform grid cells.
  Phase 2+ (stratified): Morphological feature class quotas — craters, ridges,
    maria, shadow boundaries, highlands, polar terrain.

Coordinate convention: all pixel coordinates are (col, row) = (x, y), 0-indexed.
The returned AnchorSet is HIDDEN from the matching pipeline; it is only loaded
by the evaluation engine (src/evaluation/synthetic_eval.py).
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import cv2
import numpy as np

logger = logging.getLogger(__name__)


@dataclass
class AnchorPoint:
    """A single GT anchor point (in source image space, float precision)."""
    id: int
    src_x: float   # col (x), 0-indexed, sub-pixel float
    src_y: float   # row (y), 0-indexed, sub-pixel float
    feature_class: str   # "shi_tomasi" | "crater" | "ridge" | "maria" | "shadow_boundary" | "polar"
    gradient_magnitude: float  # Sobel gradient magnitude at this point


@dataclass
class AnchorSet:
    """Collection of GT anchors extracted from a source image."""
    pair_id: str
    image_shape: Tuple[int, int]   # (height_px, width_px)
    anchors: List[AnchorPoint] = field(default_factory=list)
    extraction_phase: int = 1
    n_grid_cells: Tuple[int, int] = (8, 8)

    def to_dict(self) -> dict:
        """Serialize to JSON-compatible dict."""
        d = asdict(self)
        d["image_shape"] = list(self.image_shape)
        d["n_grid_cells"] = list(self.n_grid_cells)
        return d

    def save(self, path: Path) -> None:
        """Save anchor set to JSON (hidden GT file)."""
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w") as f:
            json.dump(self.to_dict(), f, indent=2)
        logger.info("Saved %d anchors to %s", len(self.anchors), path)

    @classmethod
    def load(cls, path: Path) -> "AnchorSet":
        """Load anchor set from JSON."""
        with open(path) as f:
            d = json.load(f)
        anchors = [AnchorPoint(**a) for a in d.pop("anchors")]
        d["image_shape"] = tuple(d["image_shape"])
        d["n_grid_cells"] = tuple(d["n_grid_cells"])
        return cls(**d, anchors=anchors)

    def as_numpy(self) -> np.ndarray:
        """Return anchor source coordinates as (N, 2) float64 array (col, row)."""
        if not self.anchors:
            return np.empty((0, 2), dtype=np.float64)
        return np.array([[a.src_x, a.src_y] for a in self.anchors], dtype=np.float64)


def _build_gradient_map(image: np.ndarray) -> np.ndarray:
    """Compute Sobel gradient magnitude map (float32)."""
    img_f32 = image.astype(np.float32)
    gx = cv2.Sobel(img_f32, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(img_f32, cv2.CV_32F, 0, 1, ksize=3)
    return np.sqrt(gx ** 2 + gy ** 2)


def _extract_shi_tomasi_grid(
    image: np.ndarray,
    grid_cells: Tuple[int, int],
    max_corners_per_cell: int,
    quality_level: float,
    min_distance_px: float,
    block_size: int,
    gradient_map: Optional[np.ndarray] = None,
) -> List[AnchorPoint]:
    """Phase 1: Shi-Tomasi detection across a uniform NxM grid.

    Each grid cell is processed independently to ensure spatial spread.
    Returns anchor points sorted by descending gradient magnitude.

    Args:
        image: Source image array, float32 or uint8, single-channel.
        grid_cells: (rows, cols) number of grid cells.
        max_corners_per_cell: Maximum features to retain per cell.
        quality_level: Shi-Tomasi quality threshold.
        min_distance_px: Minimum Euclidean distance between keypoints.
        block_size: Neighbourhood for corner measure computation.
        gradient_map: Pre-computed Sobel map (optional, computed if None).

    Returns:
        List of AnchorPoint objects (unsorted, anchor IDs not set yet).
    """
    if gradient_map is None:
        gradient_map = _build_gradient_map(image)

    img_u8 = (image / image.max() * 255).astype(np.uint8) if image.dtype != np.uint8 else image
    h, w = image.shape[:2]
    n_rows, n_cols = grid_cells
    cell_h = h // n_rows
    cell_w = w // n_cols

    all_anchors: List[AnchorPoint] = []
    for r in range(n_rows):
        for c in range(n_cols):
            y0, x0 = r * cell_h, c * cell_w
            y1, x1 = min(y0 + cell_h, h), min(x0 + cell_w, w)
            cell = img_u8[y0:y1, x0:x1]
            if cell.size == 0:
                continue
            corners = cv2.goodFeaturesToTrack(
                cell,
                maxCorners=max_corners_per_cell,
                qualityLevel=quality_level,
                minDistance=min_distance_px,
                blockSize=block_size,
            )
            if corners is None:
                continue
            for pt in corners.reshape(-1, 2):
                # Convert from cell-local to image global coordinates
                global_x = float(pt[0]) + x0
                global_y = float(pt[1]) + y0
                # Clip to valid image domain
                global_x = float(np.clip(global_x, 0, w - 1))
                global_y = float(np.clip(global_y, 0, h - 1))
                grad = float(gradient_map[int(global_y), int(global_x)])
                all_anchors.append(AnchorPoint(
                    id=-1,          # assigned later
                    src_x=global_x,
                    src_y=global_y,
                    feature_class="shi_tomasi",
                    gradient_magnitude=grad,
                ))

    return all_anchors


def _deduplicate_anchors(
    anchors: List[AnchorPoint],
    min_spacing_px: float,
) -> List[AnchorPoint]:
    """Remove anchors closer than min_spacing_px using greedy distance pruning."""
    if not anchors:
        return anchors
    # Sort by gradient magnitude descending — keep highest quality per cluster
    anchors = sorted(anchors, key=lambda a: a.gradient_magnitude, reverse=True)
    pts = np.array([[a.src_x, a.src_y] for a in anchors], dtype=np.float64)
    keep = np.ones(len(pts), dtype=bool)
    for i in range(len(pts)):
        if not keep[i]:
            continue
        for j in range(i + 1, len(pts)):
            if keep[j]:
                dist = np.linalg.norm(pts[i] - pts[j])
                if dist < min_spacing_px:
                    keep[j] = False
    return [a for a, k in zip(anchors, keep) if k]


def extract_anchors(
    image: np.ndarray,
    pair_id: str,
    config: dict,
    rng: Optional[np.random.Generator] = None,
) -> AnchorSet:
    """Extract GT anchor points from a source image.

    Phase 1 (config.anchors.phase == 1): Shi-Tomasi grid extraction.
    Phase 2+ (config.anchors.phase >= 2): TODO — morphological stratification
        with separate detection per feature class bucket (craters, ridges,
        maria, shadow_boundaries, polar_terrain, high_gradient_terrain).

    Args:
        image: Source image array, single-channel, float32 or uint8.
        pair_id: Pair identifier string (used for anchor set metadata).
        config: Benchmark configuration dict (from synthetic_benchmark.yaml).
        rng: Optional NumPy random generator for reproducibility.

    Returns:
        AnchorSet with up to config.anchors.target_count anchors.

    Raises:
        RuntimeError: If fewer than config.anchors.min_count anchors are found.
    """
    assert image.ndim == 2, "extract_anchors expects a single-channel 2D image."
    assert image.size > 0, "Image must be non-empty."

    cfg_a = config.get("anchors", {})
    target_count: int = cfg_a.get("target_count", 80)
    min_count: int = cfg_a.get("min_count", 60)
    max_count: int = cfg_a.get("max_count", 100)
    grid_cells_cfg = cfg_a.get("grid_cells", [8, 8])
    grid_cells = tuple(grid_cells_cfg)  # (n_rows, n_cols)
    phase: int = cfg_a.get("phase", 1)
    st_cfg = cfg_a.get("shi_tomasi", {})

    gradient_map = _build_gradient_map(image)

    anchors: List[AnchorPoint] = []

    if phase >= 1:
        # Phase 1: Shi-Tomasi grid extraction
        anchors = _extract_shi_tomasi_grid(
            image=image,
            grid_cells=grid_cells,
            max_corners_per_cell=st_cfg.get("max_corners_per_cell", 20),
            quality_level=st_cfg.get("quality_level", 0.01),
            min_distance_px=st_cfg.get("min_distance_px", 15),
            block_size=st_cfg.get("block_size", 7),
            gradient_map=gradient_map,
        )

    if phase >= 2:
        # Phase 2+: Morphological stratification (scaffold — full implementation
        # requires individual detector per feature class bucket).
        # buckets = cfg_a.get("stratification_buckets", {})
        # anchors += _extract_craters(image, quota=buckets.get("craters", 0.20) * target_count)
        # anchors += _extract_ridges(image, quota=...)
        # ... etc.
        logger.warning(
            "Morphological stratification (phase >= 2) is not yet implemented. "
            "Using Phase 1 Shi-Tomasi extraction only. "
            "See docs/SYNTHETIC_BENCHMARK_ARCHITECTURE.md §4.1."
        )

    # De-duplicate and trim
    min_spacing = st_cfg.get("min_distance_px", 15)
    anchors = _deduplicate_anchors(anchors, min_spacing_px=min_spacing)

    if len(anchors) > max_count:
        anchors = anchors[:max_count]

    if len(anchors) < min_count:
        raise RuntimeError(
            f"extract_anchors: Only found {len(anchors)} anchors for pair '{pair_id}' "
            f"(minimum required: {min_count}). "
            "Check image quality and Shi-Tomasi quality_level parameter."
        )

    # Assign sequential IDs
    for i, a in enumerate(anchors):
        a.id = i + 1

    logger.info(
        "Extracted %d anchors for pair '%s' (phase=%d, grid=%s).",
        len(anchors), pair_id, phase, grid_cells,
    )

    return AnchorSet(
        pair_id=pair_id,
        image_shape=image.shape[:2],
        anchors=anchors,
        extraction_phase=phase,
        n_grid_cells=grid_cells,
    )
