#!/usr/bin/env python3
"""
yolo/train.py
=============
Standalone YOLO Crater Detector Training Runner (SIH 2026 PS-26166)

Trains or fine-tunes YOLOv9 (or YOLOv8/YOLOv11) on lunar crater datasets.
Designed for portable execution on any machine (Local GPU, Colab, Kaggle, Friend's Workstation).

Usage:
  # Quick training on CUDA GPU:
  python yolo/train.py --data yolo/dataset/data.yaml --epochs 50 --batch 16 --device 0

  # Automatic model export:
  python yolo/train.py --data yolo/dataset/data.yaml --model yolov9c.pt --epochs 100 --imgsz 640
"""

from __future__ import annotations

import env_config
import argparse
import os
import shutil
import sys
from pathlib import Path


def train_yolo(
    data_yaml: Path,
    model_name: str = "yolov9c.pt",
    epochs: int = 50,
    batch_size: int = 16,
    img_size: int = 640,
    device: str = "0",
    project_dir: Path = Path("runs/crater_train"),
    run_name: str = "yolov9_crater_v1",
    save_model_path: Optional[Path] = Path("models/crater_yolov9.pt"),
) -> Path:
    """
    Execute YOLO model training via Ultralytics.
    """
    try:
        from ultralytics import YOLO
    except ImportError:
        print("[ERROR] Ultralytics is not installed. Please run:")
        print("    pip install ultralytics")
        sys.exit(1)

    import torch
    if device != "cpu" and not torch.cuda.is_available():
        print("[WARN] CUDA GPU not detected, falling back to CPU mode.")
        device = "cpu"
        batch_size = min(batch_size, 4)

    print("=" * 65)
    print("[INFO] STARTING LUNAR CRATER YOLO TRAINING")
    print("=" * 65)
    print(f"Model Backbone:     {model_name}")
    print(f"Dataset YAML:       {data_yaml}")
    print(f"Epochs:             {epochs}")
    print(f"Batch Size:         {batch_size}")
    print(f"Image Resolution:   {img_size}x{img_size}")
    print(f"Hardware Device:    {device} ({torch.cuda.get_device_name(0) if torch.cuda.is_available() and device != 'cpu' else 'CPU'})")
    print(f"Output Project:     {project_dir / run_name}")
    print("=" * 65)

    # Initialize model
    model = YOLO(model_name)

    # Train
    results = model.train(
        data=str(data_yaml.resolve()),
        epochs=epochs,
        batch=batch_size,
        imgsz=img_size,
        device=device,
        project=str(project_dir),
        name=run_name,
        exist_ok=True,
        pretrained=True,
        optimizer="AdamW",
        lr0=0.001,
        lrf=0.01,
        box=7.5,
        cls=0.5,
        dfl=1.5,
        save=True,
        val=True,
        plots=True,
        workers=0,
        amp=True,
    )

    # Locate best weights
    best_weights = project_dir / run_name / "weights" / "best.pt"
    if not best_weights.exists():
        best_weights = project_dir / run_name / "weights" / "last.pt"

    print("\n" + "=" * 65)
    print("[SUCCESS] YOLO CRATER TRAINING FINISHED SUCCESSFULLY!")
    print("=" * 65)
    print(f"Trained Weights: {best_weights}")

    if save_model_path and best_weights.exists():
        save_model_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(best_weights, save_model_path)
        print(f"Exported Model:  {save_model_path.resolve()}")

    return best_weights


def main() -> None:
    parser = argparse.ArgumentParser(description="Train YOLO Crater Detection Model.")
    parser.add_argument("--data", default="dataset/data.yaml", help="Path to data.yaml")
    parser.add_argument("--model", default="yolov9c.pt", help="YOLO model backbone (e.g. yolov9c.pt, yolov9e.pt, yolov8m.pt)")
    parser.add_argument("--epochs", type=int, default=50, help="Number of training epochs")
    parser.add_argument("--batch", type=int, default=16, help="Batch size (e.g. 8, 16, 32)")
    parser.add_argument("--imgsz", type=int, default=640, help="Image size in pixels")
    parser.add_argument("--device", default="0", help="CUDA device index ('0', '0,1') or 'cpu'")
    parser.add_argument("--project", default="runs/crater_train", help="Directory to save training runs")
    parser.add_argument("--name", default="yolov9_crater_v1", help="Name of current experiment")
    parser.add_argument("--export", default="models/crater_yolov9.pt", help="Path to export best.pt weights")

    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parent
    data_path = Path(args.data)
    if not data_path.is_absolute():
        if (repo_root / data_path).exists():
            data_path = repo_root / data_path
        elif (repo_root / "yolo" / data_path).exists():
            data_path = repo_root / "yolo" / data_path
        else:
            data_path = repo_root / data_path

    export_path = Path(args.export) if args.export else None
    if export_path and not export_path.is_absolute():
        export_path = repo_root / export_path

    project_path = Path(args.project)
    if not project_path.is_absolute():
        project_path = repo_root / project_path

    train_yolo(
        data_yaml=data_path,
        model_name=args.model,
        epochs=args.epochs,
        batch_size=args.batch,
        img_size=args.imgsz,
        device=args.device,
        project_dir=project_path,
        run_name=args.name,
        save_model_path=export_path,
    )


if __name__ == "__main__":
    main()
