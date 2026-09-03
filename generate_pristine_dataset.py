import cv2
import numpy as np
import os
import random
from pathlib import Path
import yaml
import env_config

def generate_noise_background(size):
    """Generate a procedurally noisy background resembling lunar terrain."""
    base = np.random.randint(100, 150, (size, size), dtype=np.uint8)
    base = cv2.GaussianBlur(base, (15, 15), 0)
    noise = np.random.normal(0, 15, (size, size)).astype(np.int8)
    bg = cv2.add(base, noise.astype(np.uint8))
    return bg

def draw_synthetic_crater(img, cx, cy, radius):
    """Draw a realistic-looking synthetic crater with light/shadow and return exact bounding box."""
    # Simulate directional sunlight (top-left to bottom-right)
    # Bright rim on top-left, dark shadow inside top-left, bright ejecta outside bottom-right, dark shadow on rim bottom-right
    
    thickness = max(2, int(radius * 0.15))
    
    # Crater Floor (darker)
    cv2.circle(img, (cx, cy), radius, (90, 90, 90), -1)
    
    # Shadow crescent (inside top-left)
    cv2.ellipse(img, (cx, cy), (radius, radius), 45, 0, 180, (50, 50, 50), -1)
    
    # Bright inner crescent (inside bottom-right)
    cv2.ellipse(img, (cx, cy), (radius, radius), 45, 180, 360, (160, 160, 160), -1)
    
    # Rim top-left (bright)
    cv2.ellipse(img, (cx, cy), (radius + thickness//2, radius + thickness//2), 45, 180, 360, (200, 200, 200), thickness)
    
    # Rim bottom-right (dark)
    cv2.ellipse(img, (cx, cy), (radius + thickness//2, radius + thickness//2), 45, 0, 180, (60, 60, 60), thickness)
    
    # Blend slightly
    mask = np.zeros_like(img)
    cv2.circle(mask, (cx, cy), radius + thickness + 2, (255, 255, 255), -1)
    blur_area = cv2.GaussianBlur(img, (5, 5), 0)
    img = np.where(mask > 0, blur_area, img)
    
    # Calculate exact bounding box for YOLO
    r_total = radius + thickness
    x1 = cx - r_total
    y1 = cy - r_total
    x2 = cx + r_total
    y2 = cy + r_total
    
    return img, (x1, y1, x2, y2)

def generate_dataset(num_images, output_dir, prefix, img_size=640):
    img_dir = Path(output_dir) / "images" / prefix
    lbl_dir = Path(output_dir) / "labels" / prefix
    img_dir.mkdir(parents=True, exist_ok=True)
    lbl_dir.mkdir(parents=True, exist_ok=True)
    
    for i in range(num_images):
        img = generate_noise_background(img_size)
        img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
        
        num_craters = random.randint(3, 15)
        labels = []
        
        # Keep track of centers to allow some overlap but prevent total nesting for clean baseline
        craters = []
        
        for _ in range(num_craters):
            radius = random.randint(15, 80)
            cx = random.randint(radius + 10, img_size - radius - 10)
            cy = random.randint(radius + 10, img_size - radius - 10)
            
            img, (x1, y1, x2, y2) = draw_synthetic_crater(img, cx, cy, radius)
            
            # Convert to YOLO format: class_id cx cy w h (normalized)
            n_cx = (x1 + x2) / 2.0 / img_size
            n_cy = (y1 + y2) / 2.0 / img_size
            n_w = (x2 - x1) / img_size
            n_h = (y2 - y1) / img_size
            
            labels.append(f"0 {n_cx:.6f} {n_cy:.6f} {n_w:.6f} {n_h:.6f}")
        
        # Save image
        img_path = img_dir / f"synth_crater_{i:04d}.jpg"
        cv2.imwrite(str(img_path), img)
        
        # Save label
        lbl_path = lbl_dir / f"synth_crater_{i:04d}.txt"
        with open(lbl_path, "w") as f:
            f.write("\n".join(labels))
            
    print(f"[SUCCESS] Generated {num_images} {prefix} images and labels.")

def main():
    print("=================================================================")
    print("SYNTHETIC PRISTINE LUNAR CRATER GENERATOR (YOLO FORMAT)")
    print("=================================================================")
    
    base_dir = str((env_config.REPO_ROOT / "pristine_dataset").resolve())
    
    generate_dataset(num_images=100, output_dir=base_dir, prefix="train", img_size=640)
    generate_dataset(num_images=25, output_dir=base_dir, prefix="val", img_size=640)
    
    # Generate data.yaml
    yaml_data = {
        'path': base_dir,
        'train': 'images/train',
        'val': 'images/val',
        'names': {0: 'crater'}
    }
    
    yaml_path = Path(base_dir) / "data.yaml"
    with open(yaml_path, "w") as f:
        yaml.dump(yaml_data, f, default_flow_style=False)
        
    print(f"[SUCCESS] Wrote dataset configuration to {yaml_path}")

if __name__ == "__main__":
    main()
