# SIH26166 — PIPELINE v2.0

Executable pipeline runbook. The architecture (ARCHITECTURE.md) says WHAT each layer is; this file says HOW a pair flows through it.

Convention: every artifact is namespaced by pair_id (e.g. ohr_20200827T0030__nac_M123456789) and by matcher (sift | rift2 | lightglue | crater).

---

## 0. Pipeline at a Glance

```
data/raw/ (ISRO zips, original names -- never rename)
      | S1 ingest          scripts/ingest.py
      v
data/calibrated/*.cub  +  data/metadata/products.jsonl        [L0]
      |
      | S2 pair building   scripts/build_pairs.py
      v
data/pairs/manifest.jsonl  (+reference crops in data/reference/) [L0]
      |
      | S3 preprocessing   scripts/preprocess.py                 [L1]
      v
data/processed/<pair_id>/  {src.tif, ref.tif, valid_mask.png, tiles.geojson, meta.json}
      |
      | S4 matching        src/matching (registry loop)          [L2]
      v
results/<pair_id>/<matcher>/matches_raw.json
      |
      | S5 selection       src/selection (ANMS + grid/coverage)  [L3]
      v
results/<pair_id>/<matcher>/matches_selected.json  (+coverage stats)
      |
      | S6 verification    src/registration (DEGENSAC + ladder)  [L4]
      v
results/<pair_id>/<matcher>/geometry.json  (model, inliers, residuals)
      |
      | S7 refinement      src/refinement (NCC/POC + paraboloid) [L5]
      v
results/<pair_id>/<matcher>/matches_refined.json
      |
      | S8 products        scripts/register.py                   [L6]
      v
results/<pair_id>/<matcher>/  {registered.tif, match_points.csv, match_points.gcp, qc_*.png}
      |
      | S9 evaluation      src/evaluation                        [L7]
      v
results/leaderboard.csv  +  results/pair_results/*.json  +  arbitration.log
```

---

## 1. Stage Table

| Stage | Script/Module | Reads | Writes | Gate to Proceed |
|---|---|---|---|---|
| S0 setup | env setup, configs | — | working env + configs | asp env active, ISISDATA set |
| S1 ingest | scripts/ingest.py | data/raw zips | .cub + products.jsonl | spiceinit OK, footprint parsed |
| S2 pairs | scripts/build_pairs.py | products.jsonl, ODE/WMTS | manifest.jsonl + ref crops | overlap >= 0.5 recorded |
| S3 preprocess | scripts/preprocess.py | manifest entry | processed/<pair_id>/ | mask fraction 5-30% |
| S4 match | src/matching registry | processed patches | matches_raw.json | >= 150 candidates |
| S5 select | src/selection | matches_raw.json | matches_selected.json | coverage >= 0.60, >= 25 matches |
| S6 verify | src/registration | matches_selected.json | geometry.json | inlier_ratio >= 0.05, >= 20 inliers |
| S7 refine | src/refinement | geometry.json + patches | matches_refined.json | >= 70% refined |
| S8 products | scripts/register.py | matches_refined.json | tif/csv/gcp/qc | warp valid >= 90% |
| S9 evaluate | src/evaluation | all of the above | leaderboard.csv | leakage audit passes |

---

## 2. Stage Runbook

### S0 — Environment Setup (once)

```bash
conda create -n asp -c conda-forge -c usgs-astrogeology ames-stereo-pipeline
conda activate asp
export ISISROOT=$CONDA_PREFIX  ISISDATA=$HOME/projects/isisdata  ALESPICEROOT=$ISISDATA
downloadIsisData chandrayaan2 $ISISDATA --exclude="kernels/ck/**"
# fetch only the CK kernel window matching the strip dates:
rclone --config $ISISROOT/etc/isis/rclone.conf copy chandrayaan2:kernels/ck/ \
  $ISISDATA/chandrayaan2/kernels/ck/ \
  --include="ch2_att_27Jul2020_04Sep2020_v1.bc" -P
```

ASP version must be >= 3.7.0 (bundled ISIS 10.0.0 + ALE + USGSCSM with Chandrayaan-2 camera fixes).
Never use the full 200 GB CK kernel set.

### S1 — Ingest (L0)

```bash
python scripts/ingest.py --raw data/raw --out data/calibrated \
  --meta data/metadata/products.jsonl --kernels $ISISDATA
```

Steps per product:
- Unzip in place (never rename the files)
- isisimport -> .cub
- spiceinit (or CSM isd_generate)
- Parse .xml label -> record: footprint corners, solar incidence, solar azimuth, UTC, GSD, product_id
- Write one line to products.jsonl

Success gate: spiceinit exits 0; footprint polygon is non-empty; solar angles are present.

On failure:
- Missing CK kernel -> fetch ch2_att_*.bc covering the strip UTC; re-run S1
- isisimport crash -> verify original ISRO filenames are intact (do not rename)

### S2 — Pair Building (L0)

```bash
python scripts/build_pairs.py --products data/metadata/products.jsonl \
  --config configs/ohrc_nac.yaml --ode
python scripts/build_pairs.py --products data/metadata/products.jsonl \
  --config configs/tmc_wac.yaml --wac data/reference/wac_643nm.tif
```

Steps:
- Padded bbox: k x sigma_pointing (k from config, sigma approx 500-2000 m)
- Reference query chain (in order):
  1. NAC via Lunar ODE bbox search
  2. WAC 643nm GDAL crop (local mosaic)
  3. SELENE Kaguya TC/MI via Moon Trek WMTS bbox query (optional; see note)
- Compute overlap_fraction between source footprint and reference
- Record which reference type was used (ref.type: NAC | WAC | SELENE) in PairRecord
- Assign terrain_class, crater_density_per_km2, Δ-azimuth bin, latitude bin
- Assign geo_cell (10x10 degree cells) and split (train/test, disjoint cells)
- Append PairRecord to manifest.jsonl

SELENE note: Moon Trek WMTS serves Kaguya TC (10 m/px) and MI (62 m/px) by bbox query at no extra infrastructure cost. SELENE is a third reference type explicitly named in the SIH problem statement. Use it only when NAC and WAC both fail to cover the footprint. Mark pairs with ref.type=SELENE in INTERFACES.md PairRecord; they form a separate stratum in evaluation.

Success gate: overlap_fraction >= 0.5 (below that, keep pair, flag partial_overlap=true).

On failure:
- ODE returns no NAC strip -> try WAC crop
- WAC crop fails -> try SELENE Moon Trek WMTS query
- Still no reference -> skip pair, write to skipped.jsonl with reason

### S3 — Preprocessing (L1)

```bash
python scripts/preprocess.py --manifest data/pairs/manifest.jsonl \
  --config configs/ohrc_nac.yaml --out data/processed
```

Steps per pair:
1. Shadow/validity mask (dark + flat + cast shadow, per valid_mask.png)
2. Radiometric normalization (2/98 percentile clip, mean/std transfer)
3. Sensor branch (OHRC->NAC: CLAHE+PCA; TMC-2->WAC: histogram-match+CLAHE; learned matchers skip heavy branch)
4. Tiling (overlapping, tiles < half grid size are discarded)
5. GSD reconciliation pyramid (coarser side only; bilinear if low-angle, bicubic if high-angle)

Outputs under data/processed/<pair_id>/: src.tif, ref.tif, valid_mask.png, tiles.geojson, meta.json (provenance log of every transform applied).

Success gate: masked fraction between 5% and 30%. Outside this range: review thresholds, do not silently proceed.

Special case: if masked fraction > 30% (extreme polar scene), keep pair (it is a stratum), flag pair, matchers proceed on unmasked area only.

### S4 — Matching (L2)

```bash
python scripts/benchmark.py --pair <pair_id> --matcher sift
python scripts/benchmark.py --manifest data/pairs/manifest.jsonl \
  --matchers sift,rift2,lnift,lightglue,crater --splits test --parallel 4
```

Registry loop (configs/matchers.yaml). M0 always runs regardless of arbitration.

Pre-match gates:
- M3 (crater): crater_density_per_km2 >= tau_c in BOTH images AND terrain_class in {highland, polar_highland, polar}, else gate_skip=true. ALSO: GPU availability check — if no GPU, activate cpu_fallback: hough_circles.
- M3 pre-flight recall check: before M3 is used as primary on a new sensor (OHRC or TMC), run recall check on a small manually verified crater set for that sensor. YOLOv9 is only validated at 0.5 m/px NAC resolution; treat M3 as UNVALIDATED_PRIMARY until this check passes and record `detector_validated: false` in matches_raw.json.
- M2 (lightglue): M2 is eligible on CPU and GPU (cpu_fallback: true is active). GPU availability determines expected runtime only — it does NOT gate matcher eligibility. Do not skip M2 because of absent GPU.
- M1 (rift2 / lnift): tile-restricted to control runtime. M1 is NOT the designated illumination-robust default for polar pairs — Traditional_vs_DeepLearning demonstrates RIFT2 fails (❌) on OHRC-NAC Polar (same sensor, same condition). For CPU-only + low-crater-density + polar combinations, flag the pair as `no_validated_primary_matcher=true` in the result JSON; do not silently report an M1 result as trustworthy at poles.

ANMS (SSC variant) is applied inside M0/M1 after detection, before description:
  detect -> ANMS(budget=config.anms.budget) -> describe -> match

RIFT2 / LNIFT scale-consistency filter (applied before ANMS, inside rift.py):
  reject keypoint match if |log(scale_src / scale_ref) - log(gsd_ratio)| > 0.3
  where gsd_ratio = src.gsd_m / ref.gsd_m from the PairRecord.
  Rationale: this is the mechanism behind the D08 multi-octave scale-space novelty claim;
  without it the extension has no implementation.

Arbitration logic (corrected):
  if crater_density_per_km2 >= tau_c and terrain_class in {highland, polar_highland, polar}
      and detector_validated:
      primary = M3  # crater-geometry
  elif learned_confidence_ok:   # note: NOT gated on gpu_available
      primary = M2  # LightGlue (CPU or GPU)
  else:
      primary = M1  # RIFT2 or LNIFT (CPU-only fallback; flag if polar)
  # M0 always runs in parallel as baseline and fallback
  if primary.inlier_ratio < inlier_ratio_floor:
      fallback to M0; record in arbitration.log

Output per matcher: results/<pair_id>/<matcher>/matches_raw.json
  = list of {src_xy, ref_xy, confidence, scale, angle, gate_skip, detector_validated} + runtime + matcher params hash

Success gate: >= 150 candidate matches. On failure: record empty result in failures.jsonl; arbitration moves to next matcher.

### S5 — Uniform Correspondence Optimization (L3)

Applied to every matcher output. Never skipped.

```python
# src/selection/spatial.py
selected = confidence_filter(matches, tau)      # matcher-specific threshold
selected = grid_cap(selected, n=8, cap=5)       # per-cell max-N
selected = coverage_greedy(selected, budget=250) # bisection on threshold
selected = one_to_one(selected)                  # conflict resolution: keep higher confidence
metrics  = {
    coverage: occupied_cells / valid_cells,
    grid_density_std: std(counts_per_cell),
    before_count: len(matches),
    after_count: len(selected)
}
```

Outputs: matches_selected.json + selection_stats.json.

Success gate: coverage >= 0.60 AND >= 25 matches. On failure: relax cell cap once; if still below threshold, this matcher is marked failed for this pair.

### S6 — Geometric Verification (L4)

```python
# src/registration/ladder.py

# Step 1: mandatory F2 checks (especially for M2/M3)
selected = in_domain_check(selected, src_shape, ref_shape)
selected = one_to_one_enforce(selected)

# Step 2: model ladder
for model in [similarity, affine, homography]:
    M, inliers = degensac(selected, model, thr=t_gsd, iters=10000, conf=0.99999)
    if inlier_ratio(inliers) >= 0.05 and rmse(inliers) <= 1.0:
        break
else:
    # fallback: tile-wise local models
    M = tilewise_affine(selected, tile_size=512, overlap=0.5, min_inliers=12)

# Step 3: GCP declustering
inliers = decluster(inliers, min_spacing_px=20)
inliers = zscore_filter(inliers, threshold=3.0, min_gcps=20)
```

Outputs: geometry.json = model type + parameters + inlier indices + residuals + ladder level chosen + t_gsd used.

Success gate: inlier_ratio >= 0.05 AND >= 20 inliers. On failure: widen t_gsd x1.5 once, retry; then tile-wise fallback; then matcher marked failed.

### S7 — Sub-pixel Refinement (L5)

```python
# src/refinement/local.py
for each inlier:
    patch_ref = window(ref, ref_xy, W=32, apodization='tukey')  # never Blackman
    patch_src = window(src, src_xy, W=32, apodization='tukey')
    # NCC or phase-only correlation
    corr = ncc_or_poc(patch_src, patch_ref)
    # integer peak -> 2D paraboloid sub-pixel fit
    (dx, dy, sharpness) = integer_peak_paraboloid(corr)
    if sharpness >= tau_q:
        refined.append((src_xy, ref_xy + (dx, dy), sharpness, success=True))
    else:
        refined.append((src_xy, ref_xy, sharpness, success=False))

# Report: RMSE before and after refinement (the gain metric)
```

Outputs: matches_refined.json = refined coordinates + per-match delta + sharpness + success flag + before/after RMSE.

Success gate: >= 70% of inliers refine successfully. On failure: keep unrefined coordinates for those points; flag pair as partial_refinement=true; do not discard the pair.

### S8 — Product Generation (L6)

```bash
python scripts/register.py --pair <pair_id> --matcher <matcher> \
  --geometry results/<pair_id>/<matcher>/geometry.json \
  --matches results/<pair_id>/<matcher>/matches_refined.json
```

Steps:
- Apply model (or tile-wise blend) to warp source onto reference grid
- Resample to reference pixel grid
- Build match-points CSV (pixel coords both images)
- Build GCP list (pixel coords + lon/lat from reference georeferencing)
- Render QC artifacts: checkerboard overlay, match overlay, residual heat map

Outputs: registered.tif, match_points.csv, match_points.gcp, qc_checkerboard.png, qc_matches.png, qc_residuals.png.

Success gate: warp valid over >= 90% of footprint. On failure: report partial registration extent in result JSON.

### S9 — Evaluation (L7)

```bash
python -m src.evaluation.aggregate --results results/ --gt data/metadata/gt/ \
  --out results/leaderboard.csv
python -m src.evaluation.leakage_audit --manifest data/pairs/manifest.jsonl
```

Metrics per (pair x matcher):
- RMSE on held-out GT checkpoints
- pct_lt_1px, pct_lt_0p5px, MedAE
- inlier_count, inlier_ratio
- spatial_coverage, grid_density_std
- refinement_gain (RMSE before minus after L5)
- runtime_s
- precision, recall, matching_score (where GT allows)

Aggregation: mean and median per (matcher x sensor-pair x stratum). Polar and >+/-55-degree rows are NEVER hidden.

Arbitration log: which matcher won each pair and why (terrain, confidence, fallback event).

Leakage audit MUST pass before any leaderboard number is quoted.

---

## 3. Quality Gates Summary

| Stage | Gate | On Failure |
|---|---|---|
| S1 ingest | spiceinit OK; footprint non-empty | fix kernel; verify filename |
| S2 pairs | overlap >= 0.5 | allow partial, flag; skip if no reference at all |
| S3 preprocess | mask fraction 5-30% | flag, proceed on unmasked area |
| S4 match | >= 150 candidates | record failure; arbitration moves to next matcher |
| S5 select | coverage >= 0.60, >= 25 matches | relax cap once; else matcher failed for pair |
| S6 verify | inlier_ratio >= 0.05, >= 20 inliers | widen t_gsd once; tile-wise; else matcher failed |
| S7 refine | >= 70% refined | keep unrefined coords for failed points; flag pair |
| S8 products | warp valid >= 90% | report partial extent |
| S9 evaluate | leakage audit passes | fix manifest before publishing numbers |

---

## 4. Failure and Retry Matrix

| Symptom | Likely Cause | Action |
|---|---|---|
| spiceinit fails at S1 | missing/mismatched CK kernel window | fetch ch2_att_*.bc for strip UTC; re-run S1 |
| isisimport crashes at S1 | product file was renamed | restore original ISRO filename; re-run |
| ODE returns no NAC strip at S2 | footprint outside NAC coverage | fall back to WAC crop; if still none -> skipped.jsonl |
| mask fraction > 30% at S3 | extreme shadow (polar/low-sun) | keep pair (it is a stratum), flag, proceed on unmasked area |
| candidates < 150 at S4 | textureless mare or GSD mismatch | check GSD pyramid; try next matcher; record failure |
| coverage < 0.60 at S5 | matches clustered (crater cluster) | relax cell cap once; if still low, matcher failed |
| inlier_ratio < 0.05 at S6 | matcher noise or degenerate terrain | widen t_gsd x1.5 once; tile-wise fallback; next matcher |
| tile-wise model chosen at S6 | high relief or >+/-55 degrees | expected, not an error; ladder level recorded |
| refinement success < 70% at S7 | multimodal NCC peaks (repetitive terrain) | keep unrefined coords; flag pair |
| warp invalid > 10% at S8 | model extrapolation at edge | report partial; consider tile-wise model |
| GPU OOM (M2) | large patches | reduce kp_limit; run M2 on CPU (slower); never skip F2 checks |

---

## 5. Orchestration Rules

1. **Checkpointing:** each stage writes its artifact before the next starts; a stage re-runs only if its output is missing or --force is set.
2. **Resume — full state machine:**

| Pair state | Deepest artifact present | Resume action |
|---|---|---|
| EMPTY | nothing | run S1–S9 |
| INGESTED | products.jsonl entry | run S2–S9 |
| PAIRED | manifest.jsonl entry + ref crop | run S3–S9 |
| PREPROCESSED | data/processed/<pair_id>/ | run S4–S9 |
| MATCHED | matches_raw.json | run S5–S9 |
| SELECTED | matches_selected.json | run S6–S9 |
| VERIFIED | geometry.json | run S7–S9 |
| REFINED | matches_refined.json | run S8–S9 |
| REGISTERED | registered.tif + match_points.csv | run S9 only |
| EVALUATED | pair_results JSON | nothing; re-aggregate only |

A (pair, matcher) is marked DONE only when **all** of {matches_refined.json, geometry.json, registered.tif, pair_results JSON} exist. A missing intermediate (e.g. only matches_selected.json present) resumes from that intermediate — it does not restart from scratch.

3. **Parallelism:** pairs are independent — process-pool over pairs; GPU jobs (M2, M3-yolov9) serialized through a GPU lock file.
4. **Provenance:** every artifact JSON carries {config_hash, code_commit, matcher_params_hash, timestamps}; manifest.jsonl and products.jsonl are append-only.
5. **Determinism:** seeds fixed for RANSAC and selection; seed reported in results for reproducibility.
6. **Never silently drop:** every gate failure is recorded in results/failures.jsonl with stage, reason, and fallback taken.

---

## 6. CLI Quick Reference

```bash
# full benchmark, one config, all matchers, test split
python scripts/benchmark.py --config configs/ohrc_nac.yaml --splits test \
  --matchers sift,rift2,lightglue,crater --parallel 4

# resume after interruption
python scripts/benchmark.py --config configs/ohrc_nac.yaml --resume

# single pair, verbose, keep intermediates
python scripts/benchmark.py --pair <pair_id> --matcher rift2 --keep-intermediate -v

# evaluation only
python -m src.evaluation.aggregate --results results/ --gt data/metadata/gt/
```

---

## 7. Pilot Checklist (first 3 pairs, end-to-end)

1. [ ] conda asp env active; ISISDATA/ALESPICEROOT exported; non-CK kernels fetched
2. [ ] CK kernel fetched for strip date 2020-08-27 window
3. [ ] Downloaded from PRADAN/CHMAP: two verified OHRC strips + TMC-2 ortho/DEM (ASP §8.15 set) -- filenames untouched
4. [ ] S1 ingest -> 3 products in products.jsonl with footprints and solar angles
5. [ ] S2 build_pairs -> at least 3 manifest entries; NAC reference crops fetched via ODE; WAC crop fetched locally; SELENE Moon Trek WMTS reachable (connectivity check only at pilot stage)
6. [ ] S3 preprocess -> masks 5-30%; meta.json provenance written
7. [ ] S4-S7 for M0 (SIFT) on each pilot pair -> geometry.json + matches_refined.json exist
8. [ ] S8 -> registered.tif opens in QGIS; checkerboard QC looks aligned by eye
9. [ ] S9 -> leaderboard.csv row for M0; leakage audit passes
10. [ ] failures.jsonl reviewed -- every gate failure accounted for
11. [ ] RIFT2 scale-consistency filter confirmed active: reject count > 0 on a GSD-mismatched pair
12. [ ] M2 (LightGlue) runs on CPU-only machine and produces matches (cpu_fallback validation)
13. [ ] M3 pre-flight recall check run on OHRC crater patch; detector_validated flag confirmed in matches_raw.json
14. [ ] LNIFT (M1b) pilot run completed on same 3 pairs as RIFT2 for comparative benchmarking
15. [ ] Only then: repeat S4-S9 for rift2, lnift, lightglue (and crater if density gate passes)

---

## 8. Exit Codes

All scripts (`ingest.py`, `build_pairs.py`, `preprocess.py`, `benchmark.py`, `register.py`) return the following exit codes for CI/orchestration:

| Code | Meaning |
|---|---|
| 0 | All pairs completed successfully; all gates passed |
| 1 | One or more pairs failed at a gate; failures logged to failures.jsonl; non-failed pairs completed |
| 2 | Configuration error (missing config key, version mismatch, ISISDATA not set) |
| 3 | Environment error (ASP version < 3.7.0, SPICE kernel fetch failed, GPU OOM unrecoverable) |
| 4 | Leakage audit failed; no leaderboard output written |
