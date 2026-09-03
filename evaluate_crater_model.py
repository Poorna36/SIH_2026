#!/usr/bin/env python3
"""
evaluate_crater_model.py
=========================
Independent Precision / Recall / mAP Ground Truth Evaluator & Visual Quality Check.

Validates the newly trained crater detector on:
1. Held-out validation dataset (mAP50, mAP50-95, Precision, Recall).
2. Real user test images (img1_highlands.jpg, img2_copernicus.png).
3. Produces high-resolution verification images with tight bounding boxes.
"""

import os
import sys
from pathlib import Path

import cv2
import numpy as np
import torch
from ultralytics import YOLO

REPO_ROOT = Path(__file__).resolve().parent
RESULTS_DIR = REPO_ROOT / "results"
RESULTS_DIR.mkdir(parents=True, exist_ok=True)
MODEL_PATH = REPO_ROOT / "models" / "crater_yolov9.pt"
DATASET_YAML = REPO_ROOT / "dataset" / "data.yaml"


def evaluate_on_val_set(model: YOLO) -> dict:
    print("=" * 65)
    print("[*] Running quantitative evaluation on held-out validation set...")
    print("=" * 65)

    metrics = model.val(
        data=str(DATASET_YAML.resolve()),
        split="val",
        imgsz=640,
        batch=8,
        conf=0.25,
        iou=0.5,
        plots=False,
    )

    p = float(metrics.box.mp)
    r = float(metrics.box.mr)
    map50 = float(metrics.box.map50)
    map95 = float(metrics.box.map)
    f1 = 2 * (p * r) / max(p + r, 1e-6)

    print("\n--- Validation Metrics ---")
    print(f"Precision:   {p * 100:.2f}%")
    print(f"Recall:      {r * 100:.2f}%")
    print(f"F1-Score:    {f1 * 100:.2f}%")
    print(f"mAP@50:      {map50 * 100:.2f}%")
    print(f"mAP@50-95:   {map95 * 100:.2f}%")
    print("--------------------------\n")

    # Save to CSV
    csv_path = RESULTS_DIR / "accuracy_matrix_real_craters.csv"
    with open(csv_path, "w") as f:
        f.write("Metric,Value,Percentage\n")
        f.write(f"Precision,{p:.4f},{p * 100:.2f}%\n")
        f.write(f"Recall,{r:.4f},{r * 100:.2f}%\n")
        f.write(f"F1-Score,{f1:.4f},{f1 * 100:.2f}%\n")
        f.write(f"mAP@50,{map50:.4f},{map50 * 100:.2f}%\n")
        f.write(f"mAP@50-95,{map95:.4f},{map95 * 100:.2f}%\n")

    print(f"[OK] Saved accuracy matrix to: {csv_path}")
    return {"precision": p, "recall": r, "f1": f1, "map50": map50}


def run_sliced_inference(model: YOLO, img: np.ndarray, tile_size: int = 640, stride: int = 440, conf: float = 0.20) -> Tuple[np.ndarray, np.ndarray]:
    """
    Sliced Aided Hyper Inference (SAHI-style sliding window).
    Processes arbitrary large orbital images (1024x1024, 4000x4000) at 1:1 pixel scale
    without downsampling loss, catching tiny sub-kilometer craters.
    """
    H, W = img.shape[:2]
    all_boxes = []
    all_confs = []

    for y in range(0, max(1, H - tile_size + stride), stride):
        y_end = min(H, y + tile_size)
        y_start = max(0, y_end - tile_size)
        for x in range(0, max(1, W - tile_size + stride), stride):
            x_end = min(W, x + tile_size)
            x_start = max(0, x_end - tile_size)

            crop = img[y_start:y_end, x_start:x_end]
            res = model.predict(crop, conf=conf, imgsz=tile_size, verbose=False)[0]

            if len(res.boxes) > 0:
                b = res.boxes.xyxy.cpu().numpy().copy()
                c = res.boxes.conf.cpu().numpy().copy()
                b[:, [0, 2]] += x_start
                b[:, [1, 3]] += y_start
                all_boxes.append(b)
                all_confs.append(c)

    if not all_boxes:
        return np.empty((0, 4), dtype=np.float32), np.empty((0,), dtype=np.float32)

    boxes = np.vstack(all_boxes)
    confs = np.concatenate(all_confs)

    # Multi-scale OpenCV NMS
    cv_boxes = [[int(x1), int(y1), int(x2 - x1), int(y2 - y1)] for x1, y1, x2, y2 in boxes]
    indices = cv2.dnn.NMSBoxes(cv_boxes, confs.tolist(), score_threshold=conf, nms_threshold=0.45)

    if len(indices) == 0:
        return np.empty((0, 4), dtype=np.float32), np.empty((0,), dtype=np.float32)

    indices = np.array(indices).flatten()
    return boxes[indices], confs[indices]


def run_multiscale_pyramid_detection(model: YOLO, img: np.ndarray, conf: float = 0.20) -> Tuple[np.ndarray, np.ndarray]:
    """
    Multi-Scale Scale-Space Pyramid Inference.
    Fuses predictions across Coarse (256/320px for giant impact basins),
    Medium (448/640px for standard craters), and Fine (SAHI/1024px for micro-craters).
    """
    H, W = img.shape[:2]
    all_boxes = []
    all_confs = []

    # 1. Coarse Scale for Giant Impact Basins (w > 150px)
    res_coarse = model.predict(img, imgsz=288, conf=0.22, verbose=False)[0]
    if len(res_coarse.boxes) > 0:
        all_boxes.append(res_coarse.boxes.xyxy.cpu().numpy())
        all_confs.append(res_coarse.boxes.conf.cpu().numpy())

    # 2. Medium Scale for Standard Craters
    res_med = model.predict(img, imgsz=640, conf=conf, verbose=False)[0]
    if len(res_med.boxes) > 0:
        all_boxes.append(res_med.boxes.xyxy.cpu().numpy())
        all_confs.append(res_med.boxes.conf.cpu().numpy())

    # 3. Fine Sliced Scale for Micro-Craters if high resolution (>= 800px)
    if max(H, W) >= 800:
        b_slice, c_slice = run_sliced_inference(model, img, tile_size=640, stride=440, conf=conf)
        if len(b_slice) > 0:
            all_boxes.append(b_slice)
            all_confs.append(c_slice)

    if not all_boxes:
        return np.empty((0, 4), dtype=np.float32), np.empty((0,), dtype=np.float32)

    boxes = np.vstack(all_boxes)
    confs = np.concatenate(all_confs)

    # Multi-scale OpenCV NMS
    cv_boxes = [[int(x1), int(y1), int(x2 - x1), int(y2 - y1)] for x1, y1, x2, y2 in boxes]
    indices = cv2.dnn.NMSBoxes(cv_boxes, confs.tolist(), score_threshold=conf, nms_threshold=0.45)

    if len(indices) == 0:
        return np.empty((0, 4), dtype=np.float32), np.empty((0,), dtype=np.float32)

    indices = np.array(indices).flatten()
    return boxes[indices], confs[indices]


def test_visual_inference(model: YOLO):
    print("=" * 65)
    print("[*] Generating Multi-Scale Pyramid Verification (Giant Basins + Micro-Craters)...")
    print("=" * 65)

    test_images = [
        REPO_ROOT / "data" / "sample_images" / "img1_highlands.jpg",
        REPO_ROOT / "data" / "sample_images" / "img2_copernicus.png",
    ]

    for img_path in test_images:
        if not img_path.exists():
            continue

        orig = cv2.imread(str(img_path))
        if orig is None:
            continue

        # Run Multi-Scale Scale-Space Pyramid Inference
        boxes, confs = run_multiscale_pyramid_detection(model, orig, conf=0.20)

        annotated = orig.copy()
        for i, (b, c) in enumerate(zip(boxes, confs)):
            x1, y1, x2, y2 = map(int, b)
            is_giant = (x2 - x1) > 160
            color = (0, 140, 255) if is_giant else (0, 255, 0)
            thick = 3 if is_giant else 2
            cv2.rectangle(annotated, (x1, y1), (x2, y2), color, thick)
            cx, cy = (x1 + x2) // 2, (y1 + y2) // 2
            cv2.circle(annotated, (cx, cy), 4 if is_giant else 2, (0, 0, 255), -1)
            label = f"GIANT {c:.2f}" if is_giant else f"{c:.2f}"
            cv2.putText(annotated, label, (x1, max(15, y1 - 4)), cv2.FONT_HERSHEY_SIMPLEX, 0.45 if is_giant else 0.35, color, 1)

        out_name = f"verified_craters_{img_path.stem}.png"
        out_path = RESULTS_DIR / out_name
        cv2.imwrite(str(out_path), annotated)
        print(f"[OK] {img_path.name}: Detected {len(boxes)} craters (Multi-Scale Pyramid) -> Saved: {out_path}")


def main():
    if not MODEL_PATH.exists():
        print(f"[ERROR] Trained model not found at {MODEL_PATH}")
        sys.exit(1)

    model = YOLO(str(MODEL_PATH))
    evaluate_on_val_set(model)
    test_visual_inference(model)


if __name__ == "__main__":
    main()
