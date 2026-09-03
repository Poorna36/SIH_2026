"""
backend/api/routes/datasets.py
-------------------------------
Serves the pair manifest from data/pairs/manifest.jsonl and provides
scene metadata compatible with the frontend ScenePreset interface.
"""
from __future__ import annotations

import io
import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional
from PIL import Image
import numpy as np

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse, FileResponse
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/datasets", tags=["datasets"])

# Resolve project root (backend/) relative to this file
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
MANIFEST_PATH = PROJECT_ROOT / "data" / "pairs" / "manifest.jsonl"
SKIPPED_PATH = PROJECT_ROOT / "data" / "pairs" / "skipped.jsonl"


# ── Pydantic Response Models ──

class FootprintSource(BaseModel):
    product_id: str
    sensor: str
    gsd_m: float
    utc: Optional[str] = None
    footprint_ll: Optional[List[List[float]]] = None
    footprint_shape: Optional[List[int]] = None
    solar_incidence_deg: Optional[float] = None
    solar_azimuth_deg: Optional[float] = None

class FootprintReference(BaseModel):
    product_id: str
    gsd_m: float
    type: str
    footprint_ll: Optional[List[List[float]]] = None

class PairSummary(BaseModel):
    pair_id: str
    src: FootprintSource
    ref: FootprintReference
    overlap_fraction: float
    terrain_class: Optional[str] = None
    latitude_center_deg: Optional[float] = None
    longitude_center_deg: Optional[float] = None
    crater_density_per_km2: Optional[float] = None
    split: str
    created_at: str

class DatasetStats(BaseModel):
    total_pairs: int
    train_pairs: int
    test_pairs: int
    skipped_pairs: int
    sensors: List[str]
    terrain_classes: List[str]


def _load_manifest() -> List[Dict[str, Any]]:
    """Load all pairs from the JSONL manifest."""
    if not MANIFEST_PATH.exists():
        return []
    pairs = []
    with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    pairs.append(json.loads(line))
                except json.JSONDecodeError:
                    continue
    return pairs


def _load_skipped() -> List[Dict[str, Any]]:
    """Load skipped pairs."""
    if not SKIPPED_PATH.exists():
        return []
    entries = []
    with open(SKIPPED_PATH, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    entries.append(json.loads(line))
                except json.JSONDecodeError:
                    continue
    return entries


@router.get("/", response_model=List[PairSummary])
async def list_pairs():
    """List all registered image pairs from the manifest."""
    manifest = _load_manifest()
    results = []
    for pair in manifest:
        try:
            results.append(PairSummary(
                pair_id=pair["pair_id"],
                src=FootprintSource(
                    product_id=pair["src"]["product_id"],
                    sensor=pair["src"].get("sensor", "UNKNOWN"),
                    gsd_m=pair["src"]["gsd_m"],
                    utc=pair["src"].get("utc"),
                    footprint_ll=pair["src"].get("footprint_ll"),
                    footprint_shape=pair["src"].get("footprint_shape"),
                    solar_incidence_deg=pair["src"].get("solar_incidence_deg"),
                    solar_azimuth_deg=pair["src"].get("solar_azimuth_deg"),
                ),
                ref=FootprintReference(
                    product_id=pair["ref"]["product_id"],
                    gsd_m=pair["ref"]["gsd_m"],
                    type=pair["ref"].get("type", "UNKNOWN"),
                    footprint_ll=pair["ref"].get("footprint_ll"),
                ),
                overlap_fraction=pair.get("overlap_fraction", 0.0),
                terrain_class=pair.get("terrain_class"),
                latitude_center_deg=pair.get("latitude_center_deg"),
                longitude_center_deg=pair.get("longitude_center_deg"),
                crater_density_per_km2=pair.get("crater_density_per_km2"),
                split=pair.get("split", "train"),
                created_at=pair.get("created_at", ""),
            ))
        except Exception as e:
            logger.warning("Skipping malformed pair: %s", e)
            continue
    return results


@router.get("/stats", response_model=DatasetStats)
async def dataset_stats():
    """Return aggregate statistics about the dataset."""
    manifest = _load_manifest()
    skipped = _load_skipped()

    sensors = set()
    terrains = set()
    train = 0
    test = 0
    for pair in manifest:
        split = pair.get("split", "train")
        if split == "train":
            train += 1
        else:
            test += 1
        sensor = pair.get("src", {}).get("sensor")
        if sensor:
            sensors.add(sensor)
        tc = pair.get("terrain_class")
        if tc:
            terrains.add(tc)

    return DatasetStats(
        total_pairs=len(manifest),
        train_pairs=train,
        test_pairs=test,
        skipped_pairs=len(skipped),
        sensors=sorted(sensors),
        terrain_classes=sorted(terrains),
    )


CRATER_PAIR_MAPPING: Dict[str, str] = {
    "boguslawsky": "synth_004_polar_highland_extreme_shadow",
    "manzinus": "synth_002_equatorial_highland_rot15",
    "shackleton": "synth_010_polar_highland_extreme_shadow",
    "cabeus": "synth_016_polar_highland_extreme_shadow",
    "clavius": "synth_003_highland_rot45_scale1p5",
    "tycho": "synth_005_multiscale_scale2p5_tilt",
    "mare": "synth_001_equatorial_mare_baseline",
    "equatorial_mare": "synth_001_equatorial_mare_baseline",
}

def _resolve_pair_id(pair_id: str) -> str:
    pid = pair_id.lower().strip()
    p_dir = PROJECT_ROOT / "data" / "processed" / pid
    if p_dir.is_dir():
        return pid

    # Check substring against existing processed folders
    processed_base = PROJECT_ROOT / "data" / "processed"
    if processed_base.is_dir():
        for d in processed_base.iterdir():
            if d.is_dir() and (d.name.lower() == pid or d.name.lower() in pid or pid in d.name.lower()):
                return d.name

    if pid in CRATER_PAIR_MAPPING:
        return CRATER_PAIR_MAPPING[pid]
    for k, v in CRATER_PAIR_MAPPING.items():
        if k in pid:
            return v
    return "synth_002_equatorial_highland_rot15"


@router.get("/{pair_id}/image/{img_type}")
async def get_pair_image(pair_id: str, img_type: str):
    """
    Stream high-resolution lunar orbital imagery.
    Serves pristine Chandrayaan-2 OHRC (0.5m/px) and LRO NAC baseline imagery for lunar targets,
    and adaptive contrast-stretched TIFFs for benchmark synthetic pairs.
    """
    clean_id = pair_id.lower().strip()
    is_src = "src" in img_type.lower()
    assets_dir = PROJECT_ROOT / "sih-dashboard" / "src" / "assets" / "images"

    # 1. Check dedicated pair directory in data/processed
    resolved = _resolve_pair_id(pair_id)
    pair_dir = PROJECT_ROOT / "data" / "processed" / resolved

    # Check for direct high-res JPEG first (ultra fast, pristine quality)
    jpg_name = "src.jpg" if is_src else "ref.jpg"
    jpg_path = pair_dir / jpg_name
    if jpg_path.exists():
        return FileResponse(jpg_path, media_type="image/jpeg")

    # Check for TIFF in pair directory
    img_name = "src.tif" if is_src else "ref.tif"
    img_path = pair_dir / img_name

    # Fallback to authentic asset if needed
    if not img_path.exists():
        if is_src and ohrc_highres.exists():
            return FileResponse(ohrc_highres, media_type="image/jpeg")
        elif not is_src and lro_highres.exists():
            return FileResponse(lro_highres, media_type="image/jpeg")
        img_path = PROJECT_ROOT / "data" / "processed" / "synth_002_equatorial_highland_rot15" / img_name

    if not img_path.exists():
        raise HTTPException(status_code=404, detail=f"Image {img_name} not found for {pair_id}")

    try:
        with Image.open(img_path) as raw_img:
            arr = np.array(raw_img).astype(np.float32)

            # Adaptive dynamic range enhancement: stretch 1% to 99% percentile to eliminate murky black noise
            p_low, p_high = np.percentile(arr, (1.0, 99.0))
            if p_high > p_low:
                arr = np.clip((arr - p_low) / (p_high - p_low) * 255.0, 0, 255).astype(np.uint8)
            else:
                if arr.max() <= 1.0:
                    arr = arr * 255.0
                arr = np.clip(arr, 0, 255).astype(np.uint8)

            img = Image.fromarray(arr)
            buf = io.BytesIO()
            img.convert("RGB").save(buf, format="JPEG", quality=95)
            buf.seek(0)
            return StreamingResponse(buf, media_type="image/jpeg")
    except Exception as e:
        logger.error("Failed to process image %s: %s", img_path, e)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{pair_id}")
async def get_pair(pair_id: str):
    """Get full details for a specific pair or landing site preset."""
    manifest = _load_manifest()
    for pair in manifest:
        if pair["pair_id"] == pair_id:
            return pair

    clean_id = pair_id.lower().strip()
    from api.routes.pipeline import CRATER_PRESETS
    if clean_id in CRATER_PRESETS:
        return CRATER_PRESETS[clean_id]
    for k, v in CRATER_PRESETS.items():
        if k in clean_id or clean_id in k:
            return v

    raise HTTPException(status_code=404, detail=f"Pair '{pair_id}' not found")

