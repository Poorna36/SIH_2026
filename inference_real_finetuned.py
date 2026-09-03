#!/usr/bin/env python3
"""
inference_real_finetuned.py
===========================
Clean & Accurate Fine-Tuned YOLOv9 Lunar Crater Detector.

Runs fine-tuned YOLOv9 inference with optimal confidence thresholds (conf=0.50, iou=0.30)
to generate clean, accurate single-crater bounding boxes and center tracking dots without clutter.
"""

from __future__ import annotations

import env_config
import cv2
import numpy as np
from pathlib import Path
from ultralytics import YOLO

def main() -> None:
    print("=================================================================")
    print("CLEAN & ACCURATE FINE-TUNED YOLOv9 CRATER INFERENCE")
    print("=================================================================")

    target_img_path = env_config.SAMPLE_IMAGES_DIR / "img2_copernicus.png"
    out_path = env_config.REPO_ROOT / "results" / "yolov9e_perfect_inference_image2.png"

    if not target_img_path.exists():
        print(f"[ERROR] Target image not found at {target_img_path}")
        return

    model_path = env_config.MODELS_DIR / "crater_yolov9.pt"
    if not model_path.exists():
        model_path = env_config.RUNS_DIR / "detect" / "runs" / "crater_detection" / "yolov9_real_finetuned" / "weights" / "best.pt"

    if not model_path.exists():
        print(f"[ERROR] YOLO model weights not found at {model_path}")
        return

    print(f"[INFO] Loading YOLO Crater Detector Model from {model_path.name}...")
    model = YOLO(str(model_path))

    print(f"[INFO] Running Clean & Accurate Prediction on {target_img_path.name}...")

    img = cv2.imread(str(target_img_path))
    results = model.predict(
        source=str(target_img_path),
        conf=0.50,
        iou=0.30,
        imgsz=640,
        verbose=False
    )[0]

    boxes = results.boxes.xyxy.cpu().numpy()
    confs = results.boxes.conf.cpu().numpy()

    if len(boxes) == 0:
        print("[WARN] No craters detected.")
        return

    annotated = img.copy()
    for c_idx, (b, score) in enumerate(zip(boxes, confs), start=1):
        x1, y1, x2, y2 = map(int, b)
        cx, cy = (x1 + x2) // 2, (y1 + y2) // 2

        # 1. Clean red bounding box around crater rim
        cv2.rectangle(annotated, (x1, y1), (x2, y2), (0, 0, 255), 2)

        # 2. High-contrast center tracking dot (black outline + yellow core)
        cv2.circle(annotated, (cx, cy), 3, (0, 0, 0), -1)
        cv2.circle(annotated, (cx, cy), 2, (0, 255, 255), -1)

        # 3. Clean detection tag
        tag = f"#{c_idx} {score * 100:.0f}%"
        cv2.putText(annotated, tag, (x1, max(y1 - 4, 12)), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 255, 0), 1)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(out_path), annotated)
    print(f"[SUCCESS] Processed {len(boxes)} clean & accurate craters with bounding boxes and center dots.")
    print(f"[SUCCESS] Saved output image overlay to {out_path.resolve()}")

if __name__ == "__main__":
    main()
