#!/usr/bin/env python3
"""
yolo/prepare_dataset.py
=======================
Automated Lunar Crater YOLO Dataset Generator (SIH 2026 PS-26166)

Extracts 640x640 training/validation patches and normalized YOLO bounding box
annotations from high-resolution Lunar GeoTIFF imagery and the Robbins 2018
Crater Database (1.3M craters).

Outputs standard YOLO dataset format:
  yolo/dataset/
  ├── data.yaml
  ├── images/
  │   ├── train/
  │   └── val/
  └── labels/
      ├── train/
      └── val/

Usage:
  python yolo/prepare_dataset.py \
      --images data/reference/nac/ \
      --robbins /home/abhi/Downloads/lunar_crater_database_robbins_2018_bundle/data/lunar_crater_database_robbins_2018.csv \
      --out yolo/dataset \
      --num-patches 2000 \
      --patch-size 640
"""

from __future__ import annotations

import env_config
import argparse
import glob
import math
import os
import random
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import cv2
import numpy as np
import rasterio

# Class ID for crater in YOLO (single class: 0)
CRATER_CLASS_ID = 0


def parse_robbins_craters_in_bbox(
    csv_path: Path,
    lat_min: float,
    lat_max: float,
    lon_min: float,
    lon_max: float,
    min_diam_km: float = 0.05,
    max_diam_km: float = 50.0,
) -> List[Dict[str, float]]:
    """
    Query Robbins CSV for all craters intersecting a latitude/longitude bounding box.
    """
    import pandas as pd

    craters = []
    # Normalize longitudes to [0, 360] or [-180, 180] depending on representation
    l_min = (lon_min + 360) % 360 if lon_min < 0 else lon_min
    l_max = (lon_max + 360) % 360 if lon_max < 0 else lon_max
    if l_min > l_max:
        l_min, l_max = min(l_min, l_max), max(l_min, l_max)

    try:
        chunks = pd.read_csv(
            csv_path,
            usecols=["LAT_CIRC_IMG", "LON_CIRC_IMG", "DIAM_CIRC_IMG"],
            chunksize=100000,
        )
        for chunk in chunks:
            # Filter latitude and diameter
            subset = chunk[
                (chunk["LAT_CIRC_IMG"] >= lat_min - 0.2)
                & (chunk["LAT_CIRC_IMG"] <= lat_max + 0.2)
                & (chunk["DIAM_CIRC_IMG"] >= min_diam_km)
                & (chunk["DIAM_CIRC_IMG"] <= max_diam_km)
            ]
            if not subset.empty:
                for _, row in subset.iterrows():
                    craters.append({
                        "lat": float(row["LAT_CIRC_IMG"]),
                        "lon": float(row["LON_CIRC_IMG"]),
                        "diam_km": float(row["DIAM_CIRC_IMG"]),
                    })
    except Exception as e:
        print(f"[WARN] Error reading Robbins database chunk: {e}")

    return craters


def extract_crater_candidates_hough(
    patch: np.ndarray,
    min_radius: int = 10,
    max_radius: int = 200,
) -> List[Tuple[float, float, float, float]]:
    """
    Backup computer vision crater extractor for local uncataloged small sub-km craters.
    Returns list of (x_center_px, y_center_px, width_px, height_px).
    """
    if patch.ndim == 3:
        gray = cv2.cvtColor(patch, cv2.COLOR_BGR2GRAY)
    else:
        gray = patch

    # Enhance contrast
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)
    blurred = cv2.GaussianBlur(enhanced, (9, 9), 2)

    circles = cv2.HoughCircles(
        blurred,
        cv2.HOUGH_GRADIENT,
        dp=1.2,
        minDist=20,
        param1=50,
        param2=28,
        minRadius=min_radius,
        maxRadius=max_radius,
    )

    boxes = []
    if circles is not None:
        circles = np.uint16(np.around(circles))
        for i in circles[0, :]:
            cx, cy, r = float(i[0]), float(i[1]), float(i[2])
            w = r * 2.0
            h = r * 2.0
            boxes.append((cx, cy, w, h))

    return boxes


def generate_yolo_dataset(
    image_paths: List[Path],
    robbins_csv: Optional[Path],
    out_dir: Path,
    num_patches: int = 2000,
    patch_size: int = 640,
    train_ratio: float = 0.85,
    seed: int = 42,
) -> Dict[str, Any]:
    """
    Generate YOLO dataset folder structure with patches and .txt bounding boxes.
    """
    random.seed(seed)
    np.random.seed(seed)

    images_train = out_dir / "images" / "train"
    images_val = out_dir / "images" / "val"
    labels_train = out_dir / "labels" / "train"
    labels_val = out_dir / "labels" / "val"

    for d in [images_train, images_val, labels_train, labels_val]:
        d.mkdir(parents=True, exist_ok=True)

    total_generated = 0
    total_craters_labeled = 0
    num_train = int(num_patches * train_ratio)

    print(f"[*] Starting YOLO crater dataset generation -> Target: {num_patches} patches")
    if robbins_csv is None or not Path(robbins_csv).exists():
        print("=" * 70)
        print("[WARN] No Robbins catalog provided — all labels are Hough-circle pseudo-labels, not verified ground truth.")
        print("=" * 70)
    else:
        print(f"[*] Robbins Crater Database specified: {robbins_csv}")

    for img_path in image_paths:
        if total_generated >= num_patches:
            break

        # Instrument Guard: Reject/skip IIRS files (ch2_iir_*)
        if "ch2_iir" in img_path.name.lower():
            print(f"[WARN] Skipping IIRS instrument file '{img_path.name}' (IIRS hyperspectral data is unsuitable for crater bounding-box detection).")
            continue

        print(f"\n[*] Processing source image: {img_path.name}")
        try:
            with rasterio.open(img_path) as src:
                H, W = src.shape
                bounds = src.bounds
                res_m = abs(src.res[0])
                data = src.read(1)
        except Exception as e:
            # Fallback to OpenCV
            data = cv2.imread(str(img_path), cv2.IMREAD_GRAYSCALE)
            if data is None:
                continue
            H, W = data.shape
            bounds = None
            res_m = 0.5

        # Normalize image to 8-bit
        if data.dtype != np.uint8:
            data_min, data_max = float(np.percentile(data, 1)), float(np.percentile(data, 99))
            data_norm = np.clip((data - data_min) / max(data_max - data_min, 1e-6) * 255.0, 0, 255).astype(np.uint8)
        else:
            data_norm = data

        # Stride and sample
        patches_per_image = max(50, (num_patches - total_generated) // max(1, len(image_paths)))
        
        for p_idx in range(patches_per_image):
            if total_generated >= num_patches:
                break

            # Random crop location
            if W <= patch_size or H <= patch_size:
                r0, c0 = 0, 0
                patch = cv2.resize(data_norm, (patch_size, patch_size))
            else:
                r0 = random.randint(0, H - patch_size)
                c0 = random.randint(0, W - patch_size)
                patch = data_norm[r0 : r0 + patch_size, c0 : c0 + patch_size]

            # Detect / project craters in this patch
            craters_in_patch = []
            patch_source = "hough"

            # 1. Project Robbins Catalog entries if available and georeferenced
            if robbins_csv and Path(robbins_csv).exists() and bounds is not None:
                try:
                    with rasterio.open(img_path) as src_meta:
                        top_left_lon, top_left_lat = src_meta.xy(r0, c0)
                        bottom_right_lon, bottom_right_lat = src_meta.xy(r0 + patch_size, c0 + patch_size)
                        
                        lat_min, lat_max = min(top_left_lat, bottom_right_lat), max(top_left_lat, bottom_right_lat)
                        lon_min, lon_max = min(top_left_lon, bottom_right_lon), max(top_left_lon, bottom_right_lon)
                        
                        robbins_craters = parse_robbins_craters_in_bbox(Path(robbins_csv), lat_min, lat_max, lon_min, lon_max)
                        
                        for c_entry in robbins_craters:
                            c_lat = c_entry["lat"]
                            c_lon = c_entry["lon"]
                            c_diam_km = c_entry["diam_km"]
                            
                            c_row, c_col = src_meta.index(c_lon, c_lat)
                            if r0 <= c_row < r0 + patch_size and c0 <= c_col < c0 + patch_size:
                                cx_patch = float(c_col - c0)
                                cy_patch = float(c_row - r0)
                                diam_px = (c_diam_km * 1000.0) / max(res_m, 1e-3)
                                w_patch = max(diam_px, 4.0)
                                h_patch = w_patch
                                
                                x_norm = np.clip(cx_patch / patch_size, 0.0, 1.0)
                                y_norm = np.clip(cy_patch / patch_size, 0.0, 1.0)
                                w_norm = np.clip(w_patch / patch_size, 0.01, 1.0)
                                h_norm = np.clip(h_patch / patch_size, 0.01, 1.0)
                                
                                craters_in_patch.append((CRATER_CLASS_ID, x_norm, y_norm, w_norm, h_norm))
                                patch_source = "robbins"
                except Exception:
                    pass

            # 2. Fallback to Hough circle extraction if no catalog entries found
            if len(craters_in_patch) == 0:
                cv_boxes = extract_crater_candidates_hough(patch)
                for cx, cy, w, h in cv_boxes:
                    x_norm = np.clip(cx / patch_size, 0.0, 1.0)
                    y_norm = np.clip(cy / patch_size, 0.0, 1.0)
                    w_norm = np.clip(w / patch_size, 0.01, 1.0)
                    h_norm = np.clip(h / patch_size, 0.01, 1.0)
                    craters_in_patch.append((CRATER_CLASS_ID, x_norm, y_norm, w_norm, h_norm))
                patch_source = "hough"

            # Skip completely flat patches without any texture/craters (keep 5% negatives)
            if len(craters_in_patch) == 0 and random.random() > 0.05:
                continue

            # Determine split
            is_train = (total_generated < num_train)
            img_dest = images_train if is_train else images_val
            lbl_dest = labels_train if is_train else labels_val

            patch_id = f"lunar_crater_{total_generated:06d}"
            img_file = img_dest / f"{patch_id}.jpg"
            lbl_file = lbl_dest / f"{patch_id}.txt"

            # Save JPEG image
            cv2.imwrite(str(img_file), patch, [cv2.IMWRITE_JPEG_QUALITY, 95])

            # Write YOLO annotation lines with source header
            with open(lbl_file, "w") as f:
                f.write(f"# source: {patch_source}\n")
                for cid, xn, yn, wn, hn in craters_in_patch:
                    f.write(f"{cid} {xn:.6f} {yn:.6f} {wn:.6f} {hn:.6f}\n")

            total_generated += 1
            total_craters_labeled += len(craters_in_patch)

            if total_generated % 250 == 0 or total_generated == num_patches:
                print(f"    -> Progress: {total_generated}/{num_patches} patches generated ({total_craters_labeled} craters labeled)")

    # Generate data.yaml config
    yaml_content = f"""# SIH 2026 Lunar Crater YOLOv9 Dataset
path: {out_dir.resolve()}
train: images/train
val: images/val

names:
  0: crater
"""
    yaml_path = out_dir / "data.yaml"
    yaml_path.write_text(yaml_content)

    stats = {
        "total_patches": total_generated,
        "train_patches": min(total_generated, num_train),
        "val_patches": max(0, total_generated - num_train),
        "total_craters_labeled": total_craters_labeled,
        "data_yaml": str(yaml_path),
    }

    print("\n" + "=" * 65)
    print("[SUCCESS] YOLO CRATER DATASET GENERATION COMPLETE!")
    print("=" * 65)
    print(f"Total Patches:   {stats['total_patches']} (Train: {stats['train_patches']}, Val: {stats['val_patches']})")
    print(f"Total Craters:   {stats['total_craters_labeled']}")
    print(f"Config YAML:     {stats['data_yaml']}")
    print("=" * 65)

    return stats


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate YOLO Lunar Crater Dataset from Satellite Imagery.")
    parser.add_argument("--images", default="data/reference/nac/", help="Path to lunar source images or directory")
    parser.add_argument("--robbins", default=None, help="Path to Robbins 2018 Crater CSV database (optional)")
    parser.add_argument("--out", default="yolo/dataset", help="Output directory for YOLO dataset")
    parser.add_argument("--num-patches", type=int, default=1000, help="Total number of patches to generate")
    parser.add_argument("--patch-size", type=int, default=640, help="Square patch dimensions in pixels")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for deterministic generation")

    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parent
    workspace_root = repo_root.parent

    img_input = Path(args.images)
    if not img_input.is_absolute():
        if (workspace_root / img_input).exists():
            img_input = workspace_root / img_input
        elif (repo_root / img_input).exists():
            img_input = repo_root / img_input
        else:
            img_input = workspace_root / "code" / img_input

    image_files = []
    if img_input.is_dir():
        image_files = (
            list(img_input.rglob("*.TIF"))
            + list(img_input.rglob("*.tif"))
            + list(img_input.rglob("*.png"))
            + list(img_input.rglob("*.jpg"))
            + list(img_input.rglob("*.img"))
            + list(img_input.rglob("*.IMG"))
        )
    elif img_input.is_file():
        image_files = [img_input]

    # Also include processed benchmark patches from code/data/processed if available
    for p_dir in [workspace_root / "code" / "data" / "processed", repo_root / "data" / "processed"]:
        if p_dir.exists():
            image_files += list(p_dir.glob("*/src.tif")) + list(p_dir.glob("*/ref.tif"))

    out_path = Path(args.out)
    if not out_path.is_absolute():
        out_path = repo_root / out_path

    robbins_path = Path(args.robbins) if args.robbins else None

    generate_yolo_dataset(
        image_paths=image_files,
        robbins_csv=robbins_path,
        out_dir=out_path,
        num_patches=args.num_patches,
        patch_size=args.patch_size,
        seed=args.seed,
    )


if __name__ == "__main__":
    main()
