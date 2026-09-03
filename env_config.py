#!/usr/bin/env python3
"""
env_config.py
=============
Central Environment Setup Module for Lunar Crater Detection.

Forces all PyTorch, Ultralytics YOLO, HuggingFace, torchvision, and system temp
files, weights, and caches to strictly reside on D: drive inside this repository.
"""

import os
import sys
from pathlib import Path

# Constrain OpenBLAS/OMP memory allocation to single-thread pools to prevent Windows memory exhaustion
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
os.environ["OPENCV_FOR_THREADS_NUM"] = "1"

# Add PyTorch CUDA DLL directory to DLL search path
torch_lib_path = Path(sys.prefix) / "Lib" / "site-packages" / "torch" / "lib"
if torch_lib_path.exists():
    try:
        os.add_dll_directory(str(torch_lib_path))
        os.environ["PATH"] = str(torch_lib_path) + os.pathsep + os.environ.get("PATH", "")
    except Exception:
        pass

try:
    import cv2
    cv2.setNumThreads(1)
except Exception:
    pass

# Repository root directory on D: drive
REPO_ROOT = Path(__file__).resolve().parent

# Define D: drive directory locations
CACHE_DIR = REPO_ROOT / ".cache"
CONFIG_DIR = REPO_ROOT / ".config"
TMP_DIR = REPO_ROOT / ".tmp"
DOWNLOADS_DIR = REPO_ROOT / "downloads"
DATASET_DIR = REPO_ROOT / "dataset"
WEIGHTS_DIR = REPO_ROOT / "weights"
MODELS_DIR = REPO_ROOT / "models"
RUNS_DIR = REPO_ROOT / "runs"
SAMPLE_IMAGES_DIR = REPO_ROOT / "data" / "sample_images"

# Ensure all directories exist on D: drive
for d in [
    CACHE_DIR,
    CONFIG_DIR,
    CONFIG_DIR / "ultralytics",
    CACHE_DIR / "torch",
    CACHE_DIR / "huggingface",
    TMP_DIR,
    DOWNLOADS_DIR,
    DATASET_DIR,
    WEIGHTS_DIR,
    MODELS_DIR,
    RUNS_DIR,
    SAMPLE_IMAGES_DIR,
]:
    d.mkdir(parents=True, exist_ok=True)

# Constrain OpenBLAS/OMP memory allocation to single-thread pools to prevent Windows memory exhaustion
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"

# Set environment variables BEFORE importing torch / ultralytics
os.environ["ULTRALYTICS_CONFIG_DIR"] = str((CONFIG_DIR / "ultralytics").resolve())
os.environ["YOLO_CONFIG_DIR"] = str((CONFIG_DIR / "ultralytics").resolve())
os.environ["TORCH_HOME"] = str((CACHE_DIR / "torch").resolve())
os.environ["HF_HOME"] = str((CACHE_DIR / "huggingface").resolve())
os.environ["TMPDIR"] = str(TMP_DIR.resolve())
os.environ["TEMP"] = str(TMP_DIR.resolve())
os.environ["TMP"] = str(TMP_DIR.resolve())

# Try to configure Ultralytics settings if installed
try:
    from ultralytics import settings
    settings.update({
        "datasets_dir": str(DATASET_DIR.resolve()).replace("\\", "/"),
        "weights_dir": str(WEIGHTS_DIR.resolve()).replace("\\", "/"),
        "runs_dir": str(RUNS_DIR.resolve()).replace("\\", "/"),
    })
except Exception:
    pass

print(f"[ENV OK] All caches, downloads & temp paths redirected to D: drive workspace ({REPO_ROOT})")
