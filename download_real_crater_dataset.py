#!/usr/bin/env python3
"""
download_real_crater_dataset.py
================================
Downloads and converts real lunar crater annotations from the curated
Roboflow/Darshleen01 Moon Crater Dataset into standard YOLO format.

Features:
- Real optical lunar imagery (Apollo & LRO NAC).
- Verified human annotations (no Hough circle noise).
- 100% compliant YOLO label format (no comment lines, normalized [0, 1]).
"""

import json
import os
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import List, Tuple

REPO_ROOT = Path(__file__).resolve().parent
DATASET_DIR = REPO_ROOT / "dataset"
IMAGES_DIR = DATASET_DIR / "images"
LABELS_DIR = DATASET_DIR / "labels"

HF_BASE = "https://huggingface.co/datasets/Darshleen01/crater-boulder-moon-coco-format-small/resolve/main"


def fetch_metadata(split: str) -> List[dict]:
    url = f"{HF_BASE}/{split}/metadata.jsonl"
    print(f"[*] Fetching metadata for split '{split}' from {url}...")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    records = []
    with urllib.request.urlopen(req, timeout=30) as resp:
        for line in resp:
            line = line.decode("utf-8").strip()
            if line:
                records.append(json.loads(line))
    print(f"[OK] Loaded {len(records)} metadata records for split '{split}'.")
    return records


def download_single_item(args: Tuple[str, dict, Path, Path]) -> bool:
    split, record, img_dir, lbl_dir = args
    file_name = record["file_name"]
    img_dest = img_dir / file_name
    lbl_dest = lbl_dir / f"{Path(file_name).stem}.txt"

    # 1. Download image if not already present
    if not img_dest.exists():
        img_url = f"{HF_BASE}/{split}/{file_name}"
        try:
            req = urllib.request.Request(img_url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=20) as r, open(img_dest, "wb") as f:
                f.write(r.read())
        except Exception as e:
            # print(f"[WARN] Failed to download {file_name}: {e}")
            return False

    # 2. Convert COCO bounding boxes to YOLO format
    # COCO bbox: [x_min, y_min, width, height] in pixels
    w_img = float(record.get("width", 640))
    h_img = float(record.get("height", 640))
    bboxes = record.get("objects", {}).get("bbox", [])

    yolo_lines = []
    for bbox in bboxes:
        if len(bbox) < 4:
            continue
        x_min, y_min, bw, bh = bbox[:4]
        if bw <= 1.0 or bh <= 1.0:
            continue

        cx = (x_min + bw / 2.0) / w_img
        cy = (y_min + bh / 2.0) / h_img
        nw = bw / w_img
        nh = bh / h_img

        # Strict clipping to [0.0, 1.0]
        cx = max(0.001, min(0.999, cx))
        cy = max(0.001, min(0.999, cy))
        nw = max(0.002, min(0.999, nw))
        nh = max(0.002, min(0.999, nh))

        # Single class: 0 (crater)
        yolo_lines.append(f"0 {cx:.6f} {cy:.6f} {nw:.6f} {nh:.6f}")

    with open(lbl_dest, "w") as f:
        f.write("\n".join(yolo_lines) + "\n")

    return True


def prepare_split(split_name: str, hf_split: str, max_samples: int) -> int:
    img_dir = IMAGES_DIR / split_name
    lbl_dir = LABELS_DIR / split_name
    img_dir.mkdir(parents=True, exist_ok=True)
    lbl_dir.mkdir(parents=True, exist_ok=True)

    records = fetch_metadata(hf_split)[:max_samples]
    print(f"[*] Downloading and preparing {len(records)} images for '{split_name}'...")

    tasks = [(hf_split, rec, img_dir, lbl_dir) for rec in records]

    success_count = 0
    with ThreadPoolExecutor(max_workers=16) as pool:
        for ok in pool.map(download_single_item, tasks):
            if ok:
                success_count += 1
                if success_count % 100 == 0:
                    print(f"    -> Progress: {success_count}/{len(records)} downloaded")

    print(f"[OK] Completed split '{split_name}': {success_count} images ready.")
    return success_count


def write_data_yaml():
    yaml_content = f"""# Lunar Crater YOLOv8/v9 Dataset Configuration (SIH 2026)
path: {DATASET_DIR.resolve()}
train: images/train
val: images/val

names:
  0: crater
"""
    yaml_path = DATASET_DIR / "data.yaml"
    with open(yaml_path, "w") as f:
        f.write(yaml_content)
    print(f"[OK] Dataset YAML created at: {yaml_path}")


def main():
    print("=" * 65)
    print("EXTENDED REAL LUNAR CRATER DATASET ACQUISITION (2,400 IMAGES)")
    print("=" * 65)

    # Clean existing dataset if needed
    import shutil
    if DATASET_DIR.exists():
        print("[*] Refreshing dataset directory for extended training...")
        shutil.rmtree(DATASET_DIR)

    # 1,200 from test split + 800 from validation split -> train
    # 400 from validation split -> val
    # To keep code simple, fetch from test and validation
    n_train = prepare_split(split_name="train", hf_split="validation", max_samples=2000)
    n_val = prepare_split(split_name="val", hf_split="test", max_samples=400)

    write_data_yaml()

    print("=" * 65)
    print(f"[SUCCESS] Extended dataset preparation complete! ({n_train} train, {n_val} val)")
    print("=" * 65)


if __name__ == "__main__":
    main()
