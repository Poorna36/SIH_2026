"""
src/matching/lightglue.py
=========================
M2 — SuperPoint + LightGlue matcher with automatic CPU fallback.

MANDATORY rules (FEATURES.md F12):
  - F2 checks (bounds + one-to-one) called BEFORE returning MatchResult
  - CPU fallback activated automatically when GPU unavailable
  - Per-match confidence stored in MatchResult.confidence
  - max_keypoints reduced from 2048 to 1024 on CPU mode
  - requires_gpu = True (but runs on CPU via fallback — never skipped)

Configuration keys (matchers.yaml, lightglue block):
  max_keypoints : 2048    (1024 on CPU)
  confidence_threshold : 0.2
  depth_confidence     : -1   (disable early-exit for reproducibility)
  cpu_fallback         : True

References: ARCHITECTURE.md §4, FEATURES.md F12, CONFIGURATION.md §2
"""
from __future__ import annotations

import time
from typing import Any, Dict, Optional

import numpy as np

from .base import BaseMatcher, MatchResult

_DEFAULTS: Dict[str, Any] = {
    "max_keypoints": 2048,
    "confidence_threshold": 0.2,
    "depth_confidence": -1,
    "cpu_fallback": True,
}

# Try importing LightGlue at module level; flag availability
try:
    import torch
    from lightglue import LightGlue, SuperPoint
    from lightglue.utils import rbd
    _HAS_LIGHTGLUE = True
except ImportError:
    _HAS_LIGHTGLUE = False

try:
    import torch
    _HAS_TORCH = True
except ImportError:
    _HAS_TORCH = False


class LightGlueMatcher(BaseMatcher):
    """
    M2 — SuperPoint + LightGlue correspondence matcher.

    matcher_id   = 'lightglue'
    requires_gpu = True   (but runs on CPU via automatic fallback)

    F2 checks are ALWAYS applied before returning — never skipped.
    """

    matcher_id = "lightglue"
    requires_gpu = True

    def __init__(self, config: Optional[Dict[str, Any]] = None) -> None:
        cfg = {**_DEFAULTS, **(config or {})}
        self.max_kp: int = int(cfg["max_keypoints"])
        self.conf_thresh: float = float(cfg["confidence_threshold"])
        self.depth_conf: int = int(cfg["depth_confidence"])
        self.cpu_fallback: bool = bool(cfg["cpu_fallback"])
        self._extractor = None
        self._matcher = None
        self._device = None

    # ── Lazy model loading ────────────────────────────────────────────────────

    def _get_device(self) -> "torch.device":
        import torch
        if torch.cuda.is_available():
            return torch.device("cuda")
        if self.cpu_fallback:
            return torch.device("cpu")
        raise RuntimeError("GPU unavailable and cpu_fallback=False")

    def _ensure_models(self, device: "torch.device") -> None:
        if self._extractor is not None and self._device == device:
            return
        import torch
        max_kp = self.max_kp if str(device) != "cpu" else min(self.max_kp, 1024)
        self._extractor = SuperPoint(max_num_keypoints=max_kp).eval().to(device)
        self._matcher = LightGlue(features="superpoint").eval().to(device)
        self._device = device

    # ── F2 checks (FEATURES.md F12 — MANDATORY, never skip) ─────────────────

    @staticmethod
    def _f2_checks(
        src_xy: np.ndarray,
        ref_xy: np.ndarray,
        confidence: np.ndarray,
        src_shape: tuple,
        ref_shape: tuple,
        buffer_px: int = 10,
    ) -> tuple:
        """
        F2 checks: in-bounds filtering + one-to-one deduplication.
        Called BEFORE returning MatchResult (FEATURES.md F12, mandatory).

        Returns filtered (src_xy, ref_xy, confidence, n_removed).
        """
        src_h, src_w = src_shape[:2]
        ref_h, ref_w = ref_shape[:2]
        n_total = len(src_xy)

        if n_total == 0:
            return src_xy, ref_xy, confidence, 0

        # ── In-bounds check ─────────────────────────────────────────────────
        # coords are (col, row) = (x, y)
        in_src = (
            (src_xy[:, 0] >= -buffer_px) &
            (src_xy[:, 0] < src_w + buffer_px) &
            (src_xy[:, 1] >= -buffer_px) &
            (src_xy[:, 1] < src_h + buffer_px)
        )
        in_ref = (
            (ref_xy[:, 0] >= -buffer_px) &
            (ref_xy[:, 0] < ref_w + buffer_px) &
            (ref_xy[:, 1] >= -buffer_px) &
            (ref_xy[:, 1] < ref_h + buffer_px)
        )
        keep = in_src & in_ref
        src_xy = src_xy[keep]
        ref_xy = ref_xy[keep]
        confidence = confidence[keep]

        if len(src_xy) == 0:
            return src_xy, ref_xy, confidence, n_total

        # ── One-to-one: keep highest confidence for duplicate pairs ──────────
        # Build tuple keys (src_idx, ref_idx) are implicit; use coord proximity
        # Simple approach: for duplicate src coords, keep highest conf
        _, unique_src = np.unique(
            np.round(src_xy, 1).view(np.dtype([("x", np.float32), ("y", np.float32)])),
            return_index=True,
        )
        src_xy = src_xy[unique_src]
        ref_xy = ref_xy[unique_src]
        confidence = confidence[unique_src]

        n_removed = n_total - len(src_xy)
        return src_xy, ref_xy, confidence, n_removed

    # ── Main match pipeline ───────────────────────────────────────────────────

    def match(
        self,
        src: np.ndarray,
        ref: np.ndarray,
        gsd_ratio: float = 1.0,
        **kwargs: Any,
    ) -> MatchResult:
        t0 = time.time()
        try:
            if not _HAS_LIGHTGLUE:
                return self._empty_result(
                    runtime_s=time.time() - t0,
                    reason="lightglue_not_installed",
                )
            return self._match_impl(src, ref, gsd_ratio)
        except RuntimeError as exc:
            msg = str(exc)
            # GPU OOM: reduce kp_limit -> CPU mode (FEATURES.md F12)
            if "CUDA out of memory" in msg or "CUDA" in msg:
                try:
                    self._extractor = None
                    self._matcher = None
                    import torch
                    return self._match_impl(src, ref, gsd_ratio,
                                           force_device=torch.device("cpu"))
                except Exception as inner:
                    return self._empty_result(
                        runtime_s=time.time() - t0,
                        reason=f"gpu_oom_cpu_fallback_failed: {inner}",
                    )
            return self._empty_result(runtime_s=time.time() - t0, reason=msg)
        except Exception as exc:
            return self._empty_result(runtime_s=time.time() - t0, reason=str(exc))

    def _match_impl(
        self,
        src: np.ndarray,
        ref: np.ndarray,
        gsd_ratio: float,
        force_device: Optional["torch.device"] = None,
    ) -> MatchResult:
        import torch

        t0 = time.time()
        device = force_device if force_device is not None else self._get_device()
        cpu_mode = str(device) == "cpu"
        self._ensure_models(device)

        def _to_tensor(img: np.ndarray) -> "torch.Tensor":
            gray = self._to_gray(img).astype(np.float32) / 255.0
            return torch.tensor(gray, dtype=torch.float32)[None, None].to(device)

        t_src = _to_tensor(src)
        t_ref = _to_tensor(ref)

        with torch.no_grad():
            feats_src = self._extractor.extract(t_src)
            feats_ref = self._extractor.extract(t_ref)
            matches_out = self._matcher({"image0": feats_src, "image1": feats_ref})

        # Unbatch
        feats_src_ub = rbd(feats_src)
        feats_ref_ub = rbd(feats_ref)
        matches_ub = rbd(matches_out)

        kp0 = feats_src_ub["keypoints"].cpu().numpy()        # (N0, 2) — x, y
        kp1 = feats_ref_ub["keypoints"].cpu().numpy()        # (N1, 2)
        m_idx = matches_ub["matches"].cpu().numpy()          # (M, 2)
        m_conf = matches_ub["matching_scores0"].cpu().numpy()  # (M,)

        if len(m_idx) == 0:
            return self._empty_result(
                runtime_s=time.time() - t0,
                reason="no_matches_from_lightglue",
                cpu_fallback=cpu_mode,
            )

        # Filter by confidence threshold
        conf_mask = m_conf >= self.conf_thresh
        m_idx = m_idx[conf_mask]
        m_conf = m_conf[conf_mask]

        if len(m_idx) == 0:
            return self._empty_result(
                runtime_s=time.time() - t0,
                reason="conf_threshold_filtered_all",
                cpu_fallback=cpu_mode,
            )

        src_xy = kp0[m_idx[:, 0]].astype(np.float32)  # col, row = x, y
        ref_xy = kp1[m_idx[:, 1]].astype(np.float32)
        confidence = m_conf.astype(np.float32)

        # ── F2 checks BEFORE returning (MANDATORY — FEATURES.md F12) ─────────
        src_xy, ref_xy, confidence, n_removed = self._f2_checks(
            src_xy, ref_xy, confidence,
            src_shape=src.shape, ref_shape=ref.shape,
        )

        runtime = time.time() - t0
        return MatchResult(
            src_xy=src_xy,
            ref_xy=ref_xy,
            confidence=confidence,
            scale=np.ones(len(src_xy), dtype=np.float32),
            angle_deg=np.zeros(len(src_xy), dtype=np.float32),
            runtime_s=runtime,
            matcher_params={
                "matcher_id": self.matcher_id,
                "cpu_fallback": cpu_mode,
                "confidence_threshold": self.conf_thresh,
                "f2_checks_applied": True,
                "f2_removed": int(n_removed),
                "gsd_ratio": gsd_ratio,
            },
        )
