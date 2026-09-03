#!/usr/bin/env python3
"""
train_crater_model.py
======================
High-precision YOLO Crater Detector Trainer for SIH 2026.

Trained on real lunar imagery (Apollo & LRO NAC) with verified annotations.
Optimized for NVIDIA RTX 3050 Laptop GPU (or CUDA GPU / Colab).
Exports final weights to `models/crater_yolov9.pt`.
"""

import os
import shutil
import sys
from pathlib import Path

import torch
from ultralytics import YOLO

REPO_ROOT = Path(__file__).resolve().parent
DATASET_YAML = REPO_ROOT / "dataset" / "data.yaml"
MODELS_DIR = REPO_ROOT / "models"
RUNS_DIR = REPO_ROOT / "runs" / "crater_training"


def main():
    print("=" * 65)
    print("LUNAR CRATER YOLO DETECTOR TRAINING (SIH 2026)")
    print("=" * 65)

    if not DATASET_YAML.exists():
        print(f"[ERROR] Dataset configuration not found at {DATASET_YAML}")
        print("Please run: python download_real_crater_dataset.py first.")
        sys.exit(1)

    device = "0" if torch.cuda.is_available() else "cpu"
    batch_size = 8 if torch.cuda.is_available() else 4

    print(f"Device:             {device} ({torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'CPU'})")
    print(f"Batch Size:         {batch_size}")
    print(f"Image Resolution:   640x640")
    print(f"Dataset YAML:       {DATASET_YAML}")
    print("=" * 65)

    # Initialize model with SOTA YOLO11s backbone (with PSA attention blocks)
    model = YOLO("yolo11s.pt")

    # Train with multi-scale jitter, rotational symmetry, and illumination invariance
    print("[*] Launching training with YOLO11s + multi-scale & illumination augmentation...")
    results = model.train(
        data=str(DATASET_YAML.resolve()),
        epochs=30,
        batch=batch_size,
        imgsz=640,
        device=device,
        project=str(RUNS_DIR),
        name="crater_v3_yolo11_extended",
        exist_ok=True,
        pretrained=True,
        optimizer="AdamW",
        lr0=0.001,
        lrf=0.01,
        box=7.5,
        cls=1.5,          # Boosted class loss weight to increase recall on faint craters
        dfl=1.5,
        mosaic=1.0,       # 4-image mosaic for ultra-dense crater fields
        mixup=0.15,
        fliplr=0.5,
        flipud=0.5,
        degrees=180.0,    # Craters have 360-degree rotational symmetry
        scale=0.5,        # Multi-scale jitter (0.5x to 1.5x) for sub-km to 50km craters
        hsv_v=0.4,        # Illumination augmentation for steep solar angles
        patience=12,
        save=True,
        val=True,
        plots=True,
        amp=True,
        workers=2,
    )

    # Export best model
    best_pt = RUNS_DIR / "crater_v3_yolo11_extended" / "weights" / "best.pt"
    if not best_pt.exists():
        best_pt = RUNS_DIR / "crater_v3_yolo11_extended" / "weights" / "last.pt"

    if best_pt.exists():
        MODELS_DIR.mkdir(parents=True, exist_ok=True)
        dest_pt = MODELS_DIR / "crater_yolov9.pt"
        backup_pt = MODELS_DIR / "crater_real_best.pt"
        shutil.copy2(best_pt, dest_pt)
        shutil.copy2(best_pt, backup_pt)
        print("\n" + "=" * 65)
        print("[SUCCESS] Training completed successfully!")
        print(f"Best model exported to: {dest_pt} (Size: {dest_pt.stat().st_size / (1024*1024):.1f} MB)")
        print("=" * 65)
    else:
        print("[ERROR] Best weights file not found!")
        sys.exit(1)


if __name__ == "__main__":
    main()
