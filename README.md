# 🌕 Lunar Crater YOLOv9 Training Kit

This directory contains standalone scripts to generate datasets, train, and test **YOLOv9 Crater Detectors** for Lunar Remote Sensing (Chandrayaan-2 & LRO).

---

## ⚡ Quick Start (Run on Colab / Friend's GPU PC)

### 1. Install Dependencies
```bash
pip install ultralytics rasterio opencv-python pandas torch torchvision
```

### 2. Generate the Dataset
Extracts $640\times 640$ training patches and bounding box annotations:

```bash
# Generate 1,000 training patches
python yolo/prepare_dataset.py --num-patches 1000 --patch-size 640
```
*(Automatically creates `yolo/dataset/images/`, `yolo/dataset/labels/`, and `yolo/dataset/data.yaml`)*.

---

### 3. Start Training (GPU / CUDA)
Trains YOLOv9 with AdamW optimizer on the generated crater patches:

```bash
# Train for 50 epochs on GPU 0
python yolo/train.py --data yolo/dataset/data.yaml --model yolov9c.pt --epochs 50 --batch 16 --device 0
```

* **Output Weights**: Automatically saved to `runs/crater_train/yolov9_crater_v1/weights/best.pt`
* **Auto-Export**: Automatically copied to `models/crater_yolov9.pt`

---

### 4. Test the Trained Model
Run inference on any lunar image and visualize detections:

```bash
python yolo/inference_test.py --model models/crater_yolov9.pt --image data/reference/nac/M1415153594LC_PYR.TIF --conf 0.30
```
*(Outputs `results/crater_detections.png` with green bounding boxes and detected crater radii)*.

---

## ☁️ Google Colab 1-Click Training

If training on Google Colab with free T4 GPU:

```python
# Cell 1: Clone & Setup
!git clone https://github.com/Poorna36/SIH_2026.git
%cd SIH_2026
!git checkout feat/yolo-training
!pip install ultralytics rasterio

# Cell 2: Generate Patches
!python yolo/prepare_dataset.py --num-patches 1500

# Cell 3: Train YOLOv9
!python yolo/train.py --epochs 60 --batch 16 --device 0
```

---

## 📤 Delivering the Trained Model

Once training is complete:
1. Commit the exported weights `models/crater_yolov9.pt`:
   ```bash
   git add models/crater_yolov9.pt
   git commit -m "feat(yolo): Add trained YOLOv9 crater detector weights"
   git push origin feat/yolo-training
   ```
2. The model will be automatically loaded by Matcher M3 (`src/matching/crater.py`)!
