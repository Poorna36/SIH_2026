#!/usr/bin/env python3
"""
auto_train_after_dataset.py
===========================
Automatic Training & Evaluation Pipeline for SIH 2026 Lunar Crater YOLO Model.

Monitors dataset generation in `dataset/`, launches YOLOv8s GPU training,
exports `models/crater_yolov9.pt`, and executes visual inference checks.
"""

from __future__ import annotations

import env_config
import os
import sys
import time
from pathlib import Path


def main() -> None:
    repo_root = Path(__file__).resolve().parent
    dataset_yaml = repo_root / "dataset" / "data.yaml"

    print("=" * 70)
    print("[INFO] AUTOMATIC YOLOV8 LUNAR CRATER TRAINING RUNNER")
    print("=" * 70)

    # Step 1: Run training directly using dataset/data.yaml
    from train import train_yolo

    export_path = repo_root / "models" / "crater_yolov9.pt"

    prior_checkpoint = repo_root / "runs" / "crater_train" / "yolov9_crater_v1" / "weights" / "last.pt"
    if prior_checkpoint.exists():
        model_backbone = str(prior_checkpoint)
        print(f"[INFO] Resuming training from prior checkpoint: {prior_checkpoint}")
    else:
        model_backbone = "yolov9c.pt"
        print(f"[INFO] No prior checkpoint found at {prior_checkpoint}. Starting from pretrained backbone 'yolov9c.pt'.")

    best_weights = train_yolo(
        data_yaml=dataset_yaml,
        model_name=model_backbone,
        epochs=100,
        batch_size=8,
        img_size=640,
        device="0",
        project_dir=repo_root / "runs" / "crater_train",
        run_name="yolov9_crater_v1",
        save_model_path=export_path,
    )

    print("\n" + "=" * 70)
    print("[SUCCESS] TRAINING COMPLETED! EXPORTED MODEL TO:", export_path.resolve())
    print("=" * 70)

    # Step 2: Run inference test check
    from inference_test import run_inference
    test_img = repo_root / "dataset" / "images" / "val" / "lunar_crater_000450.jpg"
    out_img = repo_root / "results" / "crater_detections.png"

    if test_img.exists() and export_path.exists():
        run_inference(
            model_path=export_path,
            image_path=test_img,
            conf_thresh=0.25,
            out_image_path=out_img,
        )


if __name__ == "__main__":
    main()
