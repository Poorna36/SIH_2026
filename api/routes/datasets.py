"""
backend/api/routes/datasets.py
-------------------------------
Serves the pair manifest from data/pairs/manifest.jsonl and provides
scene metadata compatible with the frontend ScenePreset interface.
"""
from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
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
