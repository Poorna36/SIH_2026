import os
from pathlib import Path
import env_config
from ultralytics import YOLO

def main():
    print("=================================================================")
    print("ACCURATE YOLOv9c FINE-TUNER FOR LUNAR CRATER DETECTION")
    print("=================================================================")
    
    yaml_path = env_config.REPO_ROOT / "real_dataset" / "real_data.yaml"
    
    if not yaml_path.exists():
        print(f"[ERROR] Dataset configuration not found at {yaml_path}")
        return
        
    print(f"[INFO] Initializing YOLOv9c Base Architecture (yolov9c.pt)...")
    model = YOLO("yolov9c.pt")
    
    print(f"[INFO] Starting Training on Real-World Auto-Annotated Dataset...")
    print(f"       Configuration: High-res tiles, mosaic=1.0, precision-focused.")
    
    # Train for 15 epochs to lock onto real lunar topologies with perfect bounding box rules
    results = model.train(
        data=str(yaml_path),
        epochs=15,
        imgsz=640,
        batch=8,           # Optimal GPU batch size
        device='0',        # Use CUDA GPU 0
        workers=0,         # Synchronous loading prevents Windows WinError 1455 memory paging limit
        mosaic=1.0,        
        mixup=0.1,         
        iou=0.6,           # Standard IoU during training
        project='runs/crater_detection',
        name='yolov9_real_finetuned',
        exist_ok=True,
        verbose=True
    )
    
    print("\n[SUCCESS] Advanced Fine-Tuning Complete!")
    print(f"          High-Fidelity Model saved at: runs/crater_detection/yolov9_real_finetuned/weights/best.pt")

if __name__ == "__main__":
    main()
