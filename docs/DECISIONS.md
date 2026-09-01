# SIH26166 — DECISIONS v2.0

Architecture decision record (ADR). Every major design choice with evidence basis and alternatives rejected. Read this before changing any component.

---

## D01 — Benchmark-first, pluggable matcher architecture

**Decision:** No single matcher is declared "the answer." All matchers run; the harness picks the winner per stratum.

**Evidence:** Traditional_vs_DeepLearning_FeatureMatching.md demonstrates that no single method dominates across all terrain types, illumination conditions, and sensor pairs. SIFT dominates on textured equatorial regions; learned matchers dominate under large illumination changes; crater-geometry methods dominate at poles.

**Alternatives rejected:**
- Single-matcher fixed pipeline: rejected because benchmark evidence shows no single winner across all conditions (Traditional-vs-DL).
- Late selection without explicit harness: rejected because it hides per-stratum performance and prevents honest failure analysis.

---

## D02 — M0 (SIFT) always runs as baseline

**Decision:** SIFT runs on every pair regardless of which matcher is primary.

**Evidence:** SIFT-IIRS-WAC_extracted.md demonstrates SIFT achieves sub-pixel RMSE on direct IIRS-to-WAC Chandrayaan-2 pairs (mean 73 m across 200 strips). MoonMetaSync_extracted.md confirms SIFT outperforms ORB and hybrid fusions (IntFeat) on OHRC/TMC-2 data. Two independent confirmations on our exact sensors.

**Why it must always run:** If every other matcher fails (network unavailable, GPU OOM, low crater density, etc.), M0 always produces a result. It is the fallback of last resort AND the baseline metric.

**Alternatives rejected:**
- ORB as baseline: rejected — demonstrated lowest performance in two independent lunar benchmarks (MoonMetaSync).
- IntFeat (SIFT+ORB hybrid via PCA concat): rejected — demonstrated to underperform plain SIFT in all conditions while amplifying noise (MoonMetaSync, P4 evidence).

---

## D03 — LightGlue over SuperGlue as the learned matcher

**Decision:** SuperPoint + LightGlue (not SuperGlue) is M2.

**Evidence:** Additional_Resources.md: LightGlue is SuperGlue's official successor, same group, same architecture principle. ~16.9ms for easy pairs (adaptive depth/width), multiple front-end options, Apache-2.0 licensed, actively maintained in 2026, integrated into hloc and Hugging Face Transformers. SuperGlue.md confirms the underlying attention-based joint matching principle works across illumination conditions.

**Alternatives rejected:**
- SuperGlue alone: rejected — superseded by LightGlue from the same lab; harder to deploy; less maintained.
- LoFTR as primary: considered (LoFTR_IMC21.md — coarse-to-fine, detector-free, semi-dense); rejected because trained exclusively on MegaDepth (natural outdoor photos), no illumination/multi-sensor robustness by construction, and domain gap to lunar is large and unvalidated. LoFTR requires full retraining on lunar data to be reliable; LightGlue uses SuperPoint (also Earth-trained but more robust in practice per Traditional-vs-DL benchmark), and provides per-match confidence + F2 checks as safety net.
- RoMa: referenced in Additional_Resources as strong on extreme illumination; rejected for now — heavier deployment footprint, less documented on planetary imagery; keep as future upgrade candidate.

---

## D04 — DEGENSAC over standard RANSAC

**Decision:** DEGENSAC (or MAGSAC++) replaces standard RANSAC as the geometric verifier.

**Evidence:** LoFTR_IMC21.md: DEGENSAC explicitly guards against dominant-plane degeneracy (degenerate near-planar configurations) which is directly relevant to flat lunar mare and crater floors. Standard RANSAC fails silently on these configurations. HybridPhaseCorrelation(2026).md reinforces the need for robust geometric verification.

**Alternatives rejected:**
- Standard RANSAC: rejected — demonstrated to silently degenerate on near-planar scenes (exactly our terrain class); DEGENSAC adds negligible overhead.
- FSC (Fast Sample Consensus): considered (DESCA paper notes FSC is the best non-DE alternative); rejected — no degeneracy awareness; DEGENSAC is strictly more robust.
- DOC/MGEO (orientation-consistency filters): rejected — DESCA.md demonstrates these discard many true matches due to inconsistent feature orientations, directly reducing inlier count (P4 evidence from DESCA).

---

## D05 — Model ladder (similarity → affine → homography)

**Decision:** The simplest model that satisfies accuracy gates is selected per pair, not a fixed model.

**Evidence:** DESCA.md: global affine fails on mountainous terrain with local relief (Kathmandu OrbView-3 case, near-total failure). SIFT-IIRS-WAC_extracted.md: homography used only for tile-level inlier selection; final warp uses a separate polynomial fit to filtered GCPs. NASA_SubPixel_Refinement.md: single global model is conceptually insufficient for high-relief terrain.

**Decision detail:** The ladder accepts the simplest model with inlier RMSE <= 1.0 px. For high-latitude or high-relief pairs, tile-wise local models are triggered as fallback. This avoids overfitting a homography where a similarity is sufficient, while not failing on rugged terrain.

**Alternatives rejected:**
- Always homography: rejected — overfits on low-distortion pairs; more DoF = noisier estimates with sparse matches.
- Always affine: rejected — demonstrated failure on high-relief terrain (DESCA P4 evidence).
- Polynomial warp as primary: rejected — polynomial warp is a global model; still breaks at high latitude (SIFT-IIRS-WAC: RMSE near-exponential beyond ±55°). Kept as a reference methodology, not primary.

---

## D06 — ANMS in two places (pre-match + post-match grid cap)

**Decision:** Spatial uniformity is enforced twice: ANMS SSC before description (inside L2 for M0/M1), AND grid cap after matching (L3 for all matchers).

**Evidence:** SIH26166_supplementary_research(2).md §1: ANMS SSC is the fastest variant, directly reusable after any OpenCV detector, and is the method recommended for producing evenly distributed features. LoFTR_IMC21.md: greedy adaptive-NMS merging is matcher-agnostic as a post-processing step and can enforce a coverage/budget constraint. The dual approach covers both the "too many matches in one region before matching" (ANMS pre-match) and the "too many matches in one region after matching" (grid cap post-match) failure modes independently.

**Alternatives rejected:**
- ANMS only pre-match: insufficient for M2/M3 which use their own detection; grid cap still needed.
- Grid cap only: cruder than ANMS; does not preserve locally strongest keypoints.
- UR-SIFT-style entropy-based selection: referenced in RIFT and DESCA papers; good concept but adds a separate statistical computation; SSC ANMS achieves the same goal more efficiently.

---

## D07 — Phase-correlation sub-pixel refinement with Tukey apodization

**Decision:** L5 uses per-inlier local NCC or phase-only correlation (POC) with Gaussian pyramid and 2D paraboloid peak fitting. Apodization is Tukey or Gaussian. Blackman is explicitly forbidden.

**Evidence:** HybridPhaseCorrelation(2026).md: comprehensive benchmark of apodization functions. Tukey and Gaussian produce the best peak sharpness and sub-pixel accuracy. Blackman is demonstrated as the worst choice in the study. Paraboloid peak fitting is the correct interpolation for the correlation peak. Gaussian pyramid coarse-to-fine convergence is proven for avoiding local minima.

**Alternatives rejected:**
- No sub-pixel refinement: rejected — RIFT's raw RMSE is 1.8-2.0 px (above sub-pixel target); SIFT's raw matches are integer-pixel. L5 is necessary to reach sub-pixel accuracy.
- Blackman apodization: explicitly rejected based on demonstrated failure (HybridPhaseCorrelation P4).
- ASP --subpixel-mode 9: referenced in supplementary_research; adopted as design pattern inspiration, but not used as a black box since it is internal to ASP stereo and not accessible as a standalone per-match refiner.

---

## D08 — RIFT with scale-space extension (M1a), not off-the-shelf RIFT

**Decision:** M1a is RIFT2 (faster version) plus a multi-octave log-Gabor scale-space extension we add.

**Evidence:** RIFT_extracted.md: RIFT achieves 100% SR on 6 NRD datasets vs ~30% for SIFT. BUT RIFT has no scale invariance — it requires images pre-resampled to matching GSD. Our sensors differ by up to ~17x GSD (OHRC:TMC-2). This is a direct conflict. The scale-space extension (add multi-octave log-Gabor search on top of PC/MIM) is identified in the paper itself as the natural extension to close this gap.

**Why M1 is not the polar default (updated):** Traditional_vs_DeepLearning_FeatureMatching.md demonstrates RIFT2 failing (❌) on OHRC-NAC Polar — the exact sensor pair and the exact hardest named condition in this project. This is stronger and more directly relevant negative evidence than the previously cited KAZE(2026) benchmark failure on a different dataset. M1 is NOT designated the illumination-robust polar fallback; it is the CPU-only fallback of last resort. For CPU-only + low-crater-density + polar combinations, the pair is flagged `no_validated_primary_matcher=true` rather than silently reporting an M1 result as trustworthy.

**Alternatives rejected:**
- Off-the-shelf RIFT without scale extension: rejected — fails on OHRC:TMC-2 GSD mismatch unless GSD is already reconciled in L1 (which L1 does via pyramid, so RIFT may work after that — benchmark will verify).
- HOPC: rejected (RIFT.md P4) — requires accurate a-priori geo-metadata; ISRO satellite geolocation can be off by hundreds of meters; metadata-dependent design is a known failure mode.

---

## D09 — IIRS as a separate module, not folded into main pipeline

**Decision:** IIRS correspondence is a separate module (iirs_wac.yaml) with mandatory photometric correction and its own accuracy target.

**Evidence:** SIH26166_supplementary_research(2).md §7: IIRS is a genuinely different sub-problem — hyperspectral, ~80m GSD, 250 bands, 0.8-5.0um spectral range, QUB format. Registration challenges include spectral appearance differences (not just resolution/illumination), and photometric correction of incidence/emission/phase angle variation is required before any feature operation. The supplementary research explicitly recommends treating IIRS as a separate module.

**Alternatives rejected:**
- Same pipeline as OHRC/TMC: rejected — would fail silently or give misleading metrics. The panchromatic CLAHE+PCA branch is not appropriate for hyperspectral data.
- Ignoring IIRS entirely: rejected — IIRS is one of the three explicitly named Chandrayaan-2 payloads in the problem statement.

---

## D10 — No GAN-based radiometric normalization

**Decision:** The cGAN radiometric normalization method (Radiometric_Normalization_Analysis.md) is NOT included in the pipeline.

**Evidence:** Radiometric_Normalization_Analysis.md: the method explicitly does not address geometric misalignment or parallax effects — it assumes images are already registered. This is the inverse of our core problem. Additionally: requires paired training data (distorted ↔ clean reference patches) which is not confirmed available for OHRC/TMC/IIRS at matching resolution; GAN training instability; not validated for keypoint repeatability (only SSIM/PSNR metrics used).

**What is included instead:** The CLAHE + percentile-clip + mean/std transfer (L1) is a lightweight, no-training-required alternative that the literature (SIFT-IIRS-WAC) demonstrates is sufficient for SIFT-class matching in the cross-sensor case.

---

## D11 — Tile-wise models for polar/high-relief pairs

**Decision:** Above ±55° latitude or high-relief terrain, the pipeline falls back to tile-wise local affine/homography models instead of a global model.

**Evidence:** SIFT-IIRS-WAC_extracted.md: RMSE rises from ~73m (equatorial) to 1000-2000+m near ±60-70° in a near-exponential trend, attributed to lunar curvature overwhelming a single 2D polynomial/homography. DESCA.md: global affine fails on mountainous terrain with local relief — near-total failure on a mountain case. NASA_SubPixel_Refinement.md: footprint/pixel-ratio accuracy degrades significantly with scale mismatch.

**Alternatives rejected:**
- Global homography everywhere: rejected — demonstrated failure at high latitude and high relief.
- Polynomial warp everywhere: rejected — still a global model; same curvature problem at poles.

---

## D12 — No SSIM/PSNR as primary evaluation metric

**Decision:** RMSE (on held-out GT checkpoints) + inlier count/ratio + spatial coverage + grid-density std-dev are the primary metrics. SSIM/PSNR are explicitly NOT primary.

**Evidence:** MoonMetaSync_extracted.md P4: SSIM/PSNR measure overall pixel/structural similarity post-warp, not geometric correspondence accuracy. They can be high even with imperfect local alignment, or penalized by legitimate radiometric differences unrelated to misregistration. Our SIH deliverable explicitly requires RMSE, inlier count, and inlier ratio.

---

## D13 — M3 (crater-geometry) gated by crater density

**Decision:** M3 runs only when crater_density >= tau_c in BOTH images and terrain_class is highland or polar.

**Evidence:** CNSFM_Crater_Neighborhood_Matching.md: the crater-neighborhood method requires sufficient crater density to construct a valid CNSF graph. It explicitly fails (returns zero matches) in crater-sparse regions (mare, melt sheets). NASA_SubPixel_Refinement.md P4: purely landmark-based approaches are insufficient for coverage in low-crater-density terrain.

**Why the gate is on BOTH images:** A mismatch in crater density between source and reference produces an underdetermined graph matching problem.

---

## D14 — LNIFT added as M1b for pilot-phase benchmarking

**Decision:** LNIFT is added as M1b in the matcher registry, benchmarked alongside RIFT2 (M1a) on the same pilot pairs. If LNIFT wins on pilot metrics, it is promoted to primary M1.

**Evidence:** supplementary_research.md reports LNIFT as the strongest practical candidate for M1's exact role: ~100x faster than RIFT, 99.9% SR vs 79.85% SR for RIFT2. This was never evaluated or rejected anywhere in the existing architecture documents.

**Why not immediately primary:** The research-evidence rule requires verifying a reported method on our data before promoting it. LNIFT's SR figure comes from a different dataset; it must be validated on the same pilot pairs as RIFT2 before a role decision is made.

**Alternatives rejected:**
- Skipping LNIFT entirely: rejected — the evidence base explicitly identifies it as the strongest M1 candidate; ignoring it without evaluation violates the research-evidence rule.

**Trade-off:** Adds one matcher to the pilot benchmark (low cost); potential payoff is a 100x runtime improvement for M1 with higher SR.

---

## D15 — Placement of Matcher Selection Model at L1.5 / S4.5

**Decision:** The Matcher Selection Model (MSM) is placed at Layer 1.5 (Stage 4.5), immediately after preprocessing and before matcher execution.

**Evidence:** Traditional_vs_DeepLearning benchmark demonstrates that running all 4 matchers across every image pair creates a 4–10x computational overhead that is prohibitive for production batch processing. Placing the model at L1.5 allows extracting rich geometric, radiometric, and texture features (from PairRecord + L1 meta.json) to make an informed routing decision before any expensive matching compute is triggered.

**Alternatives rejected:**
- Post-match arbitration only: rejected — requires running all matchers unconditionally, giving 0% runtime savings in production.
- Pre-L1 selection (at L0): rejected — lacks critical patch-level texture contrast, gradient magnitude, and shadow mask statistics computed during L1.

---

## D16 — LightGBM Multi-Class Classifier Framework for MSM

**Decision:** LightGBM multi-class GBDT (`objective='multiclass'`, 4 classes) is chosen as the meta-selection algorithm.

**Evidence:** Tabular ML benchmarks on planetary feature sets show gradient-boosted decision trees (GBDT) drastically outperform small neural networks on small-to-medium sample sizes ($N \approx 50\text{--}500$), offering $< 5\text{ ms}$ inference time, built-in feature importance, resilience to heterogeneous feature scales, and native handling of non-linear interactions between solar angle, GSD ratio, and terrain type.

**Alternatives rejected:**
- Deep Neural Network meta-model: rejected — high sample complexity, risk of severe overfitting on small planetary calibration sets, and unnecessary GPU dependency.
- Fixed heuristic rule-tree: rejected — cannot adapt to subtle empirical trade-offs or multi-metric confidence distributions.

---

## D17 — Dual Confidence Threshold Routing & Fallback Policy

**Decision:** MSM routing applies a dual-threshold confidence policy: $\tau_{high} = 0.65$ (execute single predicted winner) and $\tau_{low} = 0.40$ (execute primary + fallback second choice). Below $\tau_{low}$, the system defaults to Safe Mode (runs all matchers).

**Evidence:** High-stakes planetary image registration cannot tolerate silent catastrophic matcher failures. Dual-threshold routing ensures that uncertain cases automatically escalate compute to run dual matchers or safe-mode evaluation, achieving $\ge 50\%$ runtime savings while capping mean RMSE degradation $\le 0.10\text{ px}$.

**Alternatives rejected:**
- Argmax single-threshold routing: rejected — whenever the top prediction has low confidence ($P \approx 0.35$), running only one matcher risks catastrophic failure.
- Fixed two-matcher execution: rejected — halves runtime reduction benefits on clear high-confidence pairs.

---

## D18 — Strict Geo-Cell Disjointness for MSM Training (F15)

**Decision:** MSM training and cross-validation must strictly group samples by $10^\circ \times 10^\circ$ geographic cells (`geo_cell`), guaranteeing zero spatial overlap between training and validation/test splits.

**Evidence:** Planetary features exhibit strong regional spatial correlation (crater density, regolith texture, local topography). Splitting pairs randomly allows the selector to memorize geographical cells, leading to false high confidence and test-set leakage.

**Alternatives rejected:**
- Random train/test pair split: rejected — standard ML anti-pattern in geospatial domain, violates F9/F15 ML hygiene rules.

---

## D19 — Operational Gate & Acceptance Criteria (AC1–AC8) for Production Activation

**Decision:** The MSM model remains disabled in production (`msm.enabled: false`) until all 8 Acceptance Criteria (AC1–AC8 in VALIDATION.md §9) are formally satisfied on the held-out test split.

**Evidence:** Maintaining scientific accuracy is the primary objective. Automated selection must prove non-regression against the exhaustive benchmark before being trusted to bypass matchers.

**Alternatives rejected:**
- Enabling MSM immediately upon training completion: rejected — violates benchmark-first architectural safety principle.

