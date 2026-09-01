# SIH26166 — FEATURES v2.0

Complete feature list. Implement every F0x–F2x feature. Do not add features not listed here without architectural review.

Format: ID | Name | Component | Description / Acceptance Criteria / Notes

---

## F01 — Product Ingestion and Calibration

**Component:** L0 / scripts/ingest.py
**Description:** Accept PRADAN/CHMAP zip archives (.img + .xml PDS4 for OHRC/TMC-2; QUB for IIRS). Unzip preserving original ISRO filenames. Run isisimport to produce .cub files. Run spiceinit (or CSM isd_generate) to attach camera geometry. Fetch only the per-date CK kernel window (not the full 200 GB set).
**Acceptance criteria:**
- .cub file produced for every valid product
- spiceinit exits 0; SPICE kernel attached and queryable
- Footprint (4 corner lat/lon) extracted and stored in products.jsonl
- Solar incidence, solar azimuth, UTC, GSD recorded per product
- NO file has been renamed from its ISRO original name

**Implementation note:** ASP version must be >= 3.7.0. Check version at startup. CK kernel window = strip UTC ± 20 days.

---

## F02 — Automated Reference Patch Acquisition

**Component:** L0 / scripts/build_pairs.py
**Description:** Given a source product footprint, automatically acquire the corresponding reference image patch without manual work. For NAC: query Lunar ODE bbox endpoint. For WAC: crop local WAC 643nm mosaic via GDAL. For SELENE: query Moon Trek WMTS by bbox (Kaguya TC 10 m/px or MI 62 m/px). Apply 2-5x pointing-uncertainty padding to the footprint bbox before querying.
**Acceptance criteria:**
- Reference patch exists for >= 90% of valid source products
- Bounding box padding is recorded in PairRecord
- Fallback chain is implemented in order: NAC via ODE -> WAC crop -> SELENE Moon Trek WMTS -> skip with reason
- ref.type recorded as NAC | WAC | SELENE in PairRecord; SELENE pairs form a separate evaluation stratum

---

## F03 — PairRecord Manifest

**Component:** L0 / build_pairs.py
**Description:** For every (source, reference) pair, write a complete PairRecord to manifest.jsonl (one JSON per line). See INTERFACES.md §1 for the full schema.
**Acceptance criteria:**
- manifest.jsonl is append-only; pairs are never deleted, only flagged
- Every PairRecord includes: pair_id, sensor, GSD, solar angles, terrain_class, crater_density, geo_cell, split
- skipped.jsonl exists and captures all skipped pairs with reason

---

## F04 — Shadow and Validity Masking

**Component:** L1 / src/preprocessing/masks.py
**Description:** Compute a per-pixel validity mask for every source and reference image. The mask identifies: dark pixels (below solar-incidence-derived threshold), flat pixels (local variance below threshold), and cast-shadow regions. Export as valid_mask.png. All downstream stages must respect this mask.
**Acceptance criteria:**
- Mask fraction between 5% and 30% for nominal pairs; outside range: flag the pair
- Matches whose support patch touches the mask are rejected at every stage
- Mask exported alongside every processed pair

---

## F05 — Radiometric Normalization

**Component:** L1 / src/preprocessing/normalize.py
**Description:** Apply 2nd/98th percentile clip and min-max rescaling to source and reference patches. Then transfer mean/std of source to match reference statistics (stat_transfer). This is the minimal, always-on normalization applied before every detector.
**Acceptance criteria:**
- Mean and std of normalized source within 5% of reference after transfer
- Operation is documented in meta.json provenance log

---

## F06 — Sensor Branch Preprocessing

**Component:** L1 / src/preprocessing/branches.py
**Description:** Apply sensor-specific preprocessing after F05:
- OHRC->NAC branch: CLAHE (clip=2.0, tile=8x8) + optional contrast inversion + morphological dilation + PCA reduction to 1 component
- TMC-2->WAC branch: histogram matching + CLAHE (experimental; A/B test against minimal)
- M2/M3 (learned matchers): SKIP this step; apply F05 only
**Acceptance criteria:**
- Branch applied matches config (sensor pair + matcher)
- Learned matchers NEVER receive heavy branch preprocessing
- Branch choice recorded in meta.json

---

## F07 — GSD Reconciliation and Adaptive Interpolation

**Component:** L1 / src/preprocessing/resample.py
**Description:** Pyramid resample the coarser-GSD image to match the finer-GSD image's pixel size before matching. Select interpolation method based on solar incidence: bilinear for incidence >= 45 degrees (high shadow), bicubic for incidence < 45 degrees (high angle, crisp detail).
**Acceptance criteria:**
- GSD ratio and interpolation method recorded in meta.json
- Output pixel sizes are within 5% of each other
- Never upsample the higher-GSD (reference) image; only the source

---

## F08 — Overlapping Tile Generation

**Component:** L1 / src/preprocessing/tiling.py
**Description:** Split source and reference into overlapping tiles (512x512 px, 64 px overlap). Discard tiles smaller than half the tile size. Store tile grid coordinates in tiles.geojson.
**Acceptance criteria:**
- No tile boundary artifact in downstream matching (overlap ensures this)
- Tile coordinates in tiles.geojson allow result reassembly
- Tiles smaller than 256 px in either dimension are discarded

---

## F09 — Matcher M0: SIFT + RANSAC (always-on baseline)

**Component:** L2 / src/matching/sift.py
**Description:** Tiled SIFT with Lowe ratio 0.75 -> DEGENSAC homography verification. Runs on EVERY pair. Serves as floor benchmark and fallback of last resort. ANMS SSC applied after detection, before description.
**Acceptance criteria:**
- Runs on 100% of pairs without crash
- Produces at least 1 result per pair (even if inlier_count=0, which is a valid result)
- Runtime and candidate count recorded in matches_raw.json

---

## F10 — Matcher M1a: RIFT2 + Scale-Space Extension

**Component:** L2 / src/matching/rift.py
**Description:** Phase congruency detection (log-Gabor, Ns=4, No=6) + Maximum Index Map descriptor + multi-MIM rotation invariance + multi-octave log-Gabor scale-space extension (our addition to close RIFT's scale gap). ANMS SSC applied pre-description.
**Scale-consistency filter (MANDATORY — implements D08 novelty):** After keypoint matching, reject any match where |log(scale_src / scale_ref) − log(gsd_ratio)| > 0.3, where gsd_ratio = src.gsd_m / ref.gsd_m from the PairRecord. Without this filter, the multi-octave scale-space extension has no implementation.
**Polar limitation (DOCUMENTED):** RIFT2 is demonstrated failing (❌) on OHRC-NAC Polar in Traditional_vs_DeepLearning_FeatureMatching — the same sensor pair and exact hardest condition in this project. M1 is NOT the validated polar fallback. For CPU-only + low-crater-density + polar pairs, record `no_validated_primary_matcher=true`.
**Acceptance criteria:**
- Rotation invariance: 100% SR on a 72-pair synthetic 5-degree rotation sweep
- Scale invariance: operates correctly on pairs with GSD ratio up to 5x after L1 pyramid reconciliation
- Scale-consistency filter active: reject count > 0 on a GSD-mismatched pair (verifiable in pilot)
- Matches_raw.json includes per-match confidence (NCC score)
- Runtime recorded; flag if > 120 s per tile
- `polar_validated: false` recorded in matches_raw.json metadata

**Implementation note:** PC detection needs parameter tuning on lunar data (tau_pc). Multi-MIM costs No× compute at match time. The scale-space extension adds octaves above RIFT's original fixed scale.

---

## F10b — Matcher M1b: LNIFT (Pilot-Phase Benchmark)

**Component:** L2 / src/matching/lnift.py
**Description:** LNIFT is benchmarked alongside RIFT2 (M1a) on the same pilot pairs. If LNIFT wins on pilot metrics, it is promoted to primary M1. Reported by supplementary_research.md as ~100x faster than RIFT with 99.9% SR vs 79.85% for RIFT2. Implements the same scale-consistency filter as M1a.
**Acceptance criteria:**
- Runs on same 3 pilot pairs as RIFT2; results compared in leaderboard
- Same scale-consistency filter as F10 applied
- Winner declared per pilot evaluation; DECISIONS.md D14 updated with outcome

---

## F11 — Matcher M2: SuperPoint + LightGlue (learned, GPU-preferred)

**Component:** L2 / src/matching/lightglue.py
**Description:** SuperPoint keypoint detector + LightGlue matcher. Pretrained weights used (no lunar-specific retraining). GPU preferred; CPU fallback enabled. F2 checks mandatory (in-domain bounds + one-to-one constraint). Confidence per match from LightGlue output.
**Acceptance criteria:**
- F2 checks execute on every match result -- never disabled
- Out-of-bounds and duplicate matches are rejected before writing matches_raw.json
- CPU fallback activates automatically if GPU OOM or unavailable
- Per-match confidence stored in matches_raw.json

---

## F12 — Matcher M3: Crater-Geometry (CNSFM-style)

**Component:** L2 / src/matching/crater.py
**Description:** YOLOv9 crater detector (pretrained, transfer-learned from LROC NAC @ 0.5 m/px) -> Crater Neighborhood Structure Feature (CNSF) graph construction -> similarity-invariant topology matching -> MCR structural outlier removal. GATED: runs only when crater_density_per_km2 >= tau_c in BOTH images AND terrain_class in {highland, polar_highland, polar}.
**CPU fallback:** When GPU unavailable, activate HoughCircles-based crater detection instead of YOLOv9. Record matcher_id as `crater_hough` (not `crater`) in all results.
**Pre-flight recall check (MANDATORY before M3 as primary):** YOLOv9 is validated only at 0.5 m/px (NAC). OHRC (0.3 m/px) and TMC (5 m/px) are untested in all reviewed papers. Before M3 is trusted as primary on a new sensor, run recall on a small manually-verified crater patch for that sensor. Record `detector_validated: true/false` in matches_raw.json.
**Acceptance criteria:**
- Gate evaluation always runs first; skip decision recorded in matches_raw.json (gate_skip=true, reason)
- crater_density field in PairRecord has unit craters/km2 — unitless value is a configuration error
- No false activations in mare (crater_density_per_km2 < tau_c) pairs
- When triggered, produces crater-based correspondences with topology confidence scores
- `detector_validated` flag present in every matches_raw.json for M3
- CPU fallback (crater_hough) activates automatically when GPU unavailable

---

## F13 — Adaptive Non-Maximal Suppression (ANMS SSC)

**Component:** L2 / src/selection/anms.py
**Description:** SSC (Suppression via Square Covering) variant of ANMS. Applied pre-description inside M0 and M1 matchers. Suppresses weaker keypoints within a radius that adapts to hit a target keypoint budget.
**Algorithm (Bailo et al., Pattern Recognition Letters 2018):**
1. Sort all detected keypoints by response descending.
2. For each keypoint k_i, find its nearest stronger neighbour (first j < i with response[j] > response[i]) using a KD-tree — O(n log n).
3. The suppression radius r_i = distance to that stronger neighbour.
4. Square-covering acceptance: select keypoints greedily in order of decreasing r_i, accepting k_i if no already-accepted keypoint lies within r_i — O(K·n) where K = budget.
5. Stop when budget is reached or all keypoints are processed.
**Acceptance criteria:**
- No two selected keypoints are within the computed suppression radius of each other
- Output budget matches config (allow ±5%)
- Drop-in compatible after any OpenCV detector
- Runs in O(n log n + K·n); flag if runtime > 1 s on a 2000-keypoint set

---

## F14 — Post-Match Grid-Based Coverage Enforcement

**Component:** L3 / src/selection/spatial.py
**Description:** After matching (L2), enforce spatial coverage using a NxN grid over the source image. Apply confidence filter, per-cell cap (max-N per cell), then coverage-aware greedy selection to hit budget K. Resolve one-to-many conflicts by keeping highest-confidence match. Report coverage and grid_density_std before and after.
**Acceptance criteria:**
- coverage after selection >= 0.60 (gate)
- >= 25 matches after selection (gate)
- grid_density_std reported in selection_stats.json
- One-to-one constraint enforced on output

---

## F15 — F2 Mandatory Checks (All Matchers)

**Component:** L4 / src/registration/checks.py
**Description:** Before any RANSAC step, apply mandatory F2 checks to every match set:
1. In-domain bounds check: source xy must be within source image bounds + 10px buffer; same for reference
2. One-to-one constraint: remove any source or reference coordinate that appears more than once (keep highest confidence)
These checks are especially critical for M2 and M3 but apply to all matchers.
**Acceptance criteria:**
- No out-of-bounds match reaches DEGENSAC
- No duplicate source or reference coordinate reaches DEGENSAC
- Number of matches removed by F2 checks recorded in geometry.json

---

## F16 — DEGENSAC Geometric Verification + Model Ladder

**Component:** L4 / src/registration/ladder.py
**Description:** Run DEGENSAC (degeneracy-aware RANSAC) with 10,000 iterations, 0.99999 confidence, t_gsd threshold. Apply model ladder: try similarity, then affine, then homography. Accept simplest model with inlier RMSE <= 1.0 px. Widen threshold x1.5 once on failure before tile-wise fallback.
**Acceptance criteria:**
- Degeneracy-aware RANSAC is used (not standard RANSAC) for all geometric verification
- Model ladder level chosen is recorded in geometry.json (ladder_level field)
- t_gsd_used recorded; ladder traversal recorded
- inlier_ratio >= 0.05 and >= 20 inliers or the matcher is marked failed for this pair

---

## F17 — Tile-wise Local Models (High-Latitude / High-Relief Fallback)

**Component:** L4 / src/registration/tilewise.py
**Description:** When latitude_center > ±55 degrees OR when terrain relief is estimated to be high, replace the global model with tile-wise local affine or homography models (512px tiles, 50% overlap, min 12 inliers per tile). Blend model boundaries using a Gaussian distance-weighted average.
**Blend weighting formula:** For a pixel x in the overlap zone of tile T with centre c_T:
```
w_T(x) = exp( −‖x − c_T‖² / (2 · σ²) ),  σ = 256 px
```
The blended displacement at x is the weighted mean of all tile displacements whose coverage includes x. Weights are normalised to sum to 1. Do NOT use uniform averaging — it produces visible seams at tile boundaries.
**Acceptance criteria:**
- Trigger condition logged in geometry.json (tilewise=true, trigger_reason)
- Boundary blending uses the Gaussian formula above with σ=256; no visible seams in warp output
- Each tile model and its inlier count stored in tile_models array

---

## F18 — GCP Declustering and Z-Score Filtering

**Component:** L4 / src/registration/declustering.py
**Description:** After RANSAC, enforce GSD-scaled minimum spacing between inlier matches, then apply Z-score residual filter (threshold 3.0) to remove outliers. Requires at least 20 matches for Z-score to run.
**GSD-scaling (MANDATORY):** min_spacing_px is scaled by (ref_gsd_m / base_gsd_m) where base_gsd_m = 0.5 m (NAC baseline). Examples: NAC ref → 20 px; TMC ref (5 m) → ~200 px; IIRS ref (80 m) → ~3200 px. Without this scaling, physical GCP spacing varies wildly across sensor pairs — a real cross-sensor accuracy regression.
**Acceptance criteria:**
- No two output GCPs closer than gsd_scaled min_spacing_px in the reference image
- GSD scaling applied and recorded: `gsd_scale_factor` in geometry.json
- Z-score filter runs only when > 20 GCPs present; else only spacing filter applies
- Final GCP count recorded in geometry.json

---

## F19 — Sub-pixel Refinement per Inlier

**Component:** L5 / src/refinement/local.py
**Description:** For each DEGENSAC inlier, extract a 32x32 px patch around the coarse match location in both images. Apply Tukey or Gaussian apodization. Run local NCC or phase-only correlation (POC). Extract integer peak, fit 2D paraboloid to get sub-pixel displacement. Apply second-peak rejection. Accept if peak sharpness >= tau_q; else keep coarse coordinate. Report RMSE before and after.
**Second-peak rejection (MANDATORY — restored from v1.1):** After computing the correlation surface, reject the refinement if either:
- Window variance < tau_v (flat/featureless patch — NCC result is noise)
- A second local peak exists with amplitude > 0.80 × primary peak (ambiguous / repetitive texture)
This check is a lunar-specific safety measure for crater-field repetitive texture causing false correlation peaks. Nothing else in the pipeline covers this failure mode.
**Sharpness threshold note (PRIORITY TUNE):** Default tau_q = 0.15. v1.1 used 0.45 (3× stricter). Validate on pilot pairs before trusting refinement_gain metrics — the two values produce materially different refinement success rates.
**Acceptance criteria:**
- Apodization is Tukey or Gaussian (NEVER Blackman — configuration hard-checks this)
- Second-peak rejection check runs on every correlation surface
- refine_success flag set per match; sharpness value and second_peak_ratio stored
- RMSE before and after refinement reported in matches_refined.json
- >= 70% of inliers refine successfully (if below, flag pair as partial_refinement=true)
- refinement_gain (before minus after RMSE) is positive on >= 60% of test pairs (validates L5 is useful)

---

## F20 — Registered Product Generation

**Component:** L6 / scripts/register.py
**Description:** Apply the fitted model(s) to warp the source image onto the reference coordinate grid. Output a GeoTIFF with reference CRS. Produce a match-points CSV and GCP list.
**Acceptance criteria:**
- Warp valid over >= 90% of footprint
- GeoTIFF opens correctly in QGIS/GDAL; CRS matches reference
- CSV has columns: src_col, src_row, ref_col, ref_row, lon, lat, residual_px
- GCP file loadable by GDAL gdal_translate -gcp

---

## F21 — QC Artifact Generation

**Component:** L6 / scripts/register.py
**Description:** Generate three QC images per (pair, matcher): checkerboard interleaving of source/registered and reference tiles, match overlay on source with color-coded residuals, residual heat map showing geographic distribution of registration error.
**Acceptance criteria:**
- Checkerboard tile size: 64 px
- Match overlay: green < 0.5 px, yellow 0.5-1.0 px, red > 1.0 px
- Residual heat map: sigma per match, Gaussian spread radius 3 px
- All three artifacts written to results/<pair_id>/<matcher>/

---

## F22 — Evaluation Harness and Leaderboard

**Component:** L7 / src/evaluation/
**Description:** Compute all metrics (RMSE on held-out GT, pct_lt_1px, pct_lt_0p5px, MedAE, inlier count/ratio, spatial_coverage, grid_density_std, refinement_gain, runtime) per (pair x matcher). Aggregate by (matcher x sensor_pair x stratum). Write leaderboard.csv. Perform leakage audit. Write per-pair JSON results.
**Acceptance criteria:**
- RMSE computed ONLY on GT partition="eval" checkpoints
- Leakage audit passes before any number is printed
- Polar and high-latitude strata are NEVER aggregated away; always reported separately
- leaderboard.csv updated atomically (write to temp, rename)

---

## F23 — Arbitration Log

**Component:** L7 / src/evaluation/arbitration.py
**Description:** For each pair, determine the winning matcher (primary or fallback per the arbitration policy in ARCHITECTURE.md §4). Record: which matcher won, which triggered the gate, inlier_ratio of primary, whether fallback occurred, and reason.
**Acceptance criteria:**
- results/arbitration.log contains one entry per pair
- Every fallback event (primary below floor) is recorded with primary matcher name and inlier_ratio
- The winning matcher for each pair is reflected in the leaderboard aggregate

---

## F24 — IIRS Photometric Correction and Registration Module

**Component:** IIRS module / src/matching/iirs.py
**Description:** Separate module (iirs_wac.yaml config) for IIRS data. Steps: (1) read QUB product, (2) apply photometric correction for incidence/emission/phase angle variation using Hapke model, (3) select registration band (nearest to WAC 643nm), (4) SIFT-class matching against WAC reference, (5) standard L3-L7 pipeline with IIRS-specific accuracy targets.
**Acceptance criteria:**
- Module is NEVER invoked by the ohrc_nac or tmc_wac pipeline configs
- Photometric correction runs before any feature operation
- Accuracy target: RMSE < 80 m absolute (sub-pixel at 80 m IIRS GSD)
- Module has its own config, its own results dir, and its own leaderboard rows clearly labeled "IIRS-WAC"

---

## F25 — Provenance and Reproducibility Logging

**Component:** All modules
**Description:** Every artifact JSON must include: config_hash (hash of the config YAML used), code_commit (git commit sha), matcher_params_hash (hash of all matcher parameters), timestamps (created_at), seed (RANSAC and selection seeds). manifest.jsonl and products.jsonl are append-only; no line is deleted.
**Acceptance criteria:**
- Given a pair_id and a code commit, all intermediate outputs are reproducible from the original raw files
- No artifact is overwritten without --force flag and explicit user confirmation
- Leakage audit can reconstruct the train/test split from manifest.jsonl alone

---

## F26 — Matcher Selection Model (MSM) & Feature Vector (L1.5)

**Component:** L1.5 / src/selector/features.py, src/selector/model.py
**Description:** Predict optimal matcher pipeline using a lightweight LightGBM multi-class model on a 13-dimensional scene feature vector extracted from PairRecord and L1 metadata. Employs dual-threshold confidence routing ($\tau_{high}=0.65, \tau_{low}=0.40$), rule-based safety gating, and graceful escalation.
**Feature Vector Definition (13 features):**
1. `sensor_pair_enc` (int): 0=OHRC-NAC, 1=TMC-WAC, 2=IIRS-WAC
2. `gsd_ratio` (float): GSD ratio source/ref $\in (0, 1.0]$
3. `latitude_abs` (float): Bounding box centroid absolute latitude $[0.0^\circ, 90.0^\circ]$
4. `delta_solar_azimuth` (float): Clamped azimuth difference $[0.0^\circ, 180.0^\circ]$
5. `terrain_class_enc` (int): 0=highland, 1=maria, 2=polar, 3=mixed
6. `crater_density` (float): Log-transformed crater density $\log(1 + \text{craters/Mpx})$
7. `masked_fraction` (float): Fraction of image masked by shadow/validity mask $[0.0, 1.0]$
8. `overlap_fraction` (float): Spatial overlap fraction $(0.0, 1.0]$
9. `src_texture_contrast` (float): Mean local std in $8\times 8$ windows (source)
10. `ref_texture_contrast` (float): Mean local std in $8\times 8$ windows (reference)
11. `src_mean_gradient` (float): Mean Sobel gradient magnitude (source)
12. `ref_mean_gradient` (float): Mean Sobel gradient magnitude (reference)
13. `tile_count` (int): Active non-discarded tile count post-reconciliation

**Acceptance criteria:**
- Feature extraction completes in $< 100\text{ ms}$ per pair
- MD5 feature vector hash generated and logged in `selector.json`
- Hard gates strictly enforced (M3 suppressed if crater density $< \tau_c$; M2 CPU fallback if no GPU)
- Dual-threshold routing correctly dispatches single matcher ($\ge 0.65$), dual matchers ($[0.40, 0.65)$), or all matchers ($< 0.40$)

---

## F27 — Geo-Cell Disjoint MSM Training and Acceptance Evaluation

**Component:** L1.5 + L7 / scripts/train_msm.py, src/evaluation/msm_eval.py
**Description:** Train LightGBM multi-class model on ground-truth oracle best matcher labels from train split using strictly disjoint $10^\circ \times 10^\circ$ geographic cell cross-validation (F15). Validate that selector passes 8 Acceptance Criteria (AC1–AC8) before production activation.
**Acceptance criteria (AC1–AC8):**
1. **AC1 Selector Accuracy:** $\ge 70.0\%$ match with oracle best matcher on test split
2. **AC2 Top-2 Accuracy:** $\ge 85.0\%$ oracle best matcher included in top 2 choices
3. **AC3 Mean RMSE Degradation:** $\le +0.10\text{ px}$ vs oracle best matcher
4. **AC4 Max Single-Pair RMSE Degradation:** $\le +0.50\text{ px}$ across all test pairs
5. **AC5 Runtime Reduction:** $\ge 50.0\%$ reduction in total correspondence search runtime
6. **AC6 Fallback Rate:** $\le 20.0\%$ escalation to full safe mode
7. **AC7 Feature Importance:** Top 5 features have non-zero split/gain importance
8. **AC8 Leakage Audit:** Zero geo-cell overlap verified by `leakage_audit --check-msm`

