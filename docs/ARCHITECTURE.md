# SIH26166 — FINAL VALIDATED ARCHITECTURE v2.0

**Multi-modal, Sun-angle and scale-invariant image correspondence**
**Chandrayaan-2 (OHRC / TMC-2 / IIRS) vs LRO NAC/WAC / SELENE reference**

> **Status:** READY TO CODE (with fixes documented in this file)
> **Based on:** All 16 research documents in SIH_dump + adversarial review pass v2.0

---

## 0. Objective

Produce a generic software system that finds **spatially well-distributed, sub-pixel-accurate correspondences** between Chandrayaan-2 source imagery (OHRC/TMC-2/IIRS) and reference imagery (LRO NAC, LRO WAC, SELENE), robust to:

- Illumination/Sun-angle variation (up to 180 degree azimuth difference)
- Scale variation (GSD ratio up to ~17x for OHRC:TMC-2)
- Viewpoint and geometric variation
- Multi-sensor/multi-modal appearance differences
- Low-texture terrain, shadow, and spatial clustering of features

**Primary:** Maximum correspondence accuracy and robustness.
**Secondary:** Feasible implementation within hackathon constraints.

---
## 1. System Overview

The system is a **benchmark-first, pluggable matcher architecture** enhanced with an intelligent **Matcher Selection Model (MSM)** for production acceleration, and a dedicated **Synthetic Ground-Truth Benchmark** for component-wise validation. Eight major concerns are handled by dedicated components:

| Concern | Component |
|---|---|
| Data ingestion and geometry | L0 — Data and Geometry Layer |
| Appearance normalization | L1 — Preprocessing |
| Intelligent matcher routing | L1.5 — Matcher Selection Model (MSM) |
| Correspondence finding | L2 — Correspondence Engine (M0–M3) |
| Spatial uniformity enforcement | L3 — Uniform Correspondence Optimization |
| Geometric verification and sub-pixel accuracy | L4 + L5 |
| Products and evaluation | L6 + L7 |
| Component-wise validation with exact GT | Synthetic Ground-Truth Benchmark (v3.0) |

No component is included merely because it is modern or popular. Each solves a specific documented problem.

---

## 1.1 The 15 Architectural Fixes

| # | Fix | Description & Rationale | Source Evidence |
|---|---|---|---|
| F1 | **Dual-Stage Spatial Selection** | (a) Keypoint ANMS (SSC variant) *before* matching for sparse matchers; (b) match-level grid/coverage selection *after* matching for all matchers. | Supplementary research §1; LoFTR-SPP |
| F2 | **Mandatory Geometric Sanity Check** | In-image-domain bounds + one-to-one constraint enforced on every learned match set. | HybridPhaseCorrelation: LoFTR produces out-of-domain extrapolated matches |
| F3 | **Hierarchical Model Ladder** | Fit similarity → affine → homography → tile-wise local models in sequence. | SIFT-IIRS-WAC, DESCA, HybridPhaseCorrelation |
| F4 | **No Preprocessing Overspend** | Learned matchers skip heavy preprocessing (CLAHE/shadow normalization); matcher must carry illumination robustness. | Traditional-vs-DL: classical methods failed polar despite preprocessing |
| F5 | **Deep-Shadow Validity Masking** | Shadow/low-information mask computed from solar geometry + local variance before matching; masked pixels excluded. | KAZE (PC limit in textureless shadow); CNSFM |
| F6 | **DESCA Two-Tier Match Set** | Strict $NNDR \approx 0.7$ for initialization + loose $NNDR \approx 1.0$ as evaluation pool. | DESCA takeaway #5 |
| F7 | **Phase-Correlation Recipe** | Gaussian/Tukey apodization windows (never Blackman), Gaussian pyramid coarse-to-fine, 2D paraboloid peak fit. | HybridPhaseCorrelation takeaway #7 |
| F8 | **Multi-Metric Quality Proxy** | Match count is never a proxy for quality. RMSE, inlier ratio, and spatial coverage reported together on held-out points. | Traditional-vs-DL takeaway #6 |
| F9 | **Geographic Leakage Rule** | Benchmark splits by disjoint geographic cells ($10^\circ \times 10^\circ$ lon/lat), never random pair splits. | Standard ML hygiene |
| F10 | **Strict Provenance Rules** | Never rename ISRO `.img`/`.xml` products (breaks `isisimport`); use ASP $\ge 3.7.0$ conda env with per-orbit-date CK kernels. | ASP §8.15 Chandrayaan-2 example |
| F11 | **Terrain-Adaptive Arbitration** | Confidence-based fallback (learned $\to$ classical when learned confidence low; crater branch gated). | CNSFM; SuperGlue hybrid hypothesis |
| F12 | **Separate IIRS Track** | Photometric correction (incidence/emission/phase) $\to$ SIFT-class registration vs WAC; sub-80m target. | Supplementary research §7 |
| F13 | **Spatial Coverage First-Class Metric** | Grid density std-dev / percent cells populated measured alongside RMSE and inlier ratio. | Problem statement requirement; LoFTR-SPP |
| F14 | **Gated Crater Branch** | Crater-density check first ($\ge \tau_c$); branch activates only in crater-rich terrain. | CNSFM: 72.3% SR at south pole vs 31.2% baseline |
| F15 | **Geo-Cell Disjoint MSM Training** | MSM training uses geo-cell-disjoint splits (same F9 rule) and activates only after full benchmark validation. | Standard ML hygiene; prevents selector leakage |

---

## 2. Architecture Diagram

```
  Chandrayaan-2 source products              Reference products
  (PRADAN/CHMAP zips: .img+.xml PDS4,       LROC NAC EDR/CDR strips,
   IIRS QUB -- filenames NEVER changed)      WAC 643nm global mosaic (ISIS cube)
         |                                          |
         +------------------+---------------------+
                            v
 +-------------------------------------------------------------------+
 | L0  DATA AND GEOMETRY LAYER                                       |
 |  isisimport -> spiceinit (ASP >=3.7.0 env, per-date CK kernels)  |
 |  label/XML parser -> footprint (corner lat/lon), solar params,    |
 |  UTC, GSD;  padded bbox (2-5x pointing uncertainty)              |
 |  Reference query: Lunar ODE bbox / Moon Trek WMTS / GDAL crop    |
 +----------------------------+--------------------------------------+
                              v  PairRecord -> manifest.jsonl
 +-------------------------------------------------------------------+
 | L1  PREPROCESSING                                                 |
 |  Shadow/validity mask (solar geometry + local variance)           |
 |  -> radiometric normalization (percentile clip + stat transfer)   |
 |  -> sensor branch (OHRC->NAC: CLAHE;                             |
 |                    TMC-2->WAC: histogram-match + CLAHE;           |
 |                    learned matchers M2/M3: minimal only)          |
 |  -> tiling (overlapping, heterogeneity handling)                  |
 |  -> GSD reconciliation pyramid (coarser side resampled up)        |
 |  -> writes L1 meta.json (masked_fraction, patch stats, tiles)     |
 +----------------------------+--------------------------------------+
                              v  PairRecord + L1 meta.json
 +===================================================================+
 | L1.5  MATCHER SELECTION MODEL (MSM)                               |
 |  FeatureVector <- {sensor_pair, gsd_ratio, latitude_abs,          |
 |    delta_solar_azimuth, terrain_class, crater_density,            |
 |    masked_fraction, overlap_fraction, texture_contrast x 2,       |
 |    mean_gradient x 2, tile_count}  (13 features)                  |
 |  Model: LightGBM multi-class classifier (4 classes = matchers)    |
 |  -> SelectorResult {selected_matcher, confidence, fallback,       |
 |                    all_probs, routing_reason}                     |
 |  Routing:                                                         |
 |    confidence >= tau_high (0.65) -> run selected_matcher only     |
 |    confidence in [tau_low, tau_high) -> run fallback_matcher      |
 |    confidence < tau_low (0.40)  -> run all matchers (safe mode)   |
 |  Hard rules: M3 blocked if crater_density < tau_c;                |
 |              M2 blocked if no GPU                                 |
 |  Benchmark mode: selector bypassed; all matchers run              |
 +===================================================================+
                              v  routing decision
 +-------------------------------------------------------------------+
 | L2  CORRESPONDENCE ENGINE  (pluggable registry)                   |
 |                                                                   |
 |  M0  SIFT + ratio test + RANSAC   -- always runs, baseline/floor  |
 |  M1  RIFT/RIFT2 + scale-space ext -- classical illum-robust       |
 |  M2  SuperPoint + LightGlue       -- learned, GPU preferred       |
 |  M3  Crater-geometry (CNSFM-style)-- gated by crater density      |
 |                                                                   |
 |  Common interface: detect/describe/match -> kpts, matches, scores |
 |  ANMS (SSC) applied PRE-MATCH for sparse matchers (M0/M1):       |
 |    detect -> ANMS -> describe -> match                            |
 |  In MSM production mode: only the routed matcher(s) run           |
 +----------------------------+--------------------------------------+
                              v
 +-------------------------------------------------------------------+
 | L3  UNIFORM CORRESPONDENCE OPTIMIZATION                           |
 |  (a) ANMS pre-match for M0/M1 [already applied in L2]            |
 |  (b) Post-match: confidence filter -> NxN grid -> per-cell cap   |
 |      -> coverage-aware greedy selection -> one-to-one fix         |
 |  Reports coverage before AND after; spatial distribution metric   |
 +----------------------------+--------------------------------------+
                              v
 +-------------------------------------------------------------------+
 | L4  GEOMETRIC VERIFICATION AND MODEL ESTIMATION                   |
 |  in-domain bounds check + one-to-one constraint (mandatory F2)   |
 |  -> DEGENSAC / MAGSAC++ (degeneracy-aware, flat terrain safe)    |
 |  -> model ladder: similarity -> affine -> homography              |
 |  -> tilewise local models (fallback for >+/-55 lat / high relief) |
 |  -> GCP declustering (min spacing + Z-score residual filter)      |
 |  Optional DESCA DE-refinement (affine-only, two-tier sets)        |
 +----------------------------+--------------------------------------+
                              v
 +-------------------------------------------------------------------+
 | L5  SUB-PIXEL REFINEMENT                                          |
 |  Per-inlier local patch NCC or phase-only correlation;            |
 |  Gaussian/Tukey apodization (never Blackman);                     |
 |  Gaussian pyramid coarse-to-fine; 2D paraboloid peak fit          |
 |  -> sub-pixel coordinate upgrade; reject low-sharpness peaks      |
 +----------------------------+--------------------------------------+
                              v
 +-------------------------------------------------------------------+
 | L6  PRODUCT GENERATION                                            |
 |  warp -> registered GeoTIFF;  match-points CSV + GCP list;        |
 |  checkerboard + overlay + residual heat-map QC images             |
 +----------------------------+--------------------------------------+
                              v
 +-------------------------------------------------------------------+
 | L7  EVALUATION HARNESS  (decides the winning matcher)             |
 |  RMSE (held-out GT), pct<1px, pct<0.5px, MedAE, inlier cnt/ratio,|
 |  spatial coverage, grid-density std-dev, runtime;                 |
 |  precision/recall/matching-score where GT allows -> leaderboard   |
 |  -> MSM training labels (train split only)                        |
 |  -> MSM benchmark: selector accuracy, RMSE degradation,          |
 |    runtime reduction, fallback rate (F15)                         |
 +-------------------------------------------------------------------+

  Parallel IIRS track (separate module):
    IIRS QUB -> photometric correction -> SIFT-class match vs WAC
    -> target: sub-pixel at 80 m GSD (sub-80 m RMSE absolute)
```

---

## 3. Layer Specifications

### L0 — Data and Geometry Layer

**Inputs:** PRADAN/CHMAP zips (.img + .xml PDS4; IIRS = QUB).
Original filenames preserved — isisimport depends on original names.

**Processing:**
1. Unzip to data/raw/ (keep ISRO naming, e.g. ch2_ohr_nrp_20200827T0030107497_d_img_d18)
2. isisimport -> .cub; spiceinit/CSM via ASP-bundled ISIS + ALE + USGSCSM. CK kernels fetched per orbit-date window only (never the 200 GB full set)
3. Label/XML parser -> per-product metadata: corner lat/lon footprint, solar incidence and azimuth, UTC, GSD, product_id
4. Padded bbox = footprint expanded by k x sigma_pointing (k=2-5, sigma approx 500-2000 m)
5. Reference acquisition: Lunar ODE bbox query for NAC strips; GDAL crop of local WAC 643nm mosaic for WAC patches

**Output:** PairRecord appended to manifest.jsonl (full schema in INTERFACES.md)

**Failure modes and fallbacks:** Missing CK kernels -> date-window fetch; NAC strip does not cover full footprint -> record overlap_fraction, allow partial; ODE returns nothing -> WAC crop fallback; still none -> skip pair to skipped.jsonl

### L1 — Preprocessing

**Shadow/validity mask:** Per-pixel dark + flat + cast shadow tests (solar incidence geometry + local variance). Exported as valid_mask.png; ALL downstream stages respect it. Matches whose support patches touch the mask are dropped.

**Radiometric normalization:** 2/98 percentile clip -> min-max -> mean/std transfer toward reference. Cheap, detector-agnostic.

**Sensor branches (research-validated):**
- OHRC->NAC: CLAHE -> optional inversion -> morphological dilation -> PCA
- TMC-2->WAC: histogram-match + CLAHE (research gap — treat as experimental, A/B it)
- M2/M3 (learned): minimal preprocessing only — heavy branches demonstrably fail to rescue classical matchers and add unnecessary perturbation for learned ones

**Tiling:** Overlapping tiles (tiles smaller than half the grid are discarded); per-tile processing handles scene heterogeneity.

**GSD reconciliation:** Pyramid resampling of the coarser-GSD image; interpolation method selected conditionally on solar geometry — bilinear for low-angle/high-shadow, bicubic for high-angle/high-detail (MoonMetaSync finding).

**Provencance & Feature Stats Export:** Outputs `meta.json` recording masked fraction, patch texture contrast, mean gradients, and non-discarded tile count for MSM feature extraction.

### L1.5 — Matcher Selection Model (MSM)

**Purpose:** Eliminate the compute cost of running all matchers in production by dynamically routing each image pair to its predicted optimal matcher pipeline (M0/M1/M2/M3) based on a 13-dimensional scene and sensor feature vector.

**Inputs:** PairRecord (manifest.jsonl) + L1 provenance (`meta.json`).

**Feature Vector (13 features):**
1. `sensor_pair_enc`: Encoded sensor pair {0: OHRC-NAC, 1: TMC-WAC, 2: IIRS-WAC}
2. `gsd_ratio`: GSD ratio $\text{GSD}_{\text{source}} / \text{GSD}_{\text{reference}}$
3. `latitude_abs`: Centroid absolute latitude $|lat| \in [0.0^\circ, 90.0^\circ]$
4. `delta_solar_azimuth`: Solar azimuth difference $|\Delta az| \in [0.0^\circ, 180.0^\circ]$
5. `terrain_class_enc`: Terrain encoding {0: highland, 1: maria, 2: polar, 3: mixed}
6. `crater_density`: Log crater density $\log(1 + \text{crater\_density})$
7. `masked_fraction`: Fraction of pixels masked by shadow/validity mask
8. `overlap_fraction`: Footprint overlap fraction $(0.0, 1.0]$
9. `src_texture_contrast`: Mean local standard deviation in $8\times 8$ windows (source)
10. `ref_texture_contrast`: Mean local standard deviation in $8\times 8$ windows (reference)
11. `src_mean_gradient`: Mean Sobel gradient magnitude (source)
12. `ref_mean_gradient`: Mean Sobel gradient magnitude (reference)
13. `tile_count`: Active tile count post-reconciliation

**Model & Routing Policy:**
- **Model:** LightGBM multi-class gradient boosted decision trees (`objective='multiclass'`, 4 classes).
- **Dual Confidence Routing:**
  - High confidence ($P_{max} \ge \tau_{high} = 0.65$): Execute predicted matcher only.
  - Medium confidence ($\tau_{low} \le P_{max} < \tau_{high}$): Execute primary + fallback matcher.
  - Low confidence ($P_{max} < \tau_{low} = 0.40$): Safe mode — run all eligible matchers.
- **Hard Rule Gating:**
  - M3 (Crater) blocked if `crater_density < tau_c` or terrain not in highland/polar.
  - M2 (LightGlue) downgraded to CPU or blocked if GPU required and unavailable.
  - IIRS pairs routed directly to dedicated IIRS module.
- **Benchmark vs Production Mode:** In benchmark mode, the MSM model records predictions for validation, but all matchers are run for complete evaluation. In production mode, only routed matchers run.

**Output:** `results/<pair_id>/selector.json` (contains `selected_matcher`, `confidence`, `fallback_matcher`, `matchers_to_run`, `routing_reason`).

### L2 — Correspondence Engine (pluggable)

All matchers implement one interface. Registry is config-driven. M0 always runs (fallback + baseline). Runtime recorded per pair.

**M0 — SIFT (baseline):** Tiled SIFT -> Lowe ratio 0.75 -> RANSAC homography. Fails at poles [DEMONSTRATED, CNSFM/Traditional-vs-DL]. Role: floor performance + tie-breaker.

**M1 — RIFT/RIFT2 + scale-space extension:** PC detection + MIM descriptor + multi-octave log-Gabor scale-space (our novelty to close RIFT's scale gap). 100% SR on 6 NRD datasets [DEMONSTRATED, RIFT]. Raw RMSE ~1.8-2.0 px -> L5 refinement required. Risk: 15-30x SURF runtime, one documented total failure.

**M2 — SuperPoint + LightGlue:** Pretrained (no lunar data needed); confidence per match; F2 checks mandatory [LoFTR/HybridPC finding]. Best single candidate on all conditions [DEMONSTRATED, Traditional-vs-DL].

**M3 — Crater-geometry (CNSFM-style):** YOLOv9 transfer -> CNSF construction -> similarity-invariant topology matching -> MCR structural outlier removal. Gated by crater density >= tau_c in BOTH images. 72.3% SR at lunar south pole [DEMONSTRATED, CNSFM].

### L3 — Uniform Correspondence Optimization

1. ANMS (SSC variant) applied pre-match inside M0/M1: detect -> ANMS -> describe -> match
2. Post-match confidence filter (matcher-specific tau)
3. NxN grid partition over source image
4. Per-cell cap: keep max-N highest-confidence matches per cell
5. Coverage-aware greedy selection: bisection on threshold to hit budget K; one-to-one conflict resolution
6. Report: coverage before/after, grid-density std-dev (mandatory metric, never optional)

### L4 — Geometric Verification and Model Estimation

- **F2 checks first:** in-domain bounds + one-to-one constraint on all learned matcher outputs (mandatory, not optional)
- **DEGENSAC** (degeneracy-aware RANSAC, safe for flat lunar terrain) or MAGSAC++ as alternative. 10,000 iter, 0.99999 confidence, threshold t_gsd per pair (0.5-3.0 px)
- **Model ladder:** similarity(4dof) -> affine(6dof) -> homography(8dof); accept simplest model with acceptable inlier RMSE
- **Tile-wise local models:** fallback for >+/-55 degrees latitude and high-relief terrain (piecewise affine/homography, 50% overlap, blended)
- **GCP declustering:** min 15-20 px spacing (grid-cell keep-nearest-center), Z-score residual filter (requires >20 GCPs)
- **Optional DESCA refinement:** DE-based affine refinement with two-tier match sets (strict NNDR=0.7 seed + loose NNDR=1.0 pool). Only where geometry is affine-like; skip on strong relief. Random DE initialization is a demonstrated failure mode — two-tier initialization is mandatory if DESCA is used.

### L5 — Sub-pixel Refinement

- Per-inlier local NCC or phase-only correlation in search window W around coarse match
- Gaussian or Tukey apodization (never Blackman — demonstrated worst choice per HybridPhaseCorrelation paper)
- Gaussian-pyramid coarse-to-fine; integer peak -> 2D paraboloid sub-pixel fit
- Reject refinements with low peak sharpness (P[0,0]/sum(3x3) < tau_q)
- Report RMSE before and after refinement (the gain is its own metric)

### L6 — Product Generation

- Warp source with fitted model(s) -> registered GeoTIFF on reference grid
- Match-points CSV + GCP list (pixel coords both images + lon/lat via reference georeferencing)
- QC: checkerboard overlay, match overlay, residual heat map

### L7 — Evaluation Harness

- Per (matcher x sensor-pair x stratum): RMSE on held-out GT checkpoints, pct<1px, pct<0.5px, MedAE, inlier count/ratio, spatial coverage, grid-density std-dev, refinement gain, runtime, precision/recall/matching-score where GT allows
- **Leakage policy:** splits by disjoint 10x10 degree geo-cells; split ID in manifest; every report states its split
- **Ground truth:** (1) manual 6x6-grid tie points on 15-20 pairs (30-50 points each, 20% QC re-annotation); (2) cross-method consistency adjudication; (3) LOLA/pc_align anchor where available
- Output: results/leaderboard.csv + per-pair JSON -> drives MSM training labels on train split and MSM validation on test split

---

## 4. Matcher Selection & Arbitration Policy

**Two execution modes — explicitly separated:**
- **Benchmark / Evaluation Mode (`--mode benchmark`):** All eligible matchers run on every pair in the test/validation set. The evaluation harness (L7) records complete ground truth metrics across all matchers to generate `leaderboard.csv` and oracle best-matcher labels for MSM training.
- **Production / Accelerated Mode (`--mode msm`):** The Matcher Selection Model (MSM at L1.5) evaluates the 13-dimensional scene feature vector and routes execution:

```
# MSM Production Routing & Escalation Logic
features = extract_msm_features(PairRecord, L1_meta)
hard_rule_filter(features)  # Blocks M3 if crater_density < tau_c; blocks M2 if no GPU

probs = msm_model.predict_proba(features)
p_max, selected_matcher = max(probs), argmax(probs)
p_second, fallback_matcher = second_max(probs)

if p_max >= tau_high (0.65):
    matchers_to_run = [selected_matcher]
    routing_reason = "high_confidence_single_matcher"
elif p_max >= tau_low (0.40):
    matchers_to_run = [selected_matcher, fallback_matcher]
    routing_reason = "medium_confidence_dual_matcher"
else:
    matchers_to_run = [M0, M1, M2, M3]  # Safe mode: benchmark all
    routing_reason = "low_confidence_safe_mode"

# Dynamic Escalation & Recovery:
# If selected_matcher fails S4 gate (< 150 candidates) or S6 gate (< 5% inliers):
#   1. Escalate immediately to fallback_matcher
#   2. If fallback_matcher also fails, fall back to M0 (SIFT baseline)
#   3. Total failure logged only if M0 also fails after widened t_gsd
```

---

## 5. IIRS Parallel Track

IIRS is a separate concern: hyperspectral (~80 m GSD, 250 bands, 0.8-5.0 um, QUB format). The panchromatic pipeline MUST NOT be used unmodified on IIRS.

**IIRS track:**
1. Photometric correction (incidence/emission/phase angle) before any feature operation
2. Select registration band (brightness peak for IIRS vs WAC 643nm)
3. SIFT-class matching against WAC reference
4. Same L3-L7 pipeline, but with WAC-resolution accuracy targets
5. Accuracy target: sub-pixel at 80 m GSD = sub-80 m RMSE absolute
6. Kept as a **separate module** with its own config (iirs_wac.yaml)

---

## 6. Repository Layout

```
SIH/
|-- ARCHITECTURE.md
|-- PIPELINE.md
|-- FEATURES.md
|-- INTERFACES.md
|-- CONFIGURATION.md
|-- VALIDATION.md
|-- IMPLEMENTATION_PLAN.md
|-- DECISIONS.md
|-- CHANGES.md
|-- SYNTHETIC_DATASET.md
|-- SYNTHETIC_BENCHMARK_ARCHITECTURE.md  # v3.0 — component-wise validation track
|-- configs/
|   |-- ohrc_nac.yaml
|   |-- tmc_wac.yaml
|   |-- iirs_wac.yaml
|   |-- matchers.yaml
|   |-- msm.yaml        # MSM model thresholds, hard gates & fallback configs
|   +-- synthetic_benchmark.yaml  # Synthetic GT Benchmark v3.0 configuration
|-- data/
|   |-- raw/            # ISRO zips, original filenames REQUIRED
|   |-- calibrated/     # ISIS .cub after isisimport/spiceinit
|   |-- reference/      # NAC strips, WAC mosaic + crops
|   |-- pairs/          # manifest.jsonl, skipped.jsonl
|   |-- synthetic/      # generated synthetic image pairs + hidden GT
|   |   |-- synthetic_manifest.jsonl
|   |   +-- gt/         # <pair_id>_gt.json (NEVER loaded by matcher)
|   +-- metadata/       # parsed labels, SPICE/kernel logs, gt/
|-- models/             # Trained MSM models (msm_v1.pkl, msm_v1_stats.json)
|-- src/
|   |-- ingest/
|   |-- preprocessing/
|   |-- selector/       # MSM Feature extraction & LightGBM inference
|   |   |-- features.py
|   |   +-- model.py
|   |-- geometry/
|   |-- matching/
|   |   |-- base.py
|   |   |-- sift.py
|   |   |-- rift.py
|   |   |-- lightglue.py
|   |   +-- crater.py
|   |-- selection/      # anms.py (SSC), spatial.py (grid+coverage)
|   |-- registration/   # DEGENSAC/MAGSAC, model ladder, declustering
|   |-- refinement/     # NCC/phase-corr, paraboloid peak fit
|   |-- synthetic/      # Synthetic benchmark: anchor extraction + transform engine
|   |   |-- __init__.py
|   |   |-- anchors.py  # GT anchor extraction (Shi-Tomasi + morphological)
|   |   +-- transforms.py  # Physical transform engine (GSD, shift, gamma, MTF)
|   +-- evaluation/     # metrics, leaderboard, leakage audit, msm_eval.py
|       +-- synthetic_eval.py  # Component-wise scorecard engine (L1.5–L5)
|-- scripts/
|   |-- ingest.py
|   |-- build_pairs.py
|   |-- preprocess.py
|   |-- benchmark.py
|   |-- train_msm.py
|   |-- register.py
|   |-- generate_synthetic_benchmark.py  # Synthetic pair generator (Phase 1–4)
|   |-- eval_synthetic.py                # Blind evaluation runner
|   +-- run_synthetic_benchmark.py       # Full orchestration + statistical reporting
|-- results/
|   |-- arbitration.log
|   +-- synthetic_benchmark/   # Component-wise scorecard outputs
|       |-- synthetic_component_report.csv
|       +-- synthetic_benchmark_summary.md
+-- app/                # UI only after pipeline is reliable
```

---

## 7. Research Evidence Map

| Component | Source |
|---|---|
| ANMS dual-stage selection | supplementary_research §1; LoFTR_IMC21 |
| DEGENSAC + F2 bounds check | LoFTR_IMC21; HybridPhaseCorrelation(2026) |
| Model ladder + tile-wise models + latitude limits | SIFT-IIRS-WAC; DESCA; HybridPhaseCorrelation |
| Heavy preprocessing does NOT rescue classical matchers | Traditional_vs_DeepLearning |
| Shadow masking + PC limits in zero-info regions | KAZE(2026); CNSFM |
| Phase-correlation refinement (Gaussian/Tukey, paraboloid) | HybridPhaseCorrelation(2026) |
| DESCA two-tier initialization requirement | DESCA(Dr.Sourabh) |
| Crater branch + gating + pole results | CNSFM |
| Learned matcher evidence (day-night, all conditions) | SuperGlue; Traditional_vs_DeepLearning |
| IIRS separate track + photometric correction | supplementary_research §7 |
| ASP/ISIS provenance, product IDs, CK kernels | supplementary_research §2; MoonMetaSync |
| Radiometric normalization as helper only | Radiometric_Normalization_Analysis |
| SIFT baseline (tiled, ratio, RANSAC, declustering) | SIFT-IIRS-WAC |
| RIFT scale-space extension as novelty | RIFT_extracted |
| Metric suite | HybridPhaseCorrelation; RIFT; SuperGlue |
| Benchmark-first pluggable design | Traditional_vs_DeepLearning |
| GSD-conditional interpolation | MoonMetaSync |

---

## 9. Synthetic Ground-Truth Benchmark (v3.0)

A dedicated **Component-Wise Validation Track** that evaluates the entire pipeline at each discrete stage against hidden mathematical ground truth. See [`docs/SYNTHETIC_BENCHMARK_ARCHITECTURE.md`](SYNTHETIC_BENCHMARK_ARCHITECTURE.md) for full specification.

### 9.1 Objective
Isolate exactly where the pipeline succeeds or fails — from matcher selection (L1.5) down to sub-pixel refinement (L5) — using exact floating-point GT derived from physical orbital-sensor conditions, not generic CV augmentations.

### 9.2 Transformation Constraints (Problem-Statement Driven)
All transformations simulate the specific orbital mapping conditions of Chandrayaan-2 and LRO:
- **Scale-Invariance**: Lanczos resampling at exact sensor GSD ratios (OHRC 0.25 m → NAC 0.5 m = 2.0×, etc.)
- **Sub-Pixel Translation & Rotation**: Non-integer shifts ±1.0 px, orbital yaw/pitch ±5°.
- **Sun-Angle Invariance**: Phase-angle gamma simulation (γ ∈ [0.7, 1.4]), directional shadow extension.
- **Cross-Sensor MTF Simulation**: Sensor-specific Gaussian blur σ ∈ [0.5, 1.5], pushbroom column noise.
- **Excluded**: Perspective warping, JPEG compression, salt-and-pepper noise, color jitter.

### 9.3 Component-Wise Scorecards (L1.5 → L5)
| Stage | Key Metrics |
|---|---|
| **L1.5 MSM** | Routing Accuracy vs. Oracle (composite: 0.5×RMSE⁻¹ + 0.25×inlier_ratio + 0.25×coverage) |
| **L2 Raw Matchers** | GT Recall (capacity), Raw RMSE |
| **L3 Spatial Filter** | GT Survival Rate, FP Pruning Rate |
| **L4 Geometric Verification** | Inlier Precision, Inlier Recall, Pre-Refinement RMSE |
| **L5 Sub-Pixel Refinement** | Refinement Gain (px), % Improved, % Degraded, % < 0.5 px |

### 9.4 Key Design Decisions
- **Hidden GT**: Anchor points are NEVER passed to the matcher. Only the Evaluation Engine loads them.
- **1-to-1 Hungarian Assignment**: Predictions matched to GT using `scipy.optimize.linear_sum_assignment` with radius τ = 2.0 px. Unmatched predictions are False Positives.
- **Statistical Rigour**: N=50 independent random seeds per condition. All metrics reported with 95% confidence intervals (±1.96 SE).
- **Leakage Guard**: Oracle best-matcher label is computed strictly a posteriori. MSM inference MUST NOT access GT metrics.

### 9.5 New Files
| File | Purpose |
|---|---|
| `docs/SYNTHETIC_BENCHMARK_ARCHITECTURE.md` | Full specification (v3.0) |
| `configs/synthetic_benchmark.yaml` | All tunable parameters |
| `src/synthetic/anchors.py` | GT anchor extraction |
| `src/synthetic/transforms.py` | Physical transformation engine |
| `src/evaluation/synthetic_eval.py` | Component-wise scorecard engine |

---

## 10. Limitations

1. RIFT M1 has one documented total failure — benchmark decides its role
2. LightGlue/SuperPoint trained on MegaDepth (Earth imagery) — domain gap is a measured risk; F2 checks + M0 fallback mitigate it
3. M3 crater branch explicitly fails in crater-sparse mare/melt terrain — crater-density gating handles this
4. Tile-wise models introduce blending seams — acceptable versus global model failure at poles
5. Sub-pixel accuracy is conditional on successful L5 refinement — reported as a separate metric
6. TMC-2->WAC preprocessing branch is the only sensor pair not confirmed in published literature — treat as experimental and A/B test it
7. GAN-based radiometric normalization is NOT included — it requires unavailable paired training data and operates only on already-registered mosaics

---

## 9. Implementation Safety Notice (for coding agents)

DO NOT:
- Redesign the architecture without documented justification
- Replace algorithms without research evidence
- Silently change coordinate conventions (see INTERFACES.md)
- Remove validation stages or confidence checks
- Bypass fallback logic
- Change thresholds arbitrarily (see CONFIGURATION.md)
- Rename ISRO product files (breaks isisimport)
- Use the full 200 GB CK kernel set (per-date window only)
- Apply heavy preprocessing to learned matchers M2/M3

If a genuine implementation problem is found:
1. Determine whether it is an implementation issue or an architecture issue
2. Preserve the architectural intent
3. Document the deviation explicitly
4. Do not silently alter system behavior
