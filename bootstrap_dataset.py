import cv2
import numpy as np
import os
import yaml
from pathlib import Path
import env_config

def detect_perfect_craters_algorithmic(img_path):
    """Uses classical computer vision to detect perfect circles (craters) on real lunar terrain."""
    if "ch2_iir" in img_path.name.lower():
        print(f"[WARN] Skipping unsupported IIRS instrument file '{img_path.name}' (IIRS hyperspectral data is unsuitable for crater bounding box detection).")
        return None, []
    img = cv2.imread(str(img_path))
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # Enhance contrast (CLAHE) for better rim detection
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
    enhanced = clahe.apply(gray)
    
    # Bilateral filter to preserve edges but remove noise
    blur = cv2.bilateralFilter(enhanced, 9, 75, 75)
    
    # Detect circles using Hough Transform (highly accurate for perfect craters)
    circles = cv2.HoughCircles(
        blur, cv2.HOUGH_GRADIENT, dp=1.2, minDist=30,
        param1=50, param2=30, minRadius=10, maxRadius=100
    )
    
    bboxes = []
    if circles is not None:
        circles = np.round(circles[0, :]).astype("int")
        for (x, y, r) in circles:
            # Ensure crater is fully within image bounds
            if x - r > 0 and y - r > 0 and x + r < img.shape[1] and y + r < img.shape[0]:
                bboxes.append([x - r, y - r, x + r, y + r])
                
    return img, bboxes

def create_yolo_tiles(img, bboxes, tile_size, output_dir, prefix, split):
    img_h, img_w = img.shape[:2]
    img_out_dir = output_dir / "images" / split
    lbl_out_dir = output_dir / "labels" / split
    
    img_out_dir.mkdir(parents=True, exist_ok=True)
    lbl_out_dir.mkdir(parents=True, exist_ok=True)
    
    tile_id = 0
    stride = tile_size // 2 # 50% overlap for dense training
    
    for y_start in range(0, img_h - tile_size + 1, stride):
        for x_start in range(0, img_w - tile_size + 1, stride):
            x_end = x_start + tile_size
            y_end = y_start + tile_size
            
            tile_img = img[y_start:y_end, x_start:x_end]
            tile_labels = []
            
            # Find bboxes fully inside this tile
            for (bx1, by1, bx2, by2) in bboxes:
                # Check intersection
                ix1 = max(x_start, bx1)
                iy1 = max(y_start, by1)
                ix2 = min(x_end, bx2)
                iy2 = min(y_end, by2)
                
                if ix1 < ix2 and iy1 < iy2:
                    # Keep only if mostly inside the tile (to avoid cut-off craters)
                    orig_area = (bx2 - bx1) * (by2 - by1)
                    inter_area = (ix2 - ix1) * (iy2 - iy1)
                    if inter_area / orig_area > 0.8:
                        # Normalize coordinates for YOLO
                        n_cx = ((ix1 + ix2) / 2.0 - x_start) / tile_size
                        n_cy = ((iy1 + iy2) / 2.0 - y_start) / tile_size
                        n_w = (ix2 - ix1) / tile_size
                        n_h = (iy2 - iy1) / tile_size
                        
                        # Clip to 0-1
                        n_cx = max(0.0, min(1.0, n_cx))
                        n_cy = max(0.0, min(1.0, n_cy))
                        n_w = max(0.0, min(1.0, n_w))
                        n_h = max(0.0, min(1.0, n_h))
                        
                        tile_labels.append(f"0 {n_cx:.6f} {n_cy:.6f} {n_w:.6f} {n_h:.6f}")
            
            import random
            if len(tile_labels) == 0 and random.random() > 0.05:
                continue  # Retain ~5% negative (crater-free) tiles to train background rejection

            img_name = f"{prefix}_tile_{tile_id:04d}.jpg"
            lbl_name = f"{prefix}_tile_{tile_id:04d}.txt"

            cv2.imwrite(str(img_out_dir / img_name), tile_img)
            with open(lbl_out_dir / lbl_name, "w") as f:
                f.write("\n".join(tile_labels))

            tile_id += 1
                
    print(f"[INFO] Generated {tile_id} tiles containing verified craters from {prefix}.")
    return tile_id

def main():
    print("=================================================================")
    print("REAL-WORLD DATASET BOOTSTRAPPER (AUTO-ANNOTATION)")
    print("=================================================================")
    
    # Input real images from user (stored on D drive)
    sample_dir = env_config.SAMPLE_IMAGES_DIR
    img1_path = sample_dir / "img1_highlands.jpg"
    img2_path = sample_dir / "img2_copernicus.png"
    
    out_dir = env_config.REPO_ROOT / "real_dataset"
    out_dir.mkdir(parents=True, exist_ok=True)
    
    total_tiles = 0
    
    # Process Image 1 (Train)
    if img1_path.exists():
        print(f"[INFO] Processing Image 1 (Highlands) for Training Data...")
        img1, bboxes1 = detect_perfect_craters_algorithmic(img1_path)
        print(f"[SUCCESS] Algorithmic Auto-Annotation detected {len(bboxes1)} perfect craters in Image 1.")
        # We slice into 128x128 tiles due to the density
        total_tiles += create_yolo_tiles(img1, bboxes1, tile_size=128, output_dir=out_dir, prefix="img1_train", split="train")
        
    # Process Image 2 (Train + Val)
    if img2_path.exists():
        print(f"[INFO] Processing Image 2 (Copernicus) for Training/Validation Data...")
        img2, bboxes2 = detect_perfect_craters_algorithmic(img2_path)
        print(f"[SUCCESS] Algorithmic Auto-Annotation detected {len(bboxes2)} perfect craters in Image 2.")
        
        # Process Image 2
        total_tiles += create_yolo_tiles(img2, bboxes2, tile_size=128, output_dir=out_dir, prefix="img2_train", split="train")

    # Split 20% of generated train tiles into val split for validation
    train_imgs = list((out_dir / "images" / "train").glob("*.jpg"))
    import random
    random.seed(42)
    random.shuffle(train_imgs)
    num_val = max(1, int(len(train_imgs) * 0.2))
    val_imgs = train_imgs[:num_val]

    val_img_dir = out_dir / "images" / "val"
    val_lbl_dir = out_dir / "labels" / "val"
    val_img_dir.mkdir(parents=True, exist_ok=True)
    val_lbl_dir.mkdir(parents=True, exist_ok=True)

    for img_p in val_imgs:
        lbl_p = out_dir / "labels" / "train" / f"{img_p.stem}.txt"
        img_p.rename(val_img_dir / img_p.name)
        if lbl_p.exists():
            lbl_p.rename(val_lbl_dir / lbl_p.name)

    print(f"[INFO] Allocated {len(train_imgs) - num_val} tiles to train, {num_val} tiles to val split.")

    # Generate data.yaml
    yaml_data = {
        'path': str(out_dir),
        'train': 'images/train',
        'val': 'images/val',
        'names': {0: 'crater'}
    }
    
    yaml_path = out_dir / "real_data.yaml"
    with open(yaml_path, "w") as f:
        yaml.dump(yaml_data, f, default_flow_style=False)
        
    print(f"\n[SUCCESS] Bootstrapped Dataset Complete!")
    print(f"          Total Tiles Generated: {total_tiles}")
    print(f"          Configuration Saved: {yaml_path}")

if __name__ == "__main__":
    main()
