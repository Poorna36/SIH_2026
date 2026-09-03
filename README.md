# SIH 2026 — PS-26166: Lunar Image Correspondence (LRO Reference Automation)

**Problem**: Multi-modal, Sun-angle & scale-invariant image correspondence using Chandrayaan-2 optical images (OHRC / TMC-2 / IIRS) vs lunar reference imagery.

This repo currently contains the **data-collection + LRO reference automation layer** of the full registration pipeline.

## Run the connected dashboard

Install the backend dependencies and start the API from the `backend` directory:

```bash
cd backend
python -m pip install -r requirements.txt
python -m api.server
```

The API listens on `http://localhost:8000`. Verify it with `http://localhost:8000/api/health`.

The crater matcher uses the trained YOLO weight at `models/crater_yolov9.pt` from the repository's `feat/backend-yolo` branch. Install `ultralytics` from `requirements.txt` or `environment.yml` to enable YOLO inference; otherwise the matcher uses its documented Hough fallback.

In a second terminal, start the dashboard:

```bash
cd sih-dashboard
npm install
npm run dev
```

Open `http://localhost:5173`. The dashboard uses live API data when the health endpoint is available and falls back to mock data when it is not.

For a deployed or preview frontend, set `VITE_API_BASE_URL` to the backend URL before building:

```bash
VITE_API_BASE_URL=https://api.example.com npm run build
```

---

# Clone & get the LRO reference data yourself (no login, no manual download)

```bash
git clone <this-repo-url>
cd SIH_2026

# 1) Fetch full-resolution ("science") LRO NAC strips for your ROIs
python scripts/fetch_lroc_nac.py nac --manifest data/metadata/roi_manifest.csv \
    --download-img --max-incidence 90 --max-res 2.0 --limit 2

# 2) Fetch LRO WAC tiles (for TMC-2 / IIRS pairing)
python scripts/fetch_lroc_nac.py wac --manifest data/metadata/roi_manifest.csv --limit 2

# 3) Or a single ROI directly
python scripts/fetch_lroc_nac.py nac \
    --min-lat -6.5 --max-lat -5.5 --min-lon 1.0 --max-lon 2.0 \
    --download-img --max-incidence 60 --max-res 2.0 --limit 2
```

**What you get** (→ `data/reference/nac/`, `data/reference/wac/`):
- `*.IMG` — full-resolution NAC CDR (~0.5–2 m/px, the science product)
- `*.XML` — PDS4 metadata (footprint, solar incidence/azimuth, GSD)
- `*_PYR.TIF` — browse quick-look (preview only; **use `.IMG` for matching**)
- `manifest.jsonl` — auto-index with per-strip geometry/illumination metadata

Requires: **Python 3.9+** (stdlib only — `urllib`, `json`, `csv`). No pip installs, no API key.

### Filters
| Flag | Meaning |
|---|---|
| `--download-img` | Also grab the large `.IMG` science data (default = browse only) |
| `--max-incidence 60` | Only well-lit strips (≤60° solar incidence) |
| `--min-res / --max-res` | GSD band filter (m/px) |
| `--manifest file.csv` | Batch: loop over ROIs in the CSV |

>  The `_PYR.TIF` browse files are **downsampled quick-looks**. For sub-pixel feature matching against OHRC, always include `--download-img`.

---

# What's in the repo

| Path | Purpose |
|---|---|
| `scripts/fetch_lroc_nac.py` | **Automated LRO NAC/WAC downloader** (NASA Lunar ODE REST API) |
| `data/metadata/roi_manifest.csv` | ROI template CSV (batch downloads) |
| `DATA_COLLECTION_GUIDE.md` | Full CH-2 (OHRC/TMC-2/IIRS) + LRO data collection walkthrough |
| `.gitignore` | Keeps all downloaded data out of git (data is re-downloadable) |

# Architecture docs
Full pipeline design: `PIPELINE.md`, `ARCHITECTURE.md`, `CONFIGURATION.md`, `INTERFACES.md`, `VALIDATION.md`, `DECISIONS.md`, `FEATURES.md`, `IMPLEMENTATION_PLAN.md`.

---

#Data provenance
LRO NAC/WAC data is **public domain** (NASA PDS). Source: [Lunar Orbital Data Explorer (ODE)](https://ode.rsl.wustl.edu/moon/) REST API. Chandrayaan-2 source data comes from ISRO's [PRADAN](https://pradan.issdc.gov.in/) archive (requires a free account; manual download).
