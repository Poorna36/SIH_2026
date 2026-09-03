#!/usr/bin/env python3
"""
evaluate_against_manual_gt.py
==============================
Independent Precision / Recall / mAP Ground Truth Evaluator (SIH 2026 PS-26166)

Evaluates trained YOLO crater detection model weights against held-out ground-truth
label annotations without relying on internal training auto-label metrics.
"""

from __future__ import annotations

import argparse
import csv
import os
import sys
from pathlib import Path
from typing import Dict, List, Tuple

import cv2
import numpy as np
import torch
import env_config
from ultralytics import YOLO

def compute_iou(box1: np.ndarray, box2: np.ndarray) -> float:
    """Compute IoU between two bounding boxes [x1, y1, x2, y2]."""
    ix1 = max(box1[0], box2[0])
    iy1 = max(box1[1], box2[1])
    ix2 = min(box1[2], box2[2])
    iy2 = min(box1[3], box2[3])

    inter_w = max(0.0, ix2 - ix1)
    inter_h = max(0.0, iy2 - iy1)
    inter_area = inter_w * inter_h

    area1 = max(0.0, box1[2] - box1[0]) * max(0.0, box1[3] - box1[1])
    area2 = max(0.0, box2[2] - box2[0]) * max(0.0, box2[3] - box2[1])

    union_area = area1 + area2 - inter_area
    if union_area <= 0:
        return 0.0
    return inter_area / union_area

def parse_yolo_label_file(label_path: Path, img_w: int, img_h: int) -> List[np.ndarray]:
    """Parse normalized YOLO label format [cid, xn, yn, wn, hn] to absolute [x1, y1, x2, y2]."""
    boxes = []
    if not label_path.exists():
        return boxes

    with open(label_path, "r") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            parts = line.split()
            if len(parts) >= 5:
                xn, yn, wn, hn = map(float, parts[1:5])
                cx = xn * img_w
                cy = yn * img_h
                w = wn * img_w
                h = hn * img_h
                x1 = cx - w / 2.0
                y1 = cy - h / 2.0
                x2 = cx + w / 2.0
                y2 = cy + h / 2.0
                boxes.append(np.array([x1, y1, x2, y2]))
    return boxes

def evaluate_model(
    model_path: Path,
    val_images_dir: Path,
    val_labels_dir: Path,
    conf_thresh: float = 0.25,
    iou_thresh: float = 0.50,
) -> Dict[str, float]:
    """Evaluate YOLO model on validation dataset and calculate Precision, Recall, and F1."""
    if not model_path.exists():
        print(f"[ERROR] Model file not found at {model_path}")
        return {}

    model = YOLO(str(model_path))

    image_files = sorted(list(val_images_dir.glob("*.jpg")) + list(val_images_dir.glob("*.png")))
    if len(image_files) == 0:
        print(f"[WARN] No validation images found in {val_images_dir}")
        return {}

    total_tp = 0
    total_fp = 0
    total_fn = 0

    print("=" * 70)
    print(f"[INFO] INDEPENDENT GROUND TRUTH EVALUATION")
    print("=" * 70)
    print(f"Model Weights:      {model_path.resolve()}")
    print(f"Validation Set:     {val_images_dir.resolve()} ({len(image_files)} images)")
    print(f"Confidence Thresh:  {conf_thresh}")
    print(f"IoU Thresh:         {iou_thresh}")
    print("=" * 70)

    for img_p in image_files:
        lbl_p = val_labels_dir / f"{img_p.stem}.txt"
        img = cv2.imread(str(img_p))
        if img is None:
            continue
        H, W = img.shape[:2]

        gt_boxes = parse_yolo_label_file(lbl_p, W, H)

        results = model.predict(source=str(img_p), conf=conf_thresh, imgsz=640, verbose=False)[0]
        pred_boxes = results.boxes.xyxy.cpu().numpy() if len(results.boxes) > 0 else []

        matched_gt = set()
        for p_box in pred_boxes:
            best_iou = 0.0
            best_gt_idx = -1
            for gt_idx, gt_box in enumerate(gt_boxes):
                if gt_idx in matched_gt:
                    continue
                iou = compute_iou(p_box, gt_box)
                if iou > best_iou:
                    best_iou = iou
                    best_gt_idx = gt_idx

            if best_iou >= iou_thresh and best_gt_idx != -1:
                total_tp += 1
                matched_gt.add(best_gt_idx)
            else:
                total_fp += 1

        total_fn += len(gt_boxes) - len(matched_gt)

    precision = total_tp / max(1, total_tp + total_fp)
    recall = total_tp / max(1, total_tp + total_fn)
    f1 = 2 * (precision * recall) / max(1e-6, precision + recall)

    metrics = {
        "total_images": float(len(image_files)),
        "true_positives": float(total_tp),
        "false_positives": float(total_fp),
        "false_negatives": float(total_fn),
        "precision": float(precision),
        "recall": float(recall),
        "f1_score": float(f1),
    }

    print("\n" + "=" * 70)
    print("[EVALUATION RESULTS]")
    print("=" * 70)
    print(f"True Positives (TP):   {total_tp}")
    print(f"False Positives (FP):  {total_fp}")
    print(f"False Negatives (FN):  {total_fn}")
    print(f"Precision:             {precision * 100:.2f}%")
    print(f"Recall:                {recall * 100:.2f}%")
    print(f"F1 Score:              {f1 * 100:.2f}%")
    print("=" * 70)

    out_csv = env_config.REPO_ROOT / "results" / "independent_ground_truth_evaluation.csv"
    out_csv.parent.mkdir(parents=True, exist_ok=True)
    with open(out_csv, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["metric", "value"])
        for k, v in metrics.items():
            writer.writerow([k, f"{v:.4f}"])

    print(f"[SUCCESS] Evaluation metrics exported to {out_csv.resolve()}")
    return metrics

def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate YOLO crater model against ground-truth dataset.")
    parser.add_argument("--model", default=str(env_config.MODELS_DIR / "crater_yolov9.pt"), help="Path to YOLO model weights")
    parser.add_argument("--val-images", default=str(env_config.DATASET_DIR / "images" / "val"), help="Path to val images directory")
    parser.add_argument("--val-labels", default=str(env_config.DATASET_DIR / "labels" / "val"), help="Path to val labels directory")
    parser.add_argument("--conf", type=float, default=0.25, help="Confidence threshold")
    parser.add_argument("--iou", type=float, default=0.50, help="IoU evaluation threshold")

    args = parser.parse_args()

    evaluate_model(
        model_path=Path(args.model),
        val_images_dir=Path(args.val_images),
        val_labels_dir=Path(args.val_labels),
        conf_thresh=args.conf,
        iou_thresh=args.iou,
    )

if __name__ == "__main__":
    main()
