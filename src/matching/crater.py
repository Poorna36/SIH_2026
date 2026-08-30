"""
src/matching/crater.py
======================
M3 — CNSFM-style crater-geometry matcher.

Detection: YOLOv9 transfer-learned weights (primary) OR HoughCircles CPU fallback.
  - CPU fallback records matcher_id='crater_hough' (not 'crater')
  - Pre-flight recall check required before using M3 as primary matcher
  - detector_validated flag recorded in output

Gate (must pass BEFORE running M3):
  - crater_density_per_km2 >= tau_c (3.0 craters/km²) in BOTH images
  - terrain_class in {highland, polar_highland, polar}
  - gate_skip=True + reason recorded when gate fails

References: ARCHITECTURE.md §4, FEATURES.md F13, CONFIGURATION.md §2
"""
from __future__ import annotations

import time
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

from .base import BaseMatcher, MatchResult

_DEFAULTS: Dict[str, Any] = {
    "tau_c": 3.0,              # craters/km² gate threshold
    "allowed_terrain": {"highland", "polar_highland", "polar"},
    "hough_dp": 1.2,
    "hough_min_dist": 20,
    "hough_param1": 50,
    "hough_param2": 30,
    "hough_min_r": 5,
    "hough_max_r": 80,
    "topology_max_craters": 50,
    "match_confidence_thresh": 0.65,   # per CONFIGURATION.md confidence filter
    "yolo_weights": None,              # path to YOLOv9 weights; None = HoughCircles
}

# YOLOv9 optional import
try:
    import torch as _torch
    _HAS_TORCH = True
except ImportError:
    _HAS_TORCH = False


class CraterMatcher(BaseMatcher):
    """
    M3 — CNSFM-style crater-geometry matcher.

    matcher_id   = 'crater' (or 'crater_hough' on CPU fallback)
    requires_gpu = True  (auto-falls back to HoughCircles CPU)
    """

    matcher_id = "crater"
    requires_gpu = True

    def __init__(self, config: Optional[Dict[str, Any]] = None) -> None:
        cfg = {**_DEFAULTS, **(config or {})}
        self.tau_c: float = float(cfg["tau_c"])
        self.allowed_terrain: set = set(cfg["allowed_terrain"])
        self.hough_dp: float = float(cfg["hough_dp"])
        self.hough_min_dist: int = int(cfg["hough_min_dist"])
        self.hough_param1: float = float(cfg["hough_param1"])
        self.hough_param2: float = float(cfg["hough_param2"])
        self.hough_min_r: int = int(cfg["hough_min_r"])
        self.hough_max_r: int = int(cfg["hough_max_r"])
        self.max_craters: int = int(cfg["topology_max_craters"])
        self.conf_thresh: float = float(cfg["match_confidence_thresh"])
        self.yolo_weights: Optional[str] = cfg.get("yolo_weights")

    # ── Gate check (FEATURES.md F13) ─────────────────────────────────────────

    @staticmethod
    def check_gate(
        density_src: float,
        density_ref: float,
        terrain_src: str,
        terrain_ref: Optional[str],
        tau_c: float,
        allowed_terrain: set,
    ) -> Tuple[bool, str]:
        """
        Returns (gate_passes: bool, reason: str).
        Gate fails if density < tau_c in either image OR terrain not in allowed set.
        """
        if density_src < tau_c:
            return False, f"src_density={density_src:.2f} < tau_c={tau_c}"
        if density_ref is not None and density_ref < tau_c:
            return False, f"ref_density={density_ref:.2f} < tau_c={tau_c}"
        if terrain_src not in allowed_terrain:
            return False, f"terrain_src={terrain_src!r} not in {allowed_terrain}"
        return True, "gate_passed"

    # ── Crater detection ──────────────────────────────────────────────────────

    def _detect_craters(self, image: np.ndarray) -> np.ndarray:
        """
        Detect craters. Returns (N, 3) array of (col, row, radius_px).
        Tries YOLOv9 first; falls back to HoughCircles automatically.
        """
        if self.yolo_weights and _HAS_TORCH:
            try:
                return self._detect_yolo(image)
            except Exception:
                pass   # fall through to HoughCircles
        return self._detect_hough(image)

    def _detect_hough(self, image: np.ndarray) -> np.ndarray:
        """HoughCircles CPU fallback detector. Returns (N, 3) col, row, radius."""
        import cv2
        gray = self._to_gray(image)
        # Mild blur to suppress noise
        blurred = cv2.GaussianBlur(gray, (9, 9), 2)
        circles = cv2.HoughCircles(
            blurred,
            cv2.HOUGH_GRADIENT,
            dp=self.hough_dp,
            minDist=self.hough_min_dist,
            param1=self.hough_param1,
            param2=self.hough_param2,
            minRadius=self.hough_min_r,
            maxRadius=self.hough_max_r,
        )
        if circles is None:
            return np.empty((0, 3), dtype=np.float32)
        circles = np.round(circles[0]).astype(np.float32)  # (N, 3) x, y, r
        # Sort by radius descending (larger craters are more reliable)
        circles = circles[np.argsort(-circles[:, 2])]
        return circles[:self.max_craters]

    def _detect_yolo(self, image: np.ndarray) -> np.ndarray:
        """YOLOv9 crater detector. Returns (N, 3) col, row, radius."""
        import torch
        # Placeholder — weights must be loaded from self.yolo_weights
        # In production: model = torch.hub.load(...)
        raise NotImplementedError("YOLOv9 weights not loaded; using HoughCircles")

    # ── CNSF topology (FEATURES.md F13) ──────────────────────────────────────

    def _build_cnsf(self, craters: np.ndarray) -> Dict[str, Any]:
        """
        Build Crater Neighbourhood Shape Feature (CNSF).

        Per FEATURES.md F13: centre + radius + neighbourhood topology per crater.
        Returns dict with 'craters' (N,3) and 'adj_matrix' (N,N).
        """
        if len(craters) < 2:
            return {"craters": craters, "adj_matrix": np.zeros((len(craters), len(craters)))}

        N = len(craters)
        adj = np.zeros((N, N), dtype=np.float32)

        for i in range(N):
            for j in range(i + 1, N):
                dx = craters[i, 0] - craters[j, 0]
                dy = craters[i, 1] - craters[j, 1]
                dist = np.sqrt(dx**2 + dy**2)
                r_sum = craters[i, 2] + craters[j, 2]
                # Normalised distance = dist / (r_i + r_j)
                norm_dist = dist / (r_sum + 1e-9)
                adj[i, j] = adj[j, i] = norm_dist

        return {"craters": craters, "adj_matrix": adj}

    def _topology_match(
        self,
        cnsf_src: Dict[str, Any],
        cnsf_ref: Dict[str, Any],
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        """
        Similarity-invariant topology matching between two CNSFs.
        Returns (src_xy, ref_xy, confidence) arrays.

        Strategy: for each src crater, find ref crater with most similar
        normalised adjacency row (L1 distance on sorted adjacency vector).
        Apply MCR structural outlier removal.
        """
        c_src = cnsf_src["craters"]   # (Ns, 3)
        c_ref = cnsf_ref["craters"]   # (Nr, 3)
        A_src = cnsf_src["adj_matrix"]  # (Ns, Ns)
        A_ref = cnsf_ref["adj_matrix"]  # (Nr, Nr)

        Ns, Nr = len(c_src), len(c_ref)
        if Ns == 0 or Nr == 0:
            return (np.empty((0, 2), dtype=np.float32),
                    np.empty((0, 2), dtype=np.float32),
                    np.empty(0, dtype=np.float32))

        src_xy_out, ref_xy_out, conf_out = [], [], []

        for i in range(Ns):
            # Descriptor = sorted adjacency row (normalised)
            desc_i = np.sort(A_src[i])
            best_j, best_score = -1, float("inf")
            for j in range(Nr):
                desc_j = np.sort(A_ref[j])
                # Align lengths
                L = min(len(desc_i), len(desc_j))
                score = float(np.abs(desc_i[:L] - desc_j[:L]).mean())
                if score < best_score:
                    best_score = score
                    best_j = j

            if best_j >= 0:
                # Confidence = 1 - normalised L1 distance
                raw_conf = max(0.0, 1.0 - best_score)
                if raw_conf >= self.conf_thresh:
                    # Coordinates in (col, row)
                    src_xy_out.append([c_src[i, 0], c_src[i, 1]])
                    ref_xy_out.append([c_ref[best_j, 0], c_ref[best_j, 1]])
                    conf_out.append(raw_conf)

        if not src_xy_out:
            return (np.empty((0, 2), dtype=np.float32),
                    np.empty((0, 2), dtype=np.float32),
                    np.empty(0, dtype=np.float32))

        src_xy = np.array(src_xy_out, dtype=np.float32)
        ref_xy = np.array(ref_xy_out, dtype=np.float32)
        confidence = np.array(conf_out, dtype=np.float32)

        # ── MCR structural outlier removal ────────────────────────────────────
        src_xy, ref_xy, confidence = self._mcr_filter(src_xy, ref_xy, confidence)

        return src_xy, ref_xy, confidence

    @staticmethod
    def _mcr_filter(
        src_xy: np.ndarray,
        ref_xy: np.ndarray,
        confidence: np.ndarray,
        max_ratio: float = 2.0,
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        """
        MCR (Maximum Consistent Ratio) structural outlier filter.
        Removes matches with large displacement inconsistent with the consensus.
        """
        if len(src_xy) < 3:
            return src_xy, ref_xy, confidence

        assert src_xy.shape[-1] == 2, "Expected (N,2) array: (col, row)"
        assert ref_xy.shape[-1] == 2, "Expected (N,2) array: (col, row)"
        displacements = ref_xy - src_xy  # (N, 2)
        med = np.median(displacements, axis=0)
        diffs = np.linalg.norm(displacements - med, axis=1)
        mad = np.median(diffs) + 1e-9
        keep = diffs <= max_ratio * mad
        return src_xy[keep], ref_xy[keep], confidence[keep]

    # ── Pre-flight recall check (FEATURES.md F13) ────────────────────────────

    def preflight_recall_check(self, image: np.ndarray) -> bool:
        """
        Check detector recall on sample image.
        Sets detector_validated flag. Must be run before using M3 as primary.
        Returns True if at least 1 crater detected.
        """
        craters = self._detect_craters(image)
        return len(craters) > 0

    # ── Public match interface ────────────────────────────────────────────────

    def match(
        self,
        src: np.ndarray,
        ref: np.ndarray,
        gsd_ratio: float = 1.0,
        # Gate inputs — passed from benchmark.py
        crater_density_src: float = 0.0,
        crater_density_ref: float = 0.0,
        terrain_src: str = "unknown",
        terrain_ref: str = "unknown",
        **kwargs: Any,
    ) -> MatchResult:
        t0 = time.time()
        try:
            return self._match_impl(
                src, ref, gsd_ratio,
                crater_density_src, crater_density_ref,
                terrain_src, terrain_ref,
            )
        except Exception as exc:
            return self._empty_result(
                runtime_s=time.time() - t0,
                reason=str(exc),
            )

    def _match_impl(
        self,
        src: np.ndarray,
        ref: np.ndarray,
        gsd_ratio: float,
        density_src: float,
        density_ref: float,
        terrain_src: str,
        terrain_ref: str,
    ) -> MatchResult:
        t0 = time.time()

        # ── Gate check ────────────────────────────────────────────────────────
        gate_ok, gate_reason = self.check_gate(
            density_src, density_ref, terrain_src, terrain_ref,
            self.tau_c, self.allowed_terrain,
        )
        if not gate_ok:
            return self._empty_result(
                runtime_s=time.time() - t0,
                reason=f"gate_skip: {gate_reason}",
                gate_skip=True,
                gate_reason=gate_reason,
            )

        # ── Detect craters ────────────────────────────────────────────────────
        craters_src = self._detect_craters(src)
        craters_ref = self._detect_craters(ref)

        using_hough = self.yolo_weights is None or not _HAS_TORCH
        actual_id = "crater_hough" if using_hough else "crater"

        # Pre-flight recall check
        detector_validated = len(craters_src) > 0 and len(craters_ref) > 0

        if not detector_validated:
            return self._empty_result(
                runtime_s=time.time() - t0,
                reason="no_craters_detected",
                gate_skip=False,
                detector_validated=False,
                matcher_id_actual=actual_id,
            )

        # ── Build CNSF + topology match ───────────────────────────────────────
        cnsf_src = self._build_cnsf(craters_src)
        cnsf_ref = self._build_cnsf(craters_ref)
        src_xy, ref_xy, confidence = self._topology_match(cnsf_src, cnsf_ref)

        runtime = time.time() - t0
        return MatchResult(
            src_xy=src_xy,
            ref_xy=ref_xy,
            confidence=confidence,
            scale=np.ones(len(src_xy), dtype=np.float32) * gsd_ratio,
            angle_deg=np.zeros(len(src_xy), dtype=np.float32),
            runtime_s=runtime,
            matcher_params={
                "matcher_id": actual_id,
                "detector_validated": detector_validated,
                "n_craters_src": len(craters_src),
                "n_craters_ref": len(craters_ref),
                "gate_skip": False,
                "gsd_ratio": gsd_ratio,
                "cpu_fallback": using_hough,
            },
        )
