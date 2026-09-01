# SIH 2026 — PS-26166: Summary of Changes (MSM Integration)

This document details all architectural, pipeline, configuration, interface, and progress tracking changes introduced with the addition of the **Matcher Selection Model (MSM)** (Layer 1.5 / Stage 4.5).

---

## 1. Executive Summary of Changes

The Matcher Selection Model (MSM) feature introduces a lightweight LightGBM meta-model that predicts the optimal correspondence matching pipeline ($M_0\text{ SIFT}, M_1\text{ RIFT2/LNIFT}, M_2\text{ LightGlue}, M_3\text{ Crater}$) from a 13-dimensional scene/sensor feature vector. This cuts production execution time by $\ge 50\%$ while bounding accuracy loss ($\Delta\text{RMSE} \le 0.10\text{ px}$).

---

## 2. Modified & New Files Breakdown

### A. Progress & Task Tracking
* **`PROGRESS.md`**:
  * **Added `PHASE 5.5 — Matcher Selection Model (MSM) (L1.5 / S4.5) — Features F26-F27`** with 10 specific sub-tasks (5.5.0 through 5.5.9).
  * Documented existing code alterations required across `scripts/preprocess.py`, `scripts/benchmark.py`, `src/evaluation/leakage_audit.py`, and `src/evaluation/arbitration.py`.
  * Updated **Quick Status Summary** table with Phase 5.5 in `Planned` status (no code started).

### B. Core Architecture & Layer Specifications
* **`docs/ARCHITECTURE.md`**:
  * Added **L1.5 — Matcher Selection Model (MSM)** to the system overview table and master architecture diagram.
  * Added architectural fix **F15 (Geo-Cell Disjoint MSM Training)** to the 15 Architectural Fixes table.
  * Added detailed specification for Layer 1.5 (13-feature vector, LightGBM classifier, dual-threshold routing, hard rule gating, and fallback safe-mode).
  * Updated **Section 4 (Matcher Selection & Arbitration Policy)** to separate Benchmark Mode (`--mode benchmark`) from Production Mode (`--mode msm`).
  * Updated **Section 6 (Repository Layout)** to include `src/selector/`, `models/`, `configs/msm.yaml`, `scripts/train_msm.py`, and `src/evaluation/msm_eval.py`.

### C. Pipeline Runbook & Execution
* **`docs/PIPELINE.md`**:
  * Updated Pipeline at a Glance ASCII diagram to place **S4.5 selector** between S3 and S4.
  * Added **S4.5 MSM** row to the Stage Table.
  * Added **Section S4.5 Stage Runbook** detailing feature extraction, hard gating rules, LightGBM inference, confidence thresholds ($\tau_{high}=0.65, \tau_{low}=0.40$), and execution gates.

### D. Feature Specifications
* **`docs/FEATURES.md`**:
  * **Added Feature `F26 — Matcher Selection Model (MSM) & Feature Vector (L1.5)`**:
    * Full 13-feature schema definition (`sensor_pair_enc`, `gsd_ratio`, `latitude_abs`, `delta_solar_azimuth`, `terrain_class_enc`, `crater_density`, `masked_fraction`, `overlap_fraction`, `src_texture_contrast`, `ref_texture_contrast`, `src_mean_gradient`, `ref_mean_gradient`, `tile_count`).
    * Execution timing ($<100\text{ ms}$) and hashing requirements.
  * **Added Feature `F27 — Geo-Cell Disjoint MSM Training and Acceptance Evaluation`**:
    * Formalized the 8 Acceptance Criteria (AC1–AC8) on held-out test splits.

### E. Configuration Schemas
* **`docs/CONFIGURATION.md`**:
  * Added **Section 11 (Matcher Selection Model Configuration)** with full YAML schema for `configs/msm.yaml`:
    * Model and metadata paths (`models/msm_v1.pkl`, `models/msm_v1_stats.json`).
    * Confidence thresholds (`tau_high: 0.65`, `tau_low: 0.40`).
    * Hard gating toggles (`crater_density_gate`, `gpu_gate`, `iirs_track_gate`).
    * Safe-mode fallback policies.

### F. Interfaces & Data Contracts
* **`docs/INTERFACES.md`**:
  * Added **Section 10.1 (`MSMFeatureVector` Dataclass)** in `src/selector/features.py`.
  * Added **Section 10.2 (`SelectorResult` Dataclass & JSON Schema)** for `results/<pair_id>/selector.json`.

### G. Validation & Testing Protocols
* **`docs/VALIDATION.md`**:
  * Added MSM item to **Section 1 (What Must Be Validated)**.
  * Added MSM Accuracy (AC1) and Runtime Reduction (AC5) targets to **Section 5 (System-Level Pass Criteria)**.
  * Updated **Section 6 (Leakage Audit Protocol)** to support `--check-msm`.
  * Added regression test IDs **T13, T14, T15, T16** to **Section 7 (Regression Suite)**.
  * Added **Section 9 (Matcher Selection Model Acceptance Protocol)** detailing AC1 through AC8.

### H. Implementation Roadmap
* **`docs/IMPLEMENTATION_PLAN.md`**:
  * Added **Phase 5.5 (Matcher Selection Model Roadmap)** with tasks P5.5.0 to P5.5.8, defining concrete function signatures, module paths, training scripts, and production gates.

### I. Architecture Decision Records (ADRs)
* **`docs/DECISIONS.md`**:
  * Added **D15**: Placement of Matcher Selection Model at L1.5 / S4.5.
  * Added **D16**: LightGBM Multi-Class Classifier Framework for MSM.
  * Added **D17**: Dual Confidence Threshold Routing & Fallback Policy.
  * Added **D18**: Strict Geo-Cell Disjointness for MSM Training (F15).
  * Added **D19**: Operational Gate & Acceptance Criteria (AC1–AC8) for Production Activation.

---

## 3. Existing Code Modifications Planned

| Component / Script | Planned Modification |
|---|---|
| `scripts/preprocess.py` | Compute & store image texture contrast (`src_texture_contrast`, `ref_texture_contrast`), mean gradient magnitudes (`src_mean_gradient`, `ref_mean_gradient`), and active `tile_count` into `meta.json`. |
| `scripts/benchmark.py` | Add `--mode {benchmark,msm}` and `--msm-config`. In MSM mode, evaluate selector routing and dispatch only predicted matchers; dynamically escalate on candidate gate failure. |
| `src/evaluation/leakage_audit.py` | Add `--check-msm` to verify zero geographic cell overlap between MSM training set and held-out test splits. |
| `src/evaluation/arbitration.py` | Integrate selector provenance and routing metadata into `results/arbitration.log`. |

---

## 4. Deleted Artifacts

* **`MSM_FULL_ARCHITECTURE_MASTER.md`**: Deleted as its contents have been comprehensively merged into the canonical documentation (`docs/ARCHITECTURE.md`, `docs/PIPELINE.md`, `docs/FEATURES.md`, `docs/CONFIGURATION.md`, `docs/INTERFACES.md`, `docs/VALIDATION.md`, `docs/IMPLEMENTATION_PLAN.md`, `docs/DECISIONS.md`, and `PROGRESS.md`).
