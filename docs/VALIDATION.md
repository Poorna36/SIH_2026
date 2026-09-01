# SIH26166 — VALIDATION v2.0

How to verify the system is correct. This document defines what "it works" means and how to prove it.

---

## 1. What Must Be Validated

> **These are component-level acceptance criteria.** They govern whether individual pipeline components are correctly implemented. They are NOT the same as the system-level pass/fail criteria in §5 — per-matcher thresholds here (e.g. M1 SR ≥ 90%) and system-level thresholds in §5 (e.g. mean inlier_ratio ≥ 0.10) are legitimately different because one is a single-component bar and the other is an aggregate across all pairs and matchers.

| Item | What "Pass" Means |
|---|---|
| End-to-end pipeline | RMSE < 1.0 px on >=50% of test pairs; no silent failures |
| Matcher M0 (SIFT) | Runs on all pairs; produces baseline metric; fails gracefully on polar |
| Matcher M1 (RIFT2) | SR >= 90% across all terrain classes; RMSE after L5 < 1.0 px |
| Matcher M2 (LightGlue) | Inlier ratio >= 0.20 across diverse pairs; F2 checks never disabled |
| Matcher M3 (Crater) | Only triggers when crater_density >= tau_c; 0% false activation in mare |
| Uniform coverage | grid_density_std <= 4.0; coverage >= 0.60 on all matchers |
| Sub-pixel refinement | refinement_gain >= 0.10 px on >= 60% of pairs (L5 is doing real work) |
| IIRS module | RMSE < 80 m absolute on IIRS pairs vs WAC reference |
| Matcher Selection Model (MSM) | Passes all 8 Acceptance Criteria (AC1–AC8; accuracy $\ge 70\%$, runtime cut $\ge 50\%$) |
| Leakage | No geo_cell overlaps between train and test splits |

---

## 2. Ground Truth Construction

### 2.1 Manual Annotation Protocol

1. Select 15-20 pairs from the test split, stratified by terrain class, latitude bin, and sensor pair
2. For each pair: lay a 6x6 uniform grid over the valid (unmasked) region of the source image
3. For each of the 36 grid points: identify the matching location in the reference image by visual inspection and photoclinometric cues (crater rims, small boulders, texture pattern)
4. Record: src_xy and ref_xy as (col, row) floats; partition as "eval" for held-out, "fit" for validation of matcher consistency
5. Ensure > 20 points in the "eval" partition per pair for RMSE computation
6. Re-annotate 20% of points independently (by a second annotator or after a time gap) for inter-annotator error estimation; record as "qc" partition
7. Store in INTERFACES.md §7 format at data/metadata/gt/<pair_id>_gt.json

### 2.2 Cross-Method Consistency Adjudication

Where manual annotation is too difficult (heavy shadow, low texture):
1. Run all matchers on the pair
2. Identify points where 3 or more matchers agree to within 0.5 px
3. Use consensus as pseudo-GT; label partition="fit" (not "eval")
4. Do not mix pseudo-GT with manual-GT in the same RMSE computation

### 2.3 LOLA/pc_align Anchor (where available)

Where a LOLA track crosses the source footprint:
- Use pc_align (ASP tool) to compute a rigid offset between the pipeline's registered GeoTIFF and the LOLA track
- Report: pc_align residual in meters as an independent absolute accuracy check

---

## 3. Evaluation Dataset Requirements

The test set must include:
- >= 5 pairs from each terrain class: {equatorial_mare, equatorial_highland, polar_highland, polar_mare, crater_floor, ejecta}
- >= 3 pairs from latitude > +/-55 degrees
- >= 3 pairs from delta_azimuth > 90 degrees (extreme illumination change)
- >= 3 pairs from the lowest crater_density bin (tests M3 gating)
- All sensor pair types: OHRC-NAC, OHRC-WAC, TMC-2-WAC, and IIRS-WAC (separate module)

Minimum test set size: **30 pairs** across the full stratification.
(6 terrain classes × ≥5 pairs each = 30 minimum; the earlier figure of 25 was a contradiction and is corrected here.)

**Partial-overlap pair eligibility:** Pairs with `partial_overlap=true` in the PairRecord are eligible for leaderboard scoring but are reported in a separate `partial_overlap` stratum. They are NEVER merged with full-overlap pairs in the primary RMSE aggregate. They count toward the failure-rate denominator.

---

## 4. Metric Definitions

All metrics computed ONLY on the "eval" partition of GT checkpoints.

**RMSE (primary)**
RMSE = sqrt(mean(residuals_squared))
residuals = euclidean distance in pixels between predicted ref_xy and GT ref_xy
Report: before L5 refinement and after; ALWAYS state N (number of GT checkpoints used).

**pct_lt_1px**
Fraction of GT checkpoints with residual < 1.0 px.

**pct_lt_0p5px**
Fraction of GT checkpoints with residual < 0.5 px. The sub-pixel precision indicator.

**MedAE**
Median absolute error in pixels. Robust to outlier GT errors.

**Inlier count / ratio**
inlier_ratio = len(inliers) / len(candidates_after_L3)
inlier_count = absolute count of DEGENSAC inliers

**Spatial coverage**
coverage = occupied_cells / valid_cells
where valid_cells = grid cells with mask_fraction < 0.5

**Grid density std-dev**
std(match_count per cell) over the NxN grid. Lower = more uniform.
Report both before and after L3 selection.

**Refinement gain**
refinement_gain = RMSE_coarse - RMSE_refined (should be positive; negative = refinement hurt)

**Runtime**
Wall-clock time in seconds per pair for S4-S7 (matching through refinement). Reported per matcher.

**Precision, Recall, Matching Score (where GT allows)**
precision = TP / (TP + FP) where TP = predicted match within 3px of GT match
recall = TP / total_GT_matches
matching_score = (precision + recall) / 2

**gt_interannotator_rmse_px (mandatory to compute and report)**
Computed from the "qc" partition (20% of eval points re-annotated independently):
gt_interannotator_rmse_px = RMSE between original annotation and re-annotation for the same points.
This is the demonstrated precision of the ground-truth itself.

**Annotation precision rule:** No algorithmic accuracy claim (RMSE, pct_lt_0p5px, etc.) may be presented as meaningful if the claimed precision is smaller than `gt_interannotator_rmse_px`. Example: if gt_interannotator_rmse_px = 0.45 px, a claimed algorithmic RMSE of 0.3 px is not scientifically interpretable. Report both values together in every result table.

---

## 5. Pass/Fail Criteria (System-Level)

> **These are system-level criteria**, aggregated across all pairs and matchers. They are deliberately different from the per-matcher component-level criteria in §1. A coding agent that reads both sections and interprets them as contradictory has misread the document — they operate at different levels of abstraction.

The implemented system passes validation if, on the test split:

| Criterion | Required | Stretch |
|---|---|---|
| Best matcher RMSE (mean across pairs) | < 1.0 px | < 0.5 px |
| Best matcher pct_lt_1px | >= 0.70 | >= 0.85 |
| spatial_coverage (mean) | >= 0.60 | >= 0.75 |
| grid_density_std (mean) | <= 4.0 cells | <= 2.5 cells |
| inlier_ratio (mean) | >= 0.10 | >= 0.25 |
| M0 failure rate (no output) | <= 30% of pairs | <= 15% |
| IIRS RMSE (absolute) | < 80 m | < 40 m |
| Leakage audit | must pass | must pass |
| MSM Accuracy (AC1) | >= 70.0% | >= 85.0% |
| MSM Runtime Reduction (AC5) | >= 50.0% | >= 65.0% |
| Polar stratum included in report | mandatory | mandatory |
| TMC-2–WAC (separate, non-gating) | reported separately; shortfall does NOT fail overall system | RMSE < 1.5 px |
| gt_interannotator_rmse_px | must be computed and reported alongside every RMSE claim | < 0.3 px |

Note on TMC-2–WAC row: this sensor pair is confirmed unvalidated by any paper in the corpus (ARCHITECTURE.md §8 item 6). A shortfall here reflects the experimental status of the branch, not a system failure. It must still be reported — never hidden.

---

## 6. Leakage Audit Protocol

```bash
python -m src.evaluation.leakage_audit --manifest data/pairs/manifest.jsonl --check-msm
```

Checks:
- No pair appears in both train and test split
- No pair's geo_cell appears in both splits (the geo_cell is the split unit, not the pair)
- Any gt_path present in manifest must correspond to a pair in the test split
- The leaderboard.csv split column matches manifest.jsonl split for all pair_ids
- When `--check-msm` is set: verifies MSM training feature set contains zero geo-cells present in test split

The leakage audit must pass before any leaderboard number is published or quoted.

---

## 7. Regression Suite

For catching regressions during implementation. Every test has an ID for CI reference.

### Unit Tests

| ID | Stage | Assertion | Pass Condition |
|---|---|---|---|
| T01 | L0 | isisimport + spiceinit on a known-good OHRC product | spiceinit exits 0; footprint non-empty; solar angles present |
| T02 | L0 | bbox padding formula | Padded bbox area = (footprint + k×σ)²; verified against reference SIFT-IIRS-WAC paper setup; error < 0.1% |
| T03 | L1 | Shadow mask fraction on one representative pair | Fraction in [5%, 30%] |
| T04 | L1 | Radiometric normalisation | Mean and std of normalised src within 5% of ref after stat transfer |
| T05 | L1/L2 | ANMS SSC output | No two selected keypoints within suppression radius r; budget within ±5% of target |
| T06 | L2 | M0 (SIFT) candidate count on a known-good textured pair | >= 50 candidates before selection |
| T07 | L2 | M2 (LightGlue) F2 checks | Out-of-bounds and duplicate matches removed; count of removed > 0 on a crafted test set |
| T08 | L3 | Grid selection coverage | coverage after selection >= coverage_min (0.60) |
| T09 | L4 | DEGENSAC on a known-good match set | inlier_ratio >= 0.5; H recovered to within 0.1 px on a synthetic homography test |
| T10 | L4 | Model ladder selects homography over affine | Homography chosen when affine RMSE > 1.0 px; warp residual at corners < 0.05 px on synthetic test |
| T11 | L5 | Refinement gain on a synthetic controlled shift | Take one real image; apply known shift of (3.7, 2.3) px; run L5; recovered shift within 0.1 px of ground truth; sharpness > tau_q |
| T12 | L7 | RMSE computation reads only "eval" partition | Inserting a "fit" partition point does not change reported RMSE |
| T13 | L1.5 | MSM Feature Extraction Determinism | Extracting features twice on identical PairRecord + meta.json yields exact same feature vector and MD5 hash |
| T14 | L1.5 | MSM Rule-Based Gating Override | If crater_density < tau_c, P(M3) is clamped to 0.0; if GPU unavailable, M2 routes to CPU fallback |
| T15 | L1.5 | Dual-Threshold Routing Logic | Tests $P_{max} \ge 0.65 \to [M_{best}]$, $0.40 \le P < 0.65 \to [M_{best}, M_{second}]$, $P < 0.40 \to [M_0, M_1, M_2, M_3]$ |
| T16 | L1.5 | Geo-Cell Disjoint MSM Cross-Validation | GroupKFold CV on train split confirms zero geo-cell overlap between train and validation folds |

### Integration Tests
- Full pipeline on 3 pilot pairs, all matchers: no crashes and all artifacts written
- benchmark.py --resume: re-running does not re-process completed stages; state machine resumes from correct intermediate
- MSM prediction on test split achieves $\ge 50\%$ runtime savings vs exhaustive execution

### Synthetic Ground Truth Test
- Take one real image; apply known transform T (rotation=2 deg, scale=1.05, shift=50px each axis)
- Run full pipeline; verify recovered transform is within 0.5 px RMSE of T
- Use this as a daily sanity check before running on real pairs

---

## 8. Known Failure Conditions (Expected, Not Bugs)

| Failure | Cause | Expected? | Action |
|---|---|---|---|
| M0 fails at poles | SIFT gradient collapses near polar terrain | Yes -- documented | M3 or M1 should take over |
| M3 skips in mare | crater_density < tau_c | Yes -- gating works | M2 or M1 runs instead |
| M1 fails on one pair | one documented RIFT total failure mode | Yes -- known | M0 fallback; record in failures.jsonl |
| High mask fraction (>30%) | polar deep shadow | Yes -- a real stratum | Keep pair, proceed on unmasked area |
| tile-wise model chosen | high latitude or high relief | Yes -- expected | Record ladder level; not an error |
| RMSE > 1px for IIRS | 80m GSD + spectral appearance gap | Expected without photometric correction | Apply correction before matching |
| LightGlue domain gap on lunar | MegaDepth training domain | Known risk | F2 checks + M0 fallback mitigate |

---

## 9. Matcher Selection Model (MSM) Acceptance Protocol

The selector must satisfy all **8 Acceptance Criteria (AC1–AC8)** on the held-out test split before setting `msm.enabled: true`:

| Criterion | Target | Description |
|---|---|---|
| **AC1 — Selector Accuracy** | $\ge 70.0\%$ | Fraction of test pairs where selector chooses the oracle best matcher |
| **AC2 — Top-2 Accuracy** | $\ge 85.0\%$ | Fraction of test pairs where oracle best matcher is in top 2 predictions |
| **AC3 — Mean RMSE Degradation** | $\le +0.10\text{ px}$ | $\overline{\text{RMSE}}_{\text{selected}} - \overline{\text{RMSE}}_{\text{oracle}}$ across test split |
| **AC4 — Max Pair Degradation** | $\le +0.50\text{ px}$ | $\max_{i}(\text{RMSE}_{\text{selected}, i} - \text{RMSE}_{\text{oracle}, i})$ |
| **AC5 — Runtime Reduction** | $\ge 50.0\%$ | Reduction in total matching execution time vs running all matchers |
| **AC6 — Safe-Mode Fallback Rate** | $\le 20.0\%$ | Percentage of test pairs falling back to full safe-mode ($P < \tau_{low}$) |
| **AC7 — Feature Importance** | $> 0$ gain | Top 5 features show non-zero split and gain importance |
| **AC8 — Leakage Audit** | Exit Code 0 | `python -m src.evaluation.leakage_audit --manifest data/pairs/manifest.jsonl --check-msm` |

