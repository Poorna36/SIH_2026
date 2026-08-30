# Phase 7 — Ground Truth Annotation Guide & Data Contract

This document provides complete instructions for human annotators, research assistants, and automated tooling creating Ground Truth (GT) control points for **Phase 7** of the Chandrayaan-2 Lunar Optical Image Registration pipeline (SIH 2026 PS-26166).

All downstream validation (Phase 8, leaderboard scoring, and scientific accuracy claims) strictly depends on the schemas, partitions, and coordinate conventions documented below.

---

## 1. Ground Truth Schema & Data Contract

All Ground Truth files must be saved in:
```
data/metadata/gt/<pair_id>_gt.json
```

### JSON Schema (INTERFACES.md §7)
```json
{
  "pair_id": "ohr_20200827T003010__nac_M123456789",
  "annotator": "manual_grid_6x6",
  "n_checkpoints": 36,
  "qc_reannotated_pct": 0.20,
  "checkpoints": [
    {
      "id": 0,
      "src_xy": [512.4, 256.8],
      "ref_xy": [720.1, 410.5],
      "partition": "eval"
    },
    {
      "id": 1,
      "src_xy": [680.0, 256.8],
      "ref_xy": [889.3, 408.2],
      "partition": "fit"
    },
    {
      "id": 0,
      "src_xy": [512.4, 256.8],
      "ref_xy": [720.3, 410.7],
      "partition": "qc"
    }
  ]
}
```

---

## 2. Coordinate Conventions (CRITICAL)

> [!CAUTION]
> **Strict Coordinate Rule:**
> - Pixel coordinates are **`(col, row)` = `(x, y)`**, 0-indexed, with top-left image origin `(0.0, 0.0)`.
> - **NEVER use `(row, col)` / `(y, x)`.**
> - In NumPy arrays, `arr[row, col]` maps to coordinate `[col, row]`.
> - Geographic coordinates in metadata are **`(lon, lat)`** decimal degrees.

---

## 3. Checkpoint Partitions

Every checkpoint in the `checkpoints` array must be labeled with one of three partitions:

| Partition | Purpose | Used in RMSE Calculation? | Quota |
|---|---|---|---|
| **`"eval"`** | Held-out evaluation checkpoints | **YES (Exclusively)** | ≥ 70% of points (≥ 20 per pair) |
| **`"fit"`** | Model consistency validation | **NO** (Strictly excluded) | 20–30% of points |
| **`"qc"`** | Quality control & inter-annotator precision | **NO** (Used for `gt_interannotator_rmse_px`) | 20% re-annotated points |

### The "Eval" Isolation Invariant:
Per VALIDATION.md §4:
$$\text{RMSE} = \sqrt{\frac{1}{N_{\text{eval}}} \sum_{i \in \text{eval}} \|\mathbf{x}_{\text{pred}, i} - \mathbf{x}_{\text{gt}, i}\|^2}$$
Inserting or modifying `"fit"` or `"qc"` points **MUST NOT** change the reported algorithm RMSE.

### The Inter-Annotator Precision Rule:
Re-annotate 20% of points independently (either by a second annotator or blind after a time delay) and assign `partition: "qc"`.
`evaluate_pairs.py` computes:
$$\text{RMSE}_{\text{interann}} = \sqrt{\frac{1}{N_{\text{qc}}} \sum_{j \in \text{qc}} \|\mathbf{x}_{\text{eval}, j} - \mathbf{x}_{\text{qc}, j}\|^2}$$

> [!IMPORTANT]
> **Scientific Validity Invariant (VALIDATION.md §4):**
> No algorithm accuracy claim (e.g. "RMSE = 0.3 px") is scientifically interpretable if the claimed precision is smaller than `gt_interannotator_rmse_px`. Both values are published together.

---

## 4. Test Set Stratification Requirements (VALIDATION.md §3)

The Phase 7 manual annotation campaign must cover a minimum of **30 test pairs** across all strata:

1. **Terrain Classes (≥ 5 pairs each):**
   - `equatorial_mare`
   - `equatorial_highland`
   - `polar_highland`
   - `polar_mare`
   - `crater_floor`
   - `ejecta`
2. **Extreme Latitude:** ≥ 3 pairs with $|\text{latitude}| > 55^\circ$.
3. **Extreme Illumination:** ≥ 3 pairs with $\Delta\text{azimuth} > 90^\circ$.
4. **Low Crater Density:** ≥ 3 pairs in the lowest crater density bin ($< 1.0\text{ craters/km}^2$).
5. **Sensor Pair Types:** OHRC-NAC, OHRC-WAC, TMC-2-WAC, and IIRS-WAC.

---

## 5. Annotation Step-by-Step Procedure

1. **Open Image Pair:** Load calibrated source image and co-registered reference image in QGIS, OpenCV annotation GUI, or notebook tool.
2. **Overlay 6×6 Grid:** Create a regular 6×6 grid (36 cells) over the unmasked valid terrain area.
3. **Select Salient Features:** In each grid cell, locate a distinct morphological feature:
   - Small crater rim peaks (< 5 px diameter)
   - Sharp shadow boundaries of boulders
   - High-contrast albedo or texture intersections
4. **Record Coordinates:**
   - Record `src_xy` = `[src_col, src_row]`
   - Find exact matching feature in reference image and record `ref_xy` = `[ref_col, ref_row]`
5. **Assign Partitions:** Assign `"eval"` to ~25 points and `"fit"` to ~11 points.
6. **Perform QC Re-annotation:** Independently re-mark 7 points and record them with `partition: "qc"`.
7. **Save JSON:** Save to `data/metadata/gt/<pair_id>_gt.json`.

---

## 6. How to Validate GT Files Before Submitting

Run the static validation and audit command:
```bash
# Validate coordinate assertions across repository
python scripts/audit_coordinates.py --strict

# Run GT evaluation against pipeline results
python scripts/evaluate_pairs.py \
    --manifest data/pairs/manifest.jsonl \
    --results results/ \
    --gt data/metadata/gt/ \
    --out-dir results/pair_results/

# Run system-level validation
python -m src.evaluation.system_validation \
    --leaderboard results/leaderboard.csv \
    --manifest data/pairs/manifest.jsonl
```
