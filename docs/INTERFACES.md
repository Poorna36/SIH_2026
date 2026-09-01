# SIH26166 — INTERFACES v2.0

Data contracts between all pipeline stages. Every artifact must conform to these schemas.

**Coordinate convention:** All pixel coordinates are (col, row) = (x, y), 0-indexed, top-left origin. NEVER (row, col). Verify in every module that touches coordinates.

---

## 1. PairRecord (manifest.jsonl, one JSON per line)

```json
{
  "pair_id":         "ohr_20200827T003010__nac_M123456789",
  "src": {
    "product_id":    "ch2_ohr_nrp_20200827T0030107497_d_img_d18",
    "cub_path":      "data/calibrated/ch2_ohr_nrp_20200827T0030107497_d_img_d18.cub",
    "gsd_m":         0.31,
    "solar_incidence_deg": 42.3,
    "solar_azimuth_deg":   178.5,
    "sensor":        "OHRC",
    "utc":           "2020-08-27T00:30:10.749Z",
    "footprint_ll":  [[lon0,lat0],[lon1,lat1],[lon2,lat2],[lon3,lat3]],
    "footprint_shape": [2048, 512]
  },
  "ref": {
    "product_id":    "M123456789",
    "path":          "data/reference/M123456789_crop.tif",
    "gsd_m":         0.50,
    "type":          "NAC",
    "footprint_ll":  [[lon0,lat0],[lon1,lat1],[lon2,lat2],[lon3,lat3]]
  },
  "overlap_fraction": 0.83,
  "partial_overlap":  false,
  "delta_azimuth_deg": 5.2,
  "latitude_center_deg": -85.2,
  "terrain_class":   "polar_highland",
  "crater_density_per_km2": 4.7,
  "geo_cell":        "-90_0",
  "split":           "test",
  "gt_path":         "data/metadata/gt/ohr_20200827T003010__nac_M123456789_gt.json",
  "created_at":      "2026-08-27T12:00:00Z"
}
```

Required fields: pair_id, src.product_id, src.cub_path, src.gsd_m, src.solar_incidence_deg, src.solar_azimuth_deg, src.sensor, src.utc, ref.path, ref.type, overlap_fraction, terrain_class, geo_cell, split.

ref.type allowed values: `NAC` | `WAC` | `SELENE` — SELENE pairs form a separate evaluation stratum and are never merged with NAC/WAC rows in leaderboard aggregation.

Optional but expected: crater_density_per_km2 (UNIT: craters/km²; a unitless value is a configuration error), delta_azimuth_deg, latitude_center_deg, gt_path.

---

## 2. MatchRecord (matches_raw.json, matches_selected.json, matches_refined.json)

```json
{
  "pair_id":    "ohr_20200827T003010__nac_M123456789",
  "matcher":    "lightglue",
  "stage":      "raw | selected | refined",
  "matches": [
    {
      "id":           0,
      "src_xy":       [col_float, row_float],
      "ref_xy":       [col_float, row_float],
      "confidence":   0.97,
      "scale":        1.02,
      "angle_deg":    3.1,
      "gate_skip":    false,
      "detector_validated": true,
      "refined_delta": [dx, dy],
      "refine_sharpness": 0.84,
      "second_peak_ratio": 0.31,
      "refine_success":   true,
      "is_inlier":    true,
      "tile_id":      "3_5"
    }
  ],
  "stats": {
    "candidate_count": 1240,
    "selected_count":  200,
    "inlier_count":    157,
    "inlier_ratio":    0.785,
    "coverage":        0.72,
    "grid_density_std": 2.3,
    "runtime_s":       4.8
  },
  "matcher_params_hash": "abc123",
  "config_hash":         "def456",
  "code_commit":         "g7h8i9j",
  "created_at":          "2026-08-27T12:05:00Z"
}
```

Notes:
- src_xy and ref_xy are always (col, row) floats
- matches_raw.json has stage=raw; is_inlier absent; refined_delta absent
- matches_selected.json has stage=selected; is_inlier absent; refined_delta absent
- matches_refined.json has all fields including second_peak_ratio
- gate_skip: true means M3 density/terrain gate failed; no match data present for this matcher on this pair
- detector_validated: false means M3 YOLOv9 pre-flight recall check has not yet passed for this sensor; treat result as UNVALIDATED_PRIMARY
- Do not include training data in test results. Check split before aggregating.

---

## 3. GeometryRecord (geometry.json)

```json
{
  "pair_id":     "ohr_20200827T003010__nac_M123456789",
  "matcher":     "lightglue",
  "model_type":  "homography",
  "model_dof":   8,
  "ladder_level": 2,
  "tilewise":    false,
  "model_matrix": [[...], [...], [...]],
  "inlier_indices": [0, 2, 4, ...],
  "inlier_count": 157,
  "inlier_ratio": 0.785,
  "rmse_px":     0.71,
  "t_gsd_used":  1.5,
  "ransac_method": "degensac",
  "ransac_iter": 10000,
  "ransac_conf": 0.99999,
  "desca_applied": false,
  "model_residuals": [0.31, 0.52, ...],
  "gsd_scale_factor": 1.0,
  "latitude_center_deg": -85.2,
  "created_at": "2026-08-27T12:06:00Z"
}

CLARIFICATION — t_gsd_used vs stop_on_rmse_below:
- t_gsd_used is the DEGENSAC reprojection threshold (in pixels) used during geometric estimation.
- Model-ladder acceptance uses the separate fixed constant stop_on_rmse_below (default 1.0 px from CONFIGURATION.md).
- These are two different thresholds with different roles. Do NOT conflate them.
```

For tilewise=true, model_matrix is replaced by "tile_models": [{tile_id, model_type, model_matrix, inlier_count, rmse_px}].

---

## 4. EvaluationRecord (results/pair_results/<pair_id>__<matcher>.json)

```json
{
  "pair_id":     "ohr_20200827T003010__nac_M123456789",
  "matcher":     "lightglue",
  "split":       "test",
  "stratum": {
    "sensor_pair":  "OHRC-NAC",
    "terrain_class": "polar_highland",
    "latitude_bin":  "polar",
    "delta_az_bin":  "lt30",
    "crater_density_bin": "high"
  },
  "metrics": {
    "rmse_px":         0.68,
    "rmse_before_refine_px": 0.91,
    "pct_lt_1px":      0.94,
    "pct_lt_0p5px":    0.71,
    "medae_px":        0.52,
    "inlier_count":    157,
    "inlier_ratio":    0.785,
    "spatial_coverage": 0.72,
    "grid_density_std": 2.3,
    "refinement_gain_px": 0.23,
    "runtime_s":       4.8,
    "precision":       null,
    "recall":          null,
    "matching_score":  null
  },
  "gt_checkpoint_count": 36,
  "arbitration_winner": true,
  "created_at": "2026-08-27T12:10:00Z"
}
```

precision/recall/matching_score: populated only where a labeled GT match set exists (null otherwise).

---

## 5. LeaderboardRecord (results/leaderboard.csv)

Columns: matcher, sensor_pair, split, stratum, n_pairs, rmse_px_mean, rmse_px_median, pct_lt_1px_mean, pct_lt_0p5px_mean, medae_px_mean, inlier_count_mean, inlier_ratio_mean, spatial_coverage_mean, grid_density_std_mean, refinement_gain_mean, runtime_s_mean, n_failures.

Leakage policy: the split column is always reported; polar and high-latitude rows are never hidden.

---

## 6. Metadata (data/processed/<pair_id>/meta.json)

```json
{
  "pair_id": "...",
  "src_original_filename": "ch2_ohr_nrp_20200827T0030107497_d_img_d18.img",
  "src_cub": "data/calibrated/ch2_ohr_nrp_20200827T0030107497_d_img_d18.cub",
  "ref_crop": "data/reference/M123456789_crop.tif",
  "preprocessing": {
    "radiometric_norm": "percentile_clip_stat_transfer",
    "sensor_branch": "clahe_pca",
    "interpolation": "bicubic",
    "tiling": {"grid": [8,4], "overlap_px": 64},
    "gsd_ratio": 1.61
  },
  "valid_mask_fraction": 0.12,
  "solar_incidence_deg": 42.3
}
```

---

## 7. Ground Truth Format (data/metadata/gt/<pair_id>_gt.json)

```json
{
  "pair_id": "...",
  "annotator": "manual_grid_6x6",
  "n_checkpoints": 36,
  "qc_reannotated_pct": 0.20,
  "checkpoints": [
    {
      "id": 0,
      "src_xy": [col_float, row_float],
      "ref_xy": [col_float, row_float],
      "partition": "eval"
    }
  ]
}
```

partition: "eval" (held-out for RMSE), "fit" (used to validate matcher consistency), "qc" (re-annotated for error bound). Evaluation code must ONLY use partition="eval" points for RMSE reporting.

---

## 8. Coordinate Reference Frame

- Pixel coordinates: (col, row) = (x, y), 0-indexed, top-left origin. NEVER (row, col).
- Geographic coordinates: (lon, lat) in decimal degrees, WGS84 / selenographic DE421. NEVER (lat, lon).
- GeoTIFF CRS: PROJCRS from reference image propagated to registered output.
- SPICE/ISIS: coordinate system per spiceinit output; do not manually transform SPICE-derived coordinates.
- Bearing convention for delta_azimuth: positive = clockwise from north, 0-360.

---

## 9. Matcher Interface (src/matching/base.py)

```python
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import List, Optional
import numpy as np

@dataclass
class MatchResult:
    src_xy:     np.ndarray   # shape (N, 2), dtype float32, (col, row)
    ref_xy:     np.ndarray   # shape (N, 2), dtype float32, (col, row)
    confidence: np.ndarray   # shape (N,), float32
    scale:      np.ndarray   # shape (N,), float32
    angle_deg:  np.ndarray   # shape (N,), float32
    runtime_s:  float
    matcher_params: dict

class BaseMatcher(ABC):
    def __init__(self, config: dict): ...

    @abstractmethod
    def match(self, src: np.ndarray, ref: np.ndarray,
              valid_mask_src: Optional[np.ndarray] = None,
              valid_mask_ref: Optional[np.ndarray] = None) -> MatchResult: ...

    @property
    @abstractmethod
    def matcher_id(self) -> str: ...

    @property
    def requires_gpu(self) -> bool:
        return False
```

All matchers must implement this interface. Adding a new matcher means: create a new class in src/matching/, register it in matchers.yaml, add it to the arbitration config.

---

## 10. Matcher Selection Model Interfaces (src/selector/)

### 10.1 MSMFeatureVector Dataclass (`src/selector/features.py`)

```python
@dataclass
class MSMFeatureVector:
    pair_id:              str
    sensor_pair_enc:      int     # 0: OHRC-NAC, 1: TMC-WAC, 2: IIRS-WAC
    gsd_ratio:            float   # src_gsd / ref_gsd in (0, 1.0]
    latitude_abs:         float   # |lat| in [0.0, 90.0] degrees
    delta_solar_azimuth:  float   # |delta_az| in [0.0, 180.0] degrees
    terrain_class_enc:    int     # 0: highland, 1: maria, 2: polar, 3: mixed
    crater_density:       float   # log(1 + craters/Mpx)
    masked_fraction:      float   # [0.0, 1.0]
    overlap_fraction:     float   # (0.0, 1.0]
    src_texture_contrast: float   # mean local std (8x8 window)
    ref_texture_contrast: float   # mean local std (8x8 window)
    src_mean_gradient:    float   # mean Sobel gradient magnitude (src)
    ref_mean_gradient:    float   # mean Sobel gradient magnitude (ref)
    tile_count:           int     # active tile count
    feature_vector_hash:  str     # md5 hex digest of serialized vector
```

### 10.2 SelectorResult Dataclass & JSON Schema (`src/selector/model.py`, `results/<pair_id>/selector.json`)

```python
@dataclass
class SelectorResult:
    pair_id:              str
    selected_matcher:     str         # "sift" | "rift2" | "lightglue" | "crater"
    confidence:           float       # max probability (0.0 to 1.0)
    fallback_matcher:     str         # second choice matcher
    all_probs:            dict        # {"sift": p0, "rift2": p1, "lightglue": p2, "crater": p3}
    routing_reason:       str         # "high_confidence", "dual_confidence", "safe_mode"
    matchers_to_run:      list[str]   # list passed to L2 engine
    hard_rules_applied:   list[str]   # e.g., ["crater_density_gate_blocked", "gpu_available_ok"]
    selector_version:     str         # "msm_v1"
    feature_vector_hash:  str
```

```json
{
  "pair_id": "ohr_20200827T003010__nac_M123456789",
  "selected_matcher": "lightglue",
  "confidence": 0.82,
  "fallback_matcher": "rift2",
  "all_probs": {
    "sift": 0.05,
    "rift2": 0.12,
    "lightglue": 0.82,
    "crater": 0.01
  },
  "routing_reason": "high_confidence_single_matcher",
  "matchers_to_run": ["lightglue"],
  "hard_rules_applied": ["crater_density_below_tau_c"],
  "selector_version": "msm_v1",
  "feature_vector_hash": "a1b2c3d4e5f6...",
  "created_at": "2026-08-27T12:02:00Z"
}
```

