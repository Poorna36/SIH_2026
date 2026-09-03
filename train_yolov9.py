import os
from pathlib import Path
import env_config
from ultralytics import YOLO

def main():
    print("=================================================================")
    print("STANDALONE YOLOv9 TRAINER FOR PRISTINE CRATER DETECTION")
    print("=================================================================")
    
    yaml_path = env_config.REPO_ROOT / "pristine_dataset" / "data.yaml"
    
    if not yaml_path.exists():
        print(f"[ERROR] Dataset configuration not found at {yaml_path}")
        return
        
    print(f"[INFO] Initializing YOLOv9 Base Architecture (yolov9c.pt)...")
    model = YOLO("yolov9c.pt")
    
    print(f"[INFO] Starting Training on Pristine Synthetic Dataset...")
    print(f"       Configuration: Dense object optimization, mosaic=1.0, high-res.")
    
    # Train for 5 epochs (sufficient for synthetic shapes to demonstrate perfect bounding boxes)
    results = model.train(
        data=str(yaml_path),
        epochs=5,
        imgsz=640,
        batch=8,
        device='',         # Auto-detect GPU, fallback to CPU
        mosaic=1.0,
        mixup=0.2,         # Slight mixup for robustness
        iou=0.5,           # Lower training IoU threshold forces model to separate close boxes
        project='runs/crater_detection',
        name='yolov9_pristine',
        exist_ok=True,
        verbose=True
    )
    
    print("\n[SUCCESS] Standalone Training Complete!")
    print(f"          Best model saved at: runs/crater_detection/yolov9_pristine/weights/best.pt")

if __name__ == "__main__":
    main()
