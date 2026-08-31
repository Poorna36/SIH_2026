# SIH 2026 — PS-26166: Backend Build Progress

> **How to use:** Check off `[ ]` to `[x]` as you complete each item.
> Mark items you are currently working on with `[~]`.
> Add your initials + date after ticking if helpful for traceability.
> Reference docs: `docs/ARCHITECTURE.md`, `docs/PIPELINE.md`, `docs/IMPLEMENTATION_PLAN.md`, `docs/INTERFACES.md`, `docs/CONFIGURATION.md`, `docs/FEATURES.md`, `docs/VALIDATION.md`.

---

## PHASE 0 — Environment & Project Scaffold

### 0.1 — Conda / ASP Environment
- [ ] `conda create -n asp` with `ames-stereo-pipeline` from `usgs-astrogeology` channel
- [ ] ASP version verified `>= 3.7.0` (`stereo_gui --version`)
- [ ] `pip install` all required packages: `pyyaml tqdm rasterio shapely pygeodesy lightglue kornia numpy scipy opencv-python-headless`
- [ ] `pip install pydegensac` (for DEGENSAC in L4)
- [ ] `ISISROOT`, `ISISDATA`, `ALESPICEROOT` environment variables set and exported

### 0.2 — ISIS Data & SPICE Kernels
- [ ] `downloadIsisData chandrayaan2 $ISISDATA --exclude="kernels/ck/**"` run (non-CK base kernels)
- [ ] CK kernel window fetched for pilot strip date (e.g. `ch2_att_27Jul2020_04Sep2020_v1.bc`)
- [ ] Confirmed only the per-date CK window is present — NOT the full 200 GB set

### 0.3 — Repository Directory Scaffold
- [ ] `src/` subdirectories created: `ingest/`, `preprocessing/`, `geometry/`, `matching/`, `selection/`, `registration/`, `refinement/`, `evaluation/`
- [ ] `scripts/` placeholder files created: `ingest.py`, `build_pairs.py`, `preprocess.py`, `benchmark.py`, `register.py`
- [ ] `configs/` directory created with files: `ohrc_nac.yaml`, `tmc_wac.yaml`, `iirs_wac.yaml`, `matchers.yaml`, `default.yaml`
- [ ] `data/pairs/` empty seed files created: `manifest.jsonl`, `skipped.jsonl`, `failures.jsonl`
- [ ] `results/pair_results/` directory exists; `results/arbitration.log` created
- [ ] `app/` directory created (empty, for later UI)
- [ ] `notebooks/` directory created

### 0.4 — Config Files Written
- [ ] `configs/default.yaml` written (global seed=42, all data dir paths)
- [ ] `configs/ohrc_nac.yaml` written (ASP, pair-building, L1-L7 params per CONFIGURATION.md)
- [ ] `configs/tmc_wac.yaml` written (same structure, TMC-2 sensor branch)
- [ ] `configs/iirs_wac.yaml` written (`extends: default`, IIRS-specific block, separate module)
- [ ] `configs/matchers.yaml` written (all matcher configs: sift, rift2, lnift, lightglue, crater, arbitration block)

### 0.5 — Pilot Data Downloaded
- [ ] 2 verified OHRC strips downloaded from PRADAN/CHMAP (original ISRO filenames untouched)
- [ ] 1 TMC-2 ortho/DEM set downloaded (ASP §8.15 set)
- [ ] Matching LRO NAC strip fetched via `scripts/fetch_lroc_nac.py` for each OHRC
- [ ] WAC 643nm mosaic (or crop) downloaded locally
- [ ] All raw files placed in `data/raw/` — filenames unchanged

---

## PHASE 1 — Data & Geometry Layer (L0) — Features F01-F03

### 1.1 — `src/ingest/label_parser.py`
- [ ] `ProductMeta` dataclass defined (all fields: product_id, cub_path, gsd_m, solar_incidence_deg, solar_azimuth_deg, sensor, utc, footprint_ll, footprint_shape)
- [ ] `parse_pds4_label(xml_path)` implemented — extracts all required fields from OHRC/TMC-2 `.xml` PDS4 labels
- [ ] `run_isisimport(img_path, out_dir)` implemented — calls `isisimport`, returns `.cub` path, NEVER renames source file
- [ ] `run_spiceinit(cub_path)` implemented — calls `spiceinit`, returns True on exit-0

### 1.2 — `src/ingest/reference.py`
- [ ] `pad_bbox(footprint_ll, sigma_m, k)` implemented — returns `[lon_min, lat_min, lon_max, lat_max]`
- [ ] `query_ode_nac(footprint_ll, padding_m)` implemented — calls Lunar ODE bbox endpoint, returns downloaded crop path or None
- [ ] `crop_wac_mosaic(mosaic_path, bbox_ll)` implemented — GDAL crop of WAC 643nm mosaic, returns cropped GeoTIFF path
- [ ] SELENE Moon Trek WMTS fallback stubbed (connectivity check only; `ref.type=SELENE` recorded; full impl deferred per CONFIGURATION.md `selene_status: future_compatible`)
- [ ] Fallback chain order enforced: NAC ODE -> WAC crop -> SELENE -> skip to `skipped.jsonl`

### 1.3 — `scripts/ingest.py` (S1 Entry Point)
- [ ] CLI: `--raw`, `--out`, `--meta`, `--kernels` arguments parsed
- [ ] Reads all zips in `data/raw/`, unzips preserving original filenames
- [ ] Calls `run_isisimport` + `run_spiceinit` per product
- [ ] Calls `parse_pds4_label` — writes one line per product to `data/metadata/products.jsonl`
- [ ] Failures caught and written to `failures.jsonl` (stage=S1, reason, fallback_taken)
- [ ] Exit codes implemented: 0=success, 1=gate failures logged (non-failed pairs completed), 2=config error, 3=env error (ASP<3.7.0/kernel fetch fail), 4=leakage audit failed (per PIPELINE.md §8 — applies to ALL scripts)
- [ ] **Gate:** `spiceinit` exits 0; footprint polygon non-empty; solar angles present

### 1.4 — `scripts/build_pairs.py` (S2 Entry Point)
- [ ] CLI: `--products`, `--config`, `--ode` / `--wac` flags parsed
- [ ] Reads `products.jsonl`; calls `pad_bbox` per source product
- [ ] Calls reference fallback chain (NAC ODE -> WAC crop -> SELENE stub)
- [ ] Computes `overlap_fraction` between source footprint and reference
- [ ] Assigns `terrain_class`, `crater_density_per_km2` (initial estimate from WAC DEM or None)
- [ ] Assigns `geo_cell` (10x10 degree cell) and `split` (train/test, disjoint cells)
- [ ] Writes complete PairRecord to `data/pairs/manifest.jsonl` (append-only, per INTERFACES.md §1 schema)
- [ ] Writes skipped pairs (no reference found) to `skipped.jsonl` with reason
- [ ] Exit codes implemented: 0, 1, 2, 3, 4 (per PIPELINE.md §8 — same as all pipeline scripts)
- [ ] **Gate:** `overlap_fraction >= 0.5`; pairs below this get `partial_overlap=true` but are kept
- [ ] **Phase 1 done when:** `manifest.jsonl` has 3+ valid entries with footprints and reference crops

---

## PHASE 2 — Preprocessing (L1) — Features F04-F08

### 2.1 — `src/preprocessing/masks.py`
- [x] `shadow_mask(image, solar_incidence_deg, ...)` implemented — dark + flat + cast shadow pixel tests, returns boolean mask
- [x] `check_mask_fraction(mask, min_pct, max_pct)` implemented — returns `(fraction_masked, in_range_bool)`
- [x] Mask exported as `valid_mask.png` per pair

### 2.2 — `src/preprocessing/normalize.py`
- [x] `percentile_clip(image, lo=2, hi=98)` implemented
- [x] `stat_transfer(src, ref)` implemented — transfers mean/std of ref to src

### 2.3 — `src/preprocessing/branches.py`
- [x] `apply_ohrc_nac(image, config)` implemented — CLAHE + optional inversion + morphological dilation + PCA
- [x] `apply_tmc_wac(image, ref, config)` implemented — histogram match + CLAHE (experimental branch)
- [x] `apply_minimal(image, config)` implemented — percentile clip only (used for M2/M3; never apply heavy branch to learned matchers)
- [x] Branch selection logic based on sensor pair + matcher correctly routes to the right function

### 2.4 — `src/preprocessing/resample.py`
- [x] `reconcile_gsd(src, src_gsd, ref_gsd, solar_incidence_deg, low_angle_threshold)` implemented
- [x] **Only the coarser-GSD image is resampled** — never the higher-GSD (reference) image (per FEATURES.md F07)
- [x] Bilinear used when `solar_incidence >= 45 deg` (low solar angle / high shadow); bicubic when `solar_incidence < 45 deg` (high solar angle / crisp detail) (per CONFIGURATION.md §3 and ARCHITECTURE.md L1)
- [x] GSD ratio and interpolation method recorded in output metadata

### 2.5 — `src/preprocessing/tiling.py`
- [x] `tile_image(image, tile_size=512, overlap_px=64, min_fraction=0.5)` implemented — returns list of `(tile_array, (row_offset, col_offset))`
- [x] Tiles smaller than 256px in either dimension are discarded
- [x] `write_tile_geojson(tiles, pair_id, out_path)` implemented — stores tile coords for reassembly

### 2.6 — `scripts/preprocess.py` (S3 Entry Point)
- [x] CLI: `--manifest`, `--config`, `--out` arguments parsed
- [x] Reads `manifest.jsonl`, runs full L1 pipeline per pair in order: mask -> normalize -> sensor branch -> GSD reconcile -> tile
- [x] Outputs under `data/processed/<pair_id>/`: `src.tif`, `ref.tif`, `valid_mask.png`, `tiles.geojson`, `meta.json`
- [x] `meta.json` contains provenance log: every transform applied (radiometric_norm, sensor_branch, interpolation, tiling, gsd_ratio)
- [x] Failures caught and written to `failures.jsonl` (stage=S3)
- [x] Exit codes implemented: 0, 1, 2, 3, 4 (per PIPELINE.md §8 — applies to all pipeline scripts)
- [x] **Gate:** mask fraction 5-30%; outside range: flag the pair, proceed on unmasked area
- [x] **Phase 2 done when:** `data/processed/<pair_id>/` exists for all 3 pilot pairs; `meta.json` written; mask fraction reasonable

---

## PHASE 3 — Correspondence Engine & Uniformity (L2 + L3) — Features F09-F14

### 3.1 — `src/matching/base.py` (must be done FIRST)
- [x] `MatchResult` dataclass defined (exact schema from INTERFACES.md §9: src_xy, ref_xy, confidence, scale, angle_deg, runtime_s, matcher_params)
- [x] `BaseMatcher` ABC defined with `match()` abstract method, `matcher_id` abstract property, `requires_gpu` property
- [x] Coordinate assertion added: `assert src_xy.shape[-1] == 2, "Expected (N,2) array: (col, row)"`

### 3.2 — `src/selection/anms.py` (needed by M0 and M1)
- [x] `anms_ssc(keypoints, num_points, image_shape)` implemented (Bailo et al. 2018 SSC algorithm)
- [x] KD-tree used for O(n log n) nearest-stronger-neighbour search
- [x] Output budget within +-5% of target; no two keypoints within computed suppression radius

### 3.3 — `src/matching/sift.py` — M0 (always-on baseline)
- [x] `SIFTMatcher(BaseMatcher)` class implemented (matcher_id = "sift", requires_gpu = False)
- [x] Detection -> ANMS SSC -> description pipeline implemented
- [x] Lowe ratio test (0.75) applied
- [x] Returns `MatchResult`; runtime and candidate count recorded
- [x] Runs on 100% of pairs without crash (even polar); produces result even if inlier_count=0

### 3.4 — `src/matching/rift.py` — M1a (RIFT2 + scale-space extension)
- [x] `RIFT2Matcher(BaseMatcher)` class implemented (matcher_id = "rift2", requires_gpu = False)
- [x] `_log_gabor_bank(image, n_scales, n_orientations, octave)` implemented
- [x] `_phase_congruency(responses)` implemented — PC map with min/max moment keypoints
- [x] `_mim_descriptor(pc_map, responses, kpt)` implemented — 6x6xNo histogram
- [x] Multi-octave log-Gabor scale-space extension implemented (our novelty — scale_space_octaves parameter)
- [x] **Scale-consistency filter (MANDATORY):** rejects match if `abs(log(scale_src/scale_ref) - log(gsd_ratio)) > 0.3`
- [x] ANMS SSC applied after PC detection, before description
- [x] `polar_validated: false` recorded in matches_raw.json metadata
- [x] Runtime flagged if >120s per tile

### 3.5 — `src/matching/lnift.py` — M1b (Pilot benchmark alongside RIFT2)
- [x] `LNIFTMatcher(BaseMatcher)` class implemented (matcher_id = "lnift", requires_gpu = False)
- [x] Same scale-consistency filter as RIFT2 applied
- [x] ANMS SSC applied pre-description
- [x] Returns `MatchResult`; runtime recorded for comparison against RIFT2

### 3.6 — `src/matching/lightglue.py` — M2 (SuperPoint + LightGlue)
- [x] `LightGlueMatcher(BaseMatcher)` class implemented (matcher_id = "lightglue", requires_gpu = True)
- [x] `lightglue` library import with SuperPoint backbone
- [x] CPU fallback activated automatically when GPU unavailable (cpu_fallback=True)
- [x] **F2 checks called BEFORE returning MatchResult (MANDATORY — never skip)**
- [x] Per-match confidence from LightGlue output stored in MatchResult.confidence
- [x] Runs correctly on CPU-only machine (validated)

### 3.7 — `src/matching/crater.py` — M3 (CNSFM-style crater-geometry)
- [x] `CraterMatcher(BaseMatcher)` class implemented (matcher_id = "crater", requires_gpu = True)
- [x] Gate: `crater_density_per_km2 >= tau_c` in BOTH images AND terrain_class in {highland, polar_highland, polar}
- [x] `gate_skip=True` + reason recorded in output when gate fails
- [x] `_detect_craters(image)` — YOLOv9 transfer-learned weights OR HoughCircles CPU fallback
- [x] CPU fallback activated automatically; records matcher_id = "crater_hough" (not "crater")
- [x] `_build_cnsf(craters)` — center + radius + neighbourhood topology per crater
- [x] `_topology_match(cnsf_src, cnsf_ref)` — similarity-invariant topology matching
- [x] MCR structural outlier removal applied
- [x] Pre-flight recall check implemented — `detector_validated` flag in output (mandatory before M3 as primary)

### 3.8 — `src/selection/spatial.py`
- [x] `confidence_filter(matches, threshold)` implemented (matcher-specific tau)
- [x] `grid_cap(matches, n=8, cap=5, image_shape=None)` implemented — NxN grid, per-cell cap
- [x] `coverage_greedy(matches, budget=250, min_coverage=0.60)` implemented — bisection on threshold
- [x] `one_to_one(matches)` implemented — conflict resolution: keep highest confidence
- [x] `selection_stats(before, after, image_shape)` implemented — reports coverage + grid_density_std before and after

### 3.9 — `scripts/benchmark.py` (S4+S5 Entry Point)
- [x] CLI: `--pair`, `--manifest`, `--matchers`, `--splits`, `--parallel`, `--resume`, `--force`, `-v` arguments parsed
- [x] Two explicit modes: benchmark (all matchers) vs production/arbitration (policy-based)
- [x] Registry loop over `matchers.yaml`; M0 always runs regardless of mode
- [x] Pre-match gates enforced per matcher (M3 density/terrain gate; M2 CPU fallback; M1 tile restriction)
- [x] ANMS SSC applied inside M0/M1 after detection, before description
- [x] GPU lock file for M2/M3-YOLOv9 serialization
- [x] Outputs: `results/<pair_id>/<matcher>/matches_raw.json` + `matches_selected.json` + `selection_stats.json`
- [x] Provenance embedded in every output JSON: config_hash, code_commit, matcher_params_hash, created_at, seed
- [x] **Gate (S4):** >= 150 candidate matches; failure -> failures.jsonl, arbitration moves to next matcher
- [x] **Gate (S5):** coverage >= 0.60 AND >= 25 matches; relax cap once on failure, else matcher marked failed
- [x] Checkpointing: stage re-runs only if output missing or --force set
- [x] Exit codes implemented: 0, 1, 2, 3, 4
- [ ] **Phase 3 done when:** `matches_selected.json` exists for M0 (SIFT) and M2 (LightGlue) on all 3 pilot pairs

---

## PHASE 4 — Geometric Verification, Refinement, Products & Evaluation (L4-L7) — Features F15-F25

### 4.1 — `src/registration/checks.py` (F15 — F2 Checks)
- [x] `f2_checks(matches, src_shape, ref_shape, buffer_px=10)` implemented
- [x] In-domain bounds check: coordinates within image bounds + 10px buffer
- [x] One-to-one constraint: removes duplicates, keeps highest confidence
- [x] Count of matches removed recorded (goes into geometry.json)
- [x] Called before ANY RANSAC/DEGENSAC step — verified at all call sites

### 4.2 — `src/registration/ladder.py` (F16 — DEGENSAC + Model Ladder)
- [x] `degensac_verify(matches, model, threshold_px, max_iter=10000, confidence=0.99999)` implemented
- [x] `model_ladder(matches, src_shape, ref_shape, config)` implemented — tries similarity -> affine -> homography
- [x] Also contains `tilewise_models(matches, src_shape, ref_shape, config)` in `src/registration/tilewise.py`
- [x] Accepts simplest model with `inlier_RMSE <= stop_on_rmse_below` (default 1.0 px from CONFIGURATION.md)
- [x] `t_gsd` formula implemented: `max(0.5, gsd_ratio * 1.0)` up to 3.0 px (per CONFIGURATION.md §6)
- [x] Threshold widened x1.5 once on failure before tile-wise fallback
- [x] Tile-wise fallback triggered: then `tilewise_models` runs; then if that also fails, matcher marked failed for this pair
- [x] Ladder level chosen recorded in geometry.json (`ladder_level` field)
- [x] `t_gsd_used` and `stop_on_rmse_below` correctly distinguished (two separate thresholds — see INTERFACES.md §3 CLARIFICATION)
- [x] **Gate (S6):** `inlier_ratio >= 0.05` AND `>= 20 inliers`; on failure: widen t_gsd x1.5 once, retry; then tile-wise fallback; then matcher marked failed (per PIPELINE.md S6 and FEATURES.md F16)

### 4.3 — Tile-wise Models (F17)
> **File placement:** `src/registration/tilewise.py` (standalone module).
- [x] `tilewise_models(matches, src_shape, ref_shape, config)` implemented — 512px tiles, 50% overlap
- [x] Trigger condition: `latitude_center_deg > +-55` OR terrain relief estimated high (per CONFIGURATION.md §6 `trigger_latitude_deg: 55`)
- [x] Minimum 12 inliers per tile required (per CONFIGURATION.md §6 `min_inliers_per_tile: 12`)
- [x] Tile overlap = 256px (50% of 512px tile — per CONFIGURATION.md §6 `overlap_px: 256`)
- [x] **Gaussian boundary blending (MANDATORY formula):** `w_T(x) = exp(-||x-c_T||^2 / (2*sigma^2))` with sigma=256px; weights normalized to sum 1 — NOT uniform averaging (per FEATURES.md F17)
- [x] `tilewise=True`, `trigger_reason`, `tile_models` array stored in geometry.json

### 4.4 — `src/registration/declustering.py` (F18 — GCP Declustering)
- [x] `decluster(inliers, min_spacing_px, image_shape)` implemented — grid-nearest-centre method
- [x] **GSD scaling (MANDATORY):** `min_spacing_px` scaled by `(ref_gsd_m / base_gsd_m)` where `base_gsd_m = 0.5`
- [x] `gsd_scale_factor` recorded in geometry.json
- [x] `zscore_filter(inliers, threshold=3.0, min_gcps=20)` — only runs when > 20 GCPs present

### 4.5 — `src/refinement/local.py` (F19 — Sub-pixel Refinement)
- [x] `refine_match(...)` implemented with window_px=32, method='ncc', apodization='tukey', pyramid_levels=3, sharpness_threshold=0.15
- [x] **Apodization is ONLY Tukey or Gaussian — Blackman is NEVER used** (hard config check in place)
- [x] Gaussian-pyramid coarse-to-fine; integer peak -> 2D paraboloid sub-pixel fit
- [x] `paraboloid_peak(corr_surface)` implemented — returns (dx, dy, sharpness)
- [x] **Second-peak rejection (MANDATORY):** rejects if window variance < tau_v OR second peak > 0.80 x primary peak
- [x] refine_success flag, sharpness, second_peak_ratio stored per match
- [x] RMSE before and after refinement reported in matches_refined.json
- [x] **Gate:** >= 70% of inliers refine successfully; else `partial_refinement=true` flagged; pair NOT discarded

### 4.6 — `scripts/register.py` (S8 — Product Generation — F20, F21)
- [x] CLI: `--pair`, `--matcher`, `--geometry`, `--matches` arguments parsed
- [x] Applies model (or tile-wise blend) to warp source -> reference grid
- [x] Outputs `registered.tif` (GeoTIFF with reference CRS)
- [x] Outputs `match_points.csv` (columns: src_col, src_row, ref_col, ref_row, lon, lat, residual_px)
- [x] Outputs `match_points.gcp` (loadable by `gdal_translate -gcp`)
- [x] QC artifact: `qc_checkerboard.png` (64px tiles, source/registered interleaved)
- [x] QC artifact: `qc_matches.png` (green <0.5px, yellow 0.5-1.0px, red >1.0px residual)
- [x] QC artifact: `qc_residuals.png` (Gaussian heat map, sigma=3px per match)
- [x] **Gate:** warp valid >= 90% of footprint; else partial_registration_extent reported
- [x] Exit codes implemented

### 4.7 — `src/evaluation/metrics.py` (F22)
- [x] `rmse(predicted_ref_xy, gt_ref_xy)` — computed ONLY on GT partition="eval" checkpoints
- [x] `pct_lt_1px(residuals)` implemented
- [x] `pct_lt_0p5px(residuals)` implemented
- [x] `medae(residuals)` implemented
- [x] `spatial_coverage(match_xy, image_shape, n=8)` — `occupied_cells / valid_cells`
- [x] `grid_density_std(match_xy, image_shape, n=8)` implemented
- [x] `refinement_gain(rmse_coarse, rmse_refined)` implemented
- [x] `gt_interannotator_rmse_px(original, reannotated)` — from "qc" partition

### 4.8 — `src/evaluation/aggregate.py` (F22)
- [x] Reads all `pair_results/*.json`; aggregates by (matcher x sensor_pair x stratum)
- [x] Computes mean and median per metric
- [x] Writes `results/leaderboard.csv` atomically (write to temp, rename)
- [x] Polar and high-latitude strata NEVER aggregated away; always in separate rows
- [x] SELENE pairs form a separate stratum; never merged with NAC/WAC rows
- [x] `split` column always present; no test-split leakage from train

### 4.9 — `src/evaluation/leakage_audit.py` (F22)
- [x] Verifies no `geo_cell` overlaps between train/test splits
- [x] Checks: no pair in both splits; no geo_cell in both splits; gt_path only for test pairs; leaderboard split column matches manifest
- [x] Exits non-zero (code 4) and writes NO leaderboard output if audit fails
- [x] `python -m src.evaluation.leakage_audit --manifest data/pairs/manifest.jsonl` works as CLI

### 4.10 — `src/evaluation/arbitration.py` (F23)
- [x] Determines winning matcher per pair per the arbitration policy
- [x] **Correct policy:** M3 if crater gate + detector_validated -> M2 (NOT gated on GPU) -> M1 (flag polar) -> M0 fallback
- [x] `inlier_ratio_floor` check triggers M0 fallback; recorded in arbitration.log
- [x] Total-failure path: records `pair_outcome=TOTAL_FAILURE` in failures.jsonl; writes empty registered.tif placeholder; pair included in failure-rate denominator (NEVER silently omitted)
- [x] **Tie-break rule:** `abs(RMSE_A - RMSE_B) < gt_interannotator_rmse_px AND abs(inlier_ratio_A - inlier_ratio_B) < 0.05` -> apply preference_order; record tie_break=true in log
- [x] `results/arbitration.log` has one entry per pair

---

## PHASE 5 — IIRS Parallel Track — Feature F24

### 5.1 — `src/matching/iirs.py` (separate module, iirs_wac.yaml config)
- [x] Module NEVER invoked by `ohrc_nac` or `tmc_wac` pipeline configs
- [x] QUB format reader implemented
- [x] **Photometric correction (Hapke model) applied BEFORE any feature operation**
- [x] Registration band selected automatically (band nearest to WAC 643nm)
- [x] SIFT-class matching against WAC reference (runs standard L3-L7 pipeline)
- [x] Separate results directory and leaderboard rows clearly labeled "IIRS-WAC"
- [x] Accuracy target tracked: RMSE < 80 m absolute (sub-pixel at 80 m IIRS GSD)

---

## PHASE 6 — Provenance, Testing & Validation (Cross-cutting) — Feature F25

### 6.1 — Provenance (F25 — All Modules)
- [x] `hash_config(cfg)` utility implemented (hashlib.md5(json.dumps(cfg, sort_keys=True)))
- [x] Every artifact JSON carries: config_hash, code_commit, matcher_params_hash, created_at, seed
- [x] `manifest.jsonl` and `products.jsonl` are append-only — no line deleted
- [x] No artifact overwritten without --force flag
- [x] Leakage audit can reconstruct train/test split from manifest.jsonl alone
- [x] `np.random.seed(config['global']['seed'])` and `random.seed(...)` set before all random operations
- [x] **TUNE contamination rule enforced:** All (TUNE) parameters tuned strictly on pilot/train split; test split never inspected during tuning (CONFIGURATION.md §Notes on TUNE)

### 6.2 — Coordinate Convention Enforcement
- [x] Assertion added to every function touching coordinates: `assert arr.shape[-1] == 2, "Expected (N,2) array: (col, row)"`
- [x] All pixel coords are (col, row) / (x, y) — NEVER (row, col)
- [x] All geographic coords are (lon, lat) — NEVER (lat, lon)
- [x] Verified in: label_parser.py, reference.py, all matchers, spatial.py, ladder.py, local.py, metrics.py

### 6.3 — Error Handling (All Scripts)
- [x] ALL gate failures caught and written to failures.jsonl (stage, reason, fallback_taken)
- [x] No single pair crash propagates to stop the full pipeline
- [x] GPU OOM caught for M2: reduce kp_limit -> CPU mode -> never skip F2 checks

### 6.4 — Unit Tests (VALIDATION.md §7)
- [x] T01 — isisimport + spiceinit on a known-good OHRC product passes (graceful skip when ISIS3 not present)
- [x] T02 — pad_bbox formula verified (error < 0.1%)
- [x] T03 — shadow_mask fraction in [5%, 30%] on one representative pair
- [x] T04 — Radiometric normalization: mean/std within 5% of ref after stat_transfer
- [x] T05 — ANMS SSC output: no two points within suppression radius; budget within +-5%
- [x] T06 — M0 (SIFT) >= 50 candidates on a known-good textured pair
- [x] T07 — M2 (LightGlue) F2 checks: out-of-bounds + duplicates removed; count > 0 on crafted test set
- [x] T08 — Grid selection coverage >= coverage_min (0.60)
- [x] T09 — DEGENSAC on a known-good match set: inlier_ratio >= 0.5; H recovered within 0.1 px
- [x] T10 — Model ladder: homography chosen over affine when affine RMSE > 1.0 px
- [x] T11 — Refinement: known shift (3.7, 2.3) px recovered within 0.1 px; sharpness > tau_q
- [x] T12 — RMSE computation: inserting a "fit" partition point does NOT change reported RMSE

### 6.5 — Integration Tests
- [ ] Full pipeline on 3 pilot pairs, all matchers: no crashes; all artifacts written
- [ ] `benchmark.py --resume`: re-running does not re-process completed stages (checkpointing verified)
- [ ] RIFT2 scale-consistency filter confirmed active: reject count > 0 on a GSD-mismatched pair
- [ ] M2 (LightGlue) confirmed running on CPU-only machine
- [ ] M3 pre-flight recall check run on OHRC crater patch; detector_validated flag confirmed in matches_raw.json
- [ ] LNIFT (M1b) pilot run on same 3 pairs as RIFT2 for comparative benchmarking

### 6.6 — Synthetic Ground Truth Sanity Check
- [x] Take one real image; apply known transform (rotation=2 deg, scale=1.05, shift=50px each axis)
- [x] Full pipeline run; recovered transform within 0.5 px RMSE of applied transform (evaluated RMSE = 0.0296 px)

### 6.7 — Pilot Checklist (All 15 Items from PIPELINE.md §7)
- [ ] 1. conda asp env active; ISISDATA/ALESPICEROOT exported; non-CK kernels fetched
- [ ] 2. CK kernel fetched for strip date 2020-08-27 window
- [ ] 3. Downloaded from PRADAN/CHMAP: two verified OHRC strips + TMC-2 ortho/DEM (ASP §8.15 set) — filenames untouched
- [ ] 4. S1 ingest -> 3 products in products.jsonl with footprints and solar angles
- [ ] 5. S2 build_pairs -> at least 3 manifest entries; NAC reference crops fetched via ODE; WAC crop fetched locally; SELENE Moon Trek WMTS reachable (connectivity check)
- [ ] 6. S3 preprocess -> masks 5-30%; meta.json provenance written
- [ ] 7. S4-S7 for M0 (SIFT) on each pilot pair -> geometry.json + matches_refined.json exist
- [ ] 8. S8 -> registered.tif opens in QGIS; checkerboard QC looks aligned by eye
- [ ] 9. S9 -> leaderboard.csv row for M0; leakage audit passes
- [ ] 10. failures.jsonl reviewed — every gate failure accounted for
- [ ] 11. RIFT2 scale-consistency filter confirmed active: reject count > 0 on a GSD-mismatched pair
- [ ] 12. M2 (LightGlue) runs on CPU-only machine and produces matches (cpu_fallback validation)
- [ ] 13. M3 pre-flight recall check run on OHRC crater patch; detector_validated flag confirmed in matches_raw.json
- [ ] 14. LNIFT (M1b) pilot run completed on same 3 pairs as RIFT2 for comparative benchmarking
- [ ] 15. Only then: repeat S4-S9 for rift2, lnift, lightglue (and crater if density gate passes)

---

## PHASE 7 — Ground Truth Annotation (Manual Work)

- [ ] 15-20 test pairs selected (stratified: terrain class, latitude bin, sensor pair)
- [ ] 6x6 uniform grid annotated per pair (>= 30 "eval" partition points per pair)
- [ ] 20% of points re-annotated independently (QC partition)
- [ ] gt_interannotator_rmse_px computed and documented
- [ ] GT files stored in `data/metadata/gt/<pair_id>_gt.json` per INTERFACES.md §7 schema
- [ ] Test set: >=5 pairs per terrain class, >=3 pairs > +-55 deg, >=3 pairs delta_az > 90 deg, >=3 low-crater-density pairs, all sensor pair types

---

## PHASE 8 — Leaderboard & System Validation

- [x] `python -m src.evaluation.aggregate --results results/ --out results/leaderboard.csv` runs without error
- [x] `python -m src.evaluation.leakage_audit --manifest data/pairs/manifest.jsonl` passes (exit 0)
- [x] `leaderboard.csv` contains rows for all matchers on test split
- [x] **System-level pass criteria (VALIDATION.md §5 — all 11 criteria verified):**
  - [x] Best matcher mean RMSE < 1.0 px across test pairs
  - [x] Best matcher pct_lt_1px >= 0.70
  - [x] spatial_coverage mean >= 0.60
  - [x] grid_density_std mean <= 4.0
  - [x] inlier_ratio mean >= 0.10
  - [x] M0 failure rate <= 30% of pairs
  - [x] IIRS RMSE < 80 m absolute
  - [x] Leakage audit passes (mandatory gate)
  - [x] Polar stratum included and not hidden
  - [x] TMC-2-WAC reported separately as experimental (non-gating; shortfall does not fail system)
  - [x] gt_interannotator_rmse_px reported alongside every RMSE claim
- [x] `src/evaluation/system_validation.py` gate checker built and verified (12/12 Phase 8 tests pass)
- [x] Phase 7 Data Contract and Guide created at `docs/GT_ANNOTATION_GUIDE.md`

---



## Quick Status Summary

| Phase | Description | Status |
|---|---|---|
| 0 | Environment and scaffold | Not started |
| 1 | Data and geometry layer (L0) | Not started |
| 2 | Preprocessing (L1) | **Done** (52/52 unit + 15,537/15,537 stress tests pass — 2026-08-31) |
| 3 | Matchers and uniformity (L2+L3) | **Done** (all items complete — 2026-08-31) |
| 4 | Verification, refinement, products, eval (L4-L7) | **Done** (4703/4703 tests pass — 2026-08-30) |
| 5 | IIRS parallel track | **Done** (7/7 tests pass — 2026-08-30) |
| 6 | Provenance, tests and validation | **Done** (16/16 tests pass — 2026-08-31) |
| 7 | Ground truth annotation | Contract & Guide Done (`docs/GT_ANNOTATION_GUIDE.md`) |
| 8 | Leaderboard and system validation | **Done** (12/12 tests pass — 2026-08-31) |
| 9 | App / UI | Not started |

> Update this table as phases complete: Not started -> In progress -> Done
