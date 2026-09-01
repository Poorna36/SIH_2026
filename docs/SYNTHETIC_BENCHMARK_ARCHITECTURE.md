# SIH26166 — SYNTHETIC GROUND-TRUTH BENCHMARK ARCHITECTURE (v3.0)

**Component-Wise Validation Track for the Entire Pipeline**

This document defines the deep architecture for the Synthetic Ground-Truth Benchmark. While it is highly capable of measuring exact sub-pixel accuracy, its primary purpose is to **rigorously evaluate the entire end-to-end pipeline, component by component.** 

By using hidden ground truth (GT), the benchmark isolates exactly where the pipeline succeeds or fails—from matcher selection (L1.5) down to sub-pixel refinement (L5).

**Core Alignment with SIH26166 Problem Statement**: The transformations generated in this benchmark are strictly derived from the problem statement: *"Multi-modal, Sun-angle & scale-invariant image correspondence using Chandrayaan-2 (OHRC / TMC-2 / IIRS) vs LRO (NAC / WAC)"*. Generic computer-vision augmentations are explicitly excluded in favor of physical, orbital-sensor-specific alterations.

---

## 1. Objective and Rationale

The objective is to measure the performance, survival rate, and exact coordinate accuracy of lunar correspondences at **every major stage** of the pipeline, using exact floating-point ground truth. 

**Component-Wise Goals**:
- **L1.5 (Matcher Selection)**: Validate if the MSM routes correctly under controlled synthetic difficulties.
- **L2 (Matchers)**: Measure pure feature-matching recall (how many GT points are found before filtering).
- **L3 (Optimization)**: Ensure spatial coverage filters do not aggressively prune true GT matches.
- **L4 (Geometric Verification)**: Measure MAGSAC/RANSAC precision/recall (does it correctly identify GT points as inliers?).
- **L5 (Sub-Pixel Refinement)**: Measure whether sub-pixel cross-correlation genuinely reduces Euclidean distance to the GT.

### Pipeline Interaction Flow
```text
 ┌──────────────────────────────────────────────────────────────┐
 │ 1. ANCHOR EXTRACTION (Hidden GT)                             │
 │    Real Lunar Source Image (e.g., NAC strip)                 │
 │    → 60–100 natural high-gradient float coordinates          │
 └──────────────┬───────────────────────────────────────────────┘
                │
 ┌──────────────▼───────────────────────────────────────────────┐
 │ 2. PHYSICAL TRANSFORMATION ENGINE                            │
 │    Applies exact geometric & radiometric shifts.             │
 │    → Synthetic target image + Exact transformed GT float pts │
 └──────────────┬───────────────────────────────────────────────┘
                │ (Passes images ONLY, GT is hidden)
 ┌──────────────▼───────────────────────────────────────────────┐
 │ 3. SIH CORRESPONDENCE PIPELINE EXECUTION                     │
 │    Runs standard matching (L1 to L6) blindly.                │
 └─┬─────────┬─────────┬─────────┬─────────┬────────────────────┘
   │         │         │         │         │
[L1.5 Out] [L2 Out]  [L3 Out]  [L4 Out]  [L5 Out]
   │         │         │         │         │
 ┌─▼─────────▼─────────▼─────────▼─────────▼────────────────────┐
 │ 4. COMPONENT-WISE METRICS & EVALUATION ENGINE                │
 │    Calculates exact Euclidean distance & survival rates      │
 │    at each discrete stage against the hidden GT.             │
 └──────────────────────────────────────────────────────────────┘
```

---

## 2. Transformation Constraints (Problem-Statement Driven)

To test the specific challenges of the SIH26166 project, transformations are restricted to those simulating the specific orbital mapping conditions of Chandrayaan-2 and LRO.

### 2.1 Included Transformations (Mandatory)
These transformations directly model the problem statement.

1. **Scale-Invariance (GSD Mismatches)**:
   - *Implementation*: Resampling source images using exact GSD ratios of the target sensors (e.g., OHRC 0.25m to NAC 1.0m is a 4.0x scale down, using Lanczos interpolation to avoid aliasing).
2. **Sub-Pixel Orbital Translation & Rotation**:
   - *Implementation*: Non-integer pixel shifts (`+0.42x, -0.71y`) and slight rotation (`±5°`) simulating yaw/pitch differences between spacecraft.
3. **Sun-Angle (Illumination) Invariance**:
   - *Implementation*: Phase-angle simulation (opposition surge modeling), gamma/contrast shifts simulating different solar incidence angles. Masking existing shadows and artificially extending them.
4. **Multi-Modal / Cross-Sensor Simulation**:
   - *Implementation*: Sensor-specific MTF (Modulation Transfer Function) blurring. Injecting pushbroom sensor noise (e.g., slight vertical striping).

### 2.2 Excluded Transformations (Removed)
- ❌ **Aggressive Perspective/Affine Warping**: Orbital imagery is near-nadir. We rely strictly on 2D translation, rotation, and uniform scaling.
- ❌ **JPEG Compression / Salt-and-Pepper Noise**: Not representative of PDS4/ISIS uncompressed scientific data.
- ❌ **Color Jitter**: Lunar surface data is monochromatic.

### 2.3 Limitations & Simulation Caveats
While geometric (translation, rotation) and scale transformations can be applied with exact physical math, the **photometric transformations** (illumination/shadow manipulation and IIRS noise models) remain *synthetic simulations*. 
- These simulations serve as controlled stress tests but **cannot perfectly replicate** the complex, physical radiometry and bidirectional reflectance (BRDF) of true multi-temporal lunar captures.
- The pipeline's performance on these synthetic photometric changes should be treated as a baseline robustness indicator, not a perfect digital twin of the Chandrayaan-2/LRO physical situation.

---

## 3. Component-Wise Evaluation Metrics (`eval_synthetic.py`)

The Evaluation Engine tracks the hidden GT points as they flow through the pipeline, generating a scorecard for each component.

### 3.1 GT ↔ Predicted Assignment
To make the evaluation unambiguous and prevent duplicate assignments from artificially inflating recall, a predicted correspondence $(p_{src}, p_{tgt})$ is assigned to a ground-truth anchor $(g_{src}, g_{tgt})$ following a strict one-to-one rule established *before* benchmark execution:
1. **Fixed Threshold**: Predictions must fall within a fixed maximum radius (e.g., `max_dist = 2.0` pixels).
2. **1-to-1 Constraint**: If multiple predictions fall near the same GT point, assignment is resolved globally using the **Hungarian algorithm** (or a greedy closest-first match) based on Euclidean distance.
3. **Unmatched Predictions**: Any duplicate predictions or predictions outside the radius are classified as false positives.

### 3.2 Component-Wise Scorecards

#### Stage 1: L1.5 - Matcher Selection Model (MSM)
- **Metric - Routing Accuracy (Oracle)**: Did the MSM select the oracle best matcher? The oracle "best" must be defined strictly a posteriori on the test set using the **exact composite metric** the MSM was designed to optimize: `argmax(0.5 × (1/GT_RMSE_norm) + 0.25 × GT_inlier_ratio + 0.25 × GT_spatial_coverage)`, evaluated on this specific synthetic pair.
- **Leakage Constraint**: The definition of the "best matcher" is strictly an *oracle/reference metric* for a posteriori analysis. The MSM is not expected to know this during inference. It must never leak test data into the MSM's features or training labels.
- **Goal**: Identifies if the LightGBM selector has blind spots under controlled synthetic difficulties compared to the theoretical upper bound (the oracle).

#### Stage 2: L2 - Correspondence Engine (Raw Matchers)
Evaluates M0 (SIFT), M1 (RIFT), M2 (LightGlue), and M3 (Crater) directly out of the matcher, before any optimization.
- **Metric - GT Recall (Capacity)**: Percentage of the 60-100 hidden GT points that were successfully detected and assigned.
- **Metric - Raw RMSE**: The base error of the matcher before model fitting.
- **Goal**: Answers "Which matcher inherently detects the most accurate correspondences under scale vs. illumination changes?"

#### Stage 3: L3 - Uniform Correspondence Optimization
Evaluates the ANMS (Adaptive Non-Maximal Suppression) and grid-based spatial coverage filters.
- **Metric - GT Survival Rate**: What percentage of the true GT matches (found in L2) survived the L3 spatial filtering?
- **Metric - False Positive Pruning**: Did L3 aggressively kill false matches while preserving the GT matches?
- **Goal**: Ensures our spatial uniformity logic isn't accidentally destroying high-quality true correspondences.

#### Stage 4: L4 - Geometric Verification (MAGSAC/DEGENSAC)
Evaluates the RANSAC-based geometric model fitting.
- **Metric - Inlier Precision**: Of the matches L4 declared as "Inliers", how many actually correspond to the exact GT points?
- **Metric - Inlier Recall**: Of the true GT matches present in the L3 output, how many did L4 correctly keep as inliers?
- **Metric - Pre-Refinement RMSE**: The exact coordinate error against the GT float coordinates.
- **Goal**: Validates if the Homography/Affine model ladder is correctly modeling the lunar surface without discarding valid topography.

#### Stage 5: L5 - Sub-Pixel Refinement
Evaluates the Phase Correlation / NCC local patch refinement.
- **Metric - Refinement Gain**: `Mean(L4_Euclidean_Error - L5_Euclidean_Error)` in pixels.
- **Metric - % Improved vs % Degraded**: Percentage of inliers that moved *closer* to the GT vs moved *further away*.
- **Metric - Sub-pixel KPIs**: % of final errors < 1.0 px, % < 0.5 px.
- **Goal**: Strongly demonstrates whether the NASA sub-pixel phase-correlation refinement improves registration accuracy on the defined benchmark conditions, serving as a powerful proxy for real Chandrayaan-2/LRO performance.

---

## 4. Deep Architectural Modules & Data Contracts

### 4.1 GT Anchor Extraction & Transformation Modules
- **`extract_anchors.py`**: 
  - **Phase 1 (Initial)**: Uses Shi-Tomasi corner detection across uniformly distributed grid cells to establish a baseline of natural tracking points with sufficient local gradient.
  - **Phase 2+ (Stratified Extraction)**: To prevent the benchmark from merely becoming a test of "Shi-Tomasi-friendly" features, extraction must eventually be stratified across specific morphological features: **high-gradient terrain → craters → ridges → maria → shadow boundaries → highlands → polar terrain**. This ensures a truly representative benchmark of lunar correspondence.
- **`transform_synthetic.py`**: Performs matrix math (`M = Trans * Scale * Rot`) and image resampling (`cv2.INTER_LANCZOS4`).

### 4.2 Data Contracts (Schema)

**Synthetic Pair Manifest (`synthetic_manifest.jsonl`)**:
```json
{
  "pair_id": "synth_ohrc_scale_rot_01",
  "base_image": "data/raw/ch2_ohr_nrp_...",
  "synthetic_image": "data/synthetic/synth_ohrc_scale_rot_01.tif",
  "parameters": {
    "scale_factor": 0.25,
    "rotation_deg": 2.3,
    "translation_px": [12.45, -8.72],
    "illumination_gamma": 1.4,
    "sensor_mtf_blur": 1.1
  },
  "random_seed": 42,
  "gt_points_file": "data/synthetic/gt/synth_ohrc_scale_rot_01_gt.json"
}
```

**Ground Truth Points (`..._gt.json`)**:
*(Never loaded by the matcher, only by the Evaluation Engine)*
```json
{
  "pair_id": "synth_ohrc_scale_rot_01",
  "points": [
    {"id": 1, "src_x": 1050.21, "src_y": 420.00, "tgt_x": 273.755, "tgt_y": 97.551},
    {"id": 2, "src_x": 2011.80, "src_y": 800.45, "tgt_x": 514.152, "tgt_y": 192.663}
  ]
}
```

---

## 5. Implementation Roadmap

1. **Phase 1: End-to-End Component Smoke Test**
   - Implement single-image exact sub-pixel translation (`+0.33x, +0.67y`).
   - Extract 5 natural Shi-Tomasi GT points.
   - Run pipeline, evaluate **L2, L3, L4, and L5 separately** against the GT.
2. **Phase 2: Scale & Rotation Suite (Geometric)**
   - Add rotation and exact uniform scaling reflecting OHRC/NAC and TMC/WAC GSD ratios.
3. **Phase 3: Sun-Angle & Cross-Sensor Suite (Photometric)**
   - Add illumination, shadow manipulation, and sensor-specific MTF/noise modeling.
4. **Phase 4: Full Benchmark Execution & Stratified Reporting**
   - Expand to the full 100-point sets across highlands, maria, and polar regions.
   - **Multiple Independent Samples**: A small handful of examples is insufficient for strong statistical claims. Each specific condition (e.g., severity level of illumination drop + scale) must be generated across at least **N=50** independent random seeds and image crops.
   - **Confidence Intervals**: The evaluation engine must compute and report 95% confidence intervals or variance (e.g., standard deviation) for all metrics, rather than just single point estimates.
   - Generate the final `synthetic_component_report.csv` detailing the survival rate and exact error at L1.5, L2, L3, L4, and L5 for every condition block.
