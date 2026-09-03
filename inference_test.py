#!/usr/bin/env python3
"""
yolo/inference_test.py
======================
YOLO Crater Detection Inference & Visual Quality Check (SIH 2026 PS-26166)

Tests a trained YOLO crater model on sample lunar images and renders
bounding box detection overlays with confidence scores and crater radii.

Usage:
  python yolo/inference_test.py --model models/crater_yolov9.pt --image data/reference/nac/M1415153594LC_PYR.TIF --conf 0.25
"""

from __future__ import annotations

import env_config
import argparse
import time
from pathlib import Path

import cv2
import numpy as np


def run_inference(
    model_path: Path,
    image_path: Path,
    conf_thresh: float = 0.25,
    out_image_path: Path = Path("results/crater_detections.png"),
) -> None:
    """
    Run YOLO inference on image and draw bounding box predictions.
    """
    try:
        from ultralytics import YOLO
    except ImportError:
        print("[ERROR] Ultralytics is not installed. Please run: pip install ultralytics")
        return

    print("=" * 65)
    print("[INFO] TESTING LUNAR CRATER YOLO DETECTOR")
    print("=" * 65)
    print(f"Model Path:       {model_path}")
    print(f"Input Image:      {image_path}")
    print(f"Confidence:       {conf_thresh}")
    print("=" * 65)

    if not model_path.exists():
        print(f"[WARN] Model {model_path} not found. Using default pretrained 'yolov8s.pt' as baseline.")
        model = YOLO("yolov8s.pt")
    else:
        model = YOLO(str(model_path))

    t0 = time.time()
    results = model.predict(source=str(image_path), conf=conf_thresh, save=False, verbose=False)
    infer_time = (time.time() - t0) * 1000.0

    r = results[0]
    boxes = r.boxes.xyxy.cpu().numpy()  # [x1, y1, x2, y2]
    confs = r.boxes.conf.cpu().numpy()

    print(f"[SUCCESS] Detections: {len(boxes)} craters found in {infer_time:.2f} ms")

    # Draw boxes on image
    orig_img = r.orig_img.copy()
    for (x1, y1, x2, y2), conf in zip(boxes, confs):
        x1, y1, x2, y2 = int(x1), int(y1), int(x2), int(y2)
        radius = (x2 - x1) / 2.0
        # Draw bounding rectangle and center point
        cv2.rectangle(orig_img, (x1, y1), (x2, y2), (0, 255, 0), 2)
        cv2.circle(orig_img, (int((x1 + x2) / 2), int((y1 + y2) / 2)), 3, (0, 0, 255), -1)
        # Label
        label = f"Crater {conf:.2f} (r={radius:.1f}px)"
        cv2.putText(orig_img, label, (x1, max(y1 - 5, 15)), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 255, 0), 1)

    out_image_path.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(out_image_path), orig_img)
    print(f"[SUCCESS] Detection overlay saved to: {out_image_path.resolve()}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Test YOLO Crater Detector.")
    parser.add_argument("--model", default="models/crater_yolov9.pt", help="Path to trained YOLO weights")
    parser.add_argument("--image", default="dataset/images/val/lunar_crater_000450.jpg", help="Path to test image")
    parser.add_argument("--conf", type=float, default=0.25, help="Confidence threshold")
    parser.add_argument("--out", default="results/crater_detections.png", help="Output annotated image path")

    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parent
    workspace_root = repo_root.parent

    model_p = Path(args.model)
    if not model_p.is_absolute():
        if (repo_root / model_p).exists():
            model_p = repo_root / model_p
        elif (workspace_root / model_p).exists():
            model_p = workspace_root / model_p
        else:
            model_p = repo_root / model_p

    img_p = Path(args.image)
    if not img_p.is_absolute():
        if (repo_root / img_p).exists():
            img_p = repo_root / img_p
        elif (workspace_root / img_p).exists():
            img_p = workspace_root / img_p
        elif (workspace_root / "code" / img_p).exists():
            img_p = workspace_root / "code" / img_p
        else:
            img_p = repo_root / img_p

    out_p = Path(args.out)
    if not out_p.is_absolute():
        out_p = repo_root / out_p

    run_inference(model_p, img_p, args.conf, out_p)


if __name__ == "__main__":
    main()
