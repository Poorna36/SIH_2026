# 🌕 Synthetic Lunar Benchmark & Training Dataset Guide

**Project:** SIH 2026 PS-26166 — Cross-Sensor Lunar Image Registration & Georeferencing  
**Target Sensors:** Chandrayaan-2 (OHRC / TMC-2) vs. LRO (NAC / WAC)  
**Scripts:** [`scripts/generate_synthetic_pairs.py`](file:///Abhi/Projects/SIH/scripts/generate_synthetic_pairs.py), [`scripts/run_full_benchmark.py`](file:///Abhi/Projects/SIH/scripts/run_full_benchmark.py)

---

## 1. Why Synthetic Data is Essential

In lunar remote sensing, **true sub-pixel ground truth does not exist naturally**. Unlike Earth aerial mapping, there are no physical survey markers, GPS stations, or millimeter-calibrated GCPs (Ground Control Points) on the lunar surface. 

If we only evaluated registration against manually clicked points, human annotator error ($\approx 0.8\text{–}1.5\text{ px}$) would be larger than the target precision ($\text{RMSE} < 0.50\text{ px}$).

### Key Advantages of Synthetic Generation:
1. **Mathematically Exact Ground Truth**: The geometric transformation matrix $\mathbf{H}_{\text{true}}$ is known with double-precision accuracy. Every pixel checkpoint has an analytical reference location with zero annotator bias.
2. **Controlled Parameter Isolation**: We can isolate and stress-test specific sensor and orbit phenomena independently:
   - Pure rotation ($0^\circ \to 180^\circ$)
   - Scale disparity ($0.4\times \to 3.0\times$ GSD jumps)
   - Extreme grazing illumination ($>80^\circ$ solar incidence at polar craters)
   - Projective tilt & shear from oblique spacecraft pointing
3. **Reproducible Benchmark Standard**: Allows automated continuous regression testing and algorithm leaderboard generation across all candidate matchers.

---

## 2. Dataset Scale: How Many Images Do We Need?

Depending on the task (Benchmarking vs. Deep Learning Training), the data requirements differ:

### A. Benchmarking & Leaderboard Validation (30 to 60 Pairs)
* **Goal**: Statistically evaluate matcher performance (SIFT, RIFT2, LNIFT, LightGlue, Crater) against the competition threshold ($\text{RMSE} < 0.50\text{ px}$).
* **Recommended Volume**: **30 to 60 stratified pairs** ($512\times 512$ or $1024\times 1024$).
* **Stratification Breakdown**:
  * 10× Equatorial Mare (baseline low/medium texture)
  * 10× Equatorial Highland (high relief, 15°–45° rotation)
  * 10× Polar Highland (extreme grazing shadows, low sun angle)
  * 10× Multi-scale GSD Jumps (1.5× to 2.5× resolution mismatch)
  * 10× Extreme Illumination Inversion (opposite solar azimuths)
  * 10× Projective Tilt & Oblique Terrain

### B. Machine Learning & YOLOv9 Crater Detection Training (2,000 to 5,000 Patches)
* **Goal**: Train/fine-tune deep learning feature detectors (SuperPoint, YOLOv9 crater detector) to generalize across all lunar lighting conditions.
* **Recommended Volume**: **2,000 to 5,000 augmented patches** ($640\times 640$).
* **Augmentations Required**:
  * Random 3D crater insertion and shadow synthesis.
  * Contrast stretching, high-pass filtering, and log-normal noise.
  * Point spread function (PSF) blurring to simulate optical sensor defocus.

---

## 3. Mathematical Formulation of the Simulation

### A. Geometric Transformation
For each synthetic pair, a ground truth homography matrix $\mathbf{H}_{\text{true}} \in \mathbb{R}^{3 \times 3}$ is constructed:

$$\mathbf{H}_{\text{true}} = \mathbf{T}(c_x, c_y) \cdot \mathbf{P} \cdot \mathbf{S}(\gamma_x, \gamma_y) \cdot \mathbf{K}(s_x, s_y) \cdot \mathbf{R}(\theta) \cdot \mathbf{T}(-c_x, -c_y)$$

Where:
* $\mathbf{T}$: Translation to image center $(c_x, c_y)$
* $\mathbf{R}(\theta)$: Rotation by angle $\theta \in [0^\circ, 360^\circ]$
* $\mathbf{K}(s_x, s_y)$: Scale factor $s \in [0.4, 2.5]$
* $\mathbf{S}(\gamma_x, \gamma_y)$: Affine shear matrix $\begin{bmatrix} 1 & \gamma_x & 0 \\ \gamma_y & 1 & 0 \\ 0 & 0 & 1 \end{bmatrix}$
* $\mathbf{P}$: Projective tilt vector $[p_x, p_y]$ representing perspective off-nadir viewing.

### B. Sub-Pixel Ground Truth Checkpoint Mapping
Under OpenCV's coordinate convention, the reference image coordinate $\mathbf{x}_{\text{ref}}$ is mapped from the source coordinate $\mathbf{x}_{\text{src}}$ via the inverse homography:

$$\mathbf{x}_{\text{ref}} = \mathbf{H}_{\text{true}}^{-1} \cdot \mathbf{x}_{\text{src}}$$

Checkpoints are placed on a uniform sub-pixel grid across the source image and partitioned according to [`docs/GT_ANNOTATION_GUIDE.md`](file:///Abhi/Projects/SIH/docs/GT_ANNOTATION_GUIDE.md):
* **`partition: "eval"`** (70%): Held-out points strictly reserved for computing evaluation metrics ($\text{RMSE}_{\text{eval}}$, $\text{MAE}$, $\% < 0.5\text{ px}$).
* **`partition: "fit"`** (20%): Reserved for verifying geometric fitting sanity.
* **`partition: "qc"`** (10%): Injected with synthetic Gaussian annotator jitter ($\sigma = 0.5\text{ px}$) to compute baseline inter-annotator disagreement.

### C. Radiometric & Photometric Simulation
To accurately simulate Chandrayaan-2 OHRC vs. LRO NAC differences:
1. **Directional Illumination Shadowing**: Simulates low sun elevation by applying directional luminance ramps $\nabla I(\phi)$.
2. **Non-linear Photometric Distortion**: Applies non-linear gamma curves $I_{\text{out}} = I_{\text{in}}^\gamma$ where $\gamma \in [0.75, 1.35]$.
3. **Sensor Noise Injection**: Models sensor shot and read noise using combined Poisson-Gaussian noise:
   $$I_{\text{noisy}} = \text{Poisson}(I \cdot g) / g + \mathcal{N}(0, \sigma_n^2)$$

---

## 4. How to Generate the Dataset

### Step 1: Run the Generator Script
Generate 30 stratified benchmark pairs with exact sub-pixel GT metadata:

```bash
# Activate virtual environment
source .venv/bin/activate

# Generate 30 stratified pairs (512x512 patches)
python scripts/generate_synthetic_pairs.py --num-pairs 30 --patch-size 512
```

### Step 2: Generated Output Structure
The generator creates the following directory layout:

```
data/
├── metadata/
│   └── gt/
│       ├── synth_001_equatorial_mare_baseline_gt.json
│       ├── synth_002_equatorial_highland_rot15_gt.json
│       └── ...
├── pairs/
│   └── manifest.jsonl            <-- Appended with PairRecord entries
└── processed/
    └── synth_001_equatorial_mare_baseline/
        ├── src.tif               <-- Simulated Chandrayaan-2 OHRC image
        ├── ref.tif               <-- Simulated LRO NAC reference image
        ├── valid_mask.png        <-- Valid footprint mask
        └── meta.json             <-- Full simulation parameters and true H matrix
```

### Step 3: Run Multi-Matcher Benchmark & Leaderboard
Benchmark all matchers (SIFT, RIFT2, LNIFT, LightGlue) against the generated ground truth:

```bash
python scripts/run_full_benchmark.py --max-pairs 30
```

Results and leaderboard are automatically written to:
* Markdown Summary: `results/benchmark/benchmark_summary.md`
* Raw CSV Data: `results/benchmark/leaderboard.csv`

---

## 5. Summary Table for Friends / Team Members

| Question | Short Answer | Details |
|:---|:---|:---|
| **What is synthetic data?** | Controlled image pairs with mathematical ground truth | Generated by sampling calibrated lunar terrain and applying known homographies, rotations, GSD scale jumps, and shadow models. |
| **Why not just use real photos?** | Real photos have no sub-pixel ground truth | Without synthetic data, you cannot scientifically prove your algorithm achieves $< 0.50\text{ px}$ sub-pixel accuracy. |
| **How many benchmark images?** | **30 to 60 pairs** | Sufficient to test 6 distinct terrain strata across all matchers. |
| **How many training images?** | **2,000 to 5,000 patches** | Used when training or fine-tuning neural networks (YOLOv9, SuperPoint). |
| **Where are the scripts?** | [`scripts/generate_synthetic_pairs.py`](file:///Abhi/Projects/SIH/scripts/generate_synthetic_pairs.py) | Standalone, configurable script adhering to project schemas. |
