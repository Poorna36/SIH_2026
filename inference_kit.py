#!/usr/bin/env python3
"""
inference_kit.py
================
Clean & Accurate YOLOv9 Lunar Crater Detector (SIH 2026 PS-26166)

Runs YOLOv9 crater model inference with optimal confidence thresholds (conf=0.50, iou=0.30)
to generate clean, highly accurate single-crater bounding boxes and center tracking dots
without clutter or false positives.
"""

from __future__ import annotations

import env_config
import cv2
import numpy as np
from pathlib import Path
from ultralytics import YOLO

def run_clean_yolo_inference(
    model: YOLO,
    image_path: Path,
    out_path: Path,
    conf_thresh: float = 0.50,
    iou_thresh: float = 0.30,
) -> int:
    img = cv2.imread(str(image_path))
    if img is None:
        print(f"[ERROR] Could not read image from {image_path}")
        return 0

    results = model.predict(
        source=str(image_path),
        conf=conf_thresh,
        iou=iou_thresh,
        imgsz=640,
        verbose=False
    )[0]

    boxes = results.boxes.xyxy.cpu().numpy()
    confs = results.boxes.conf.cpu().numpy()

    if len(boxes) == 0:
        print(f"[WARN] No craters detected in {image_path.name}")
        return 0

    annotated = img.copy()
    for c_idx, (b, score) in enumerate(zip(boxes, confs), start=1):
        x1, y1, x2, y2 = map(int, b)
        cx, cy = (x1 + x2) // 2, (y1 + y2) // 2

        # 1. Clean red bounding box around crater rim
        cv2.rectangle(annotated, (x1, y1), (x2, y2), (0, 0, 255), 2)

        # 2. Prominent center tracking dot (black border + yellow core)
        cv2.circle(annotated, (cx, cy), 3, (0, 0, 0), -1)
        cv2.circle(annotated, (cx, cy), 2, (0, 255, 255), -1)

        # 3. Clean detection tag
        tag = f"#{c_idx} {score * 100:.0f}%"
        cv2.putText(annotated, tag, (x1, max(y1 - 4, 12)), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 255, 0), 1)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(out_path), annotated)
    print(f"[SUCCESS] Processed {len(boxes)} clean & accurate craters for {image_path.name}")
    print(f"[SUCCESS] Saved annotated detection overlay to {out_path.resolve()}")
    return len(boxes)

def main() -> None:
    print("=================================================================")
    print("CLEAN & ACCURATE YOLOv9 LUNAR CRATER INFERENCE KIT")
    print("=================================================================")

    # Load YOLO model weights
    model_path = env_config.MODELS_DIR / "crater_yolov9.pt"
    if not model_path.exists():
        model_path = env_config.REPO_ROOT / "runs" / "crater_train" / "yolov9_crater_v1" / "weights" / "best.pt"

    if not model_path.exists():
        print(f"[ERROR] Trained YOLO model not found at {model_path}")
        return

    print(f"[INFO] Loading YOLO Crater Detector Model from {model_path.name}...")
    model = YOLO(str(model_path))

    target_img1 = env_config.SAMPLE_IMAGES_DIR / "img1_highlands.jpg"
    target_img2 = env_config.SAMPLE_IMAGES_DIR / "img2_copernicus.png"

    out_img1 = env_config.REPO_ROOT / "results" / "perfect_tight_craters_highlands.png"
    out_img2 = env_config.REPO_ROOT / "results" / "yolov9_strict_inference_image2.png"

    if target_img1.exists():
        run_clean_yolo_inference(model, target_img1, out_img1)

    if target_img2.exists():
        run_clean_yolo_inference(model, target_img2, out_img2)

if __name__ == "__main__":
    main()
