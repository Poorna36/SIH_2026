# Chandrayaan-2 Calibrated (Level-2) Data Collection Guide
## SIH 2026 — PS-26166: Lunar Image Correspondence Pipeline

> **Decision:** We use **only Calibrated Level-2 data** for all sensors.
> No raw (EDR) processing, no USGS ISIS3 calibration steps needed.
> Aligns with: `CONFIGURATION.md §2`, `PIPELINE.md S0–S2`, `INTERFACES.md PairRecord`

---

## 📋 What to Collect — Complete Checklist

### Chandrayaan-2 Source Data (Manual Download from PRADAN)

| # | Sensor | GSD | Level | PRADAN Search | File Pattern | Pipeline Use |
|---|--------|-----|-------|---------------|-------------|--------------|
| 1 | **OHRC** | 0.25 m | L2 Calibrated | Instrument: OHRC | `ch2_ohr_nrp_*_d_img_d18.zip` | Primary source (OHRC→NAC pair) |
| 2 | **TMC-2** | 5 m | L2 Calibrated | Instrument: TMC-2 | `ch2_tmc_nrp_*_d_img_d32.zip` | Secondary source (TMC→WAC pair) |
| 3 | **IIRS** | 80 m | L2 Calibrated | Instrument: IIRS | `ch2_iir_nrp_*_d_img_d32.zip` | Parallel track (IIRS→WAC pair) |

### LRO Reference Data (Automated by Script)

| # | Product | GSD | ODE Product Type | Script Command | Pipeline Use |
|---|---------|-----|-----------------|----------------|--------------|
| 1 | **LRO NAC CDR** | 0.5 m/px | `CDRNAC4` | `python scripts/fetch_lroc_nac.py nac` | OHRC reference (ref.type=NAC) |
| 2 | **LRO WAC CDR** | 100 m/px | `CDRWAC4` | `python scripts/fetch_lroc_nac.py wac` | TMC-2 + IIRS reference (ref.type=WAC) |

---

## 🔐 Step 1: Create ISRO PRADAN Account (One-Time)

1. Go to **[https://pradan.issdc.gov.in](https://pradan.issdc.gov.in)**
2. Click **"Register"** → fill details → verify email
3. Login with your credentials

> [!NOTE]
> PRADAN is the **only** source for Chandrayaan-2 data. No public API exists.
> You only need to download 2–3 pilot strips manually (total ~350 MB).

---

## 📥 Step 2: Download OHRC Data

### Search Parameters
| Parameter | Value |
|-----------|-------|
| Mission | Chandrayaan-2 |
| Instrument | **OHRC** (Orbiter High Resolution Camera) |
| Processing Level | **Level-2** (Calibrated, Radiometrically Corrected) |
| Date Range | 2019-09-01 to present |
| Region | Use bounding box or click on map |

### File Structure After Unzip
```
ch2_ohr_nrp_YYYYMMDDTHHMMSS_d_img_d18.zip
├── ch2_ohr_nrp_*_d_img_d18.img     ← 16-bit panchromatic image
├── ch2_ohr_nrp_*_d_img_d18.lbl     ← PDS3 label
└── ch2_ohr_nrp_*_d_img_d18.xml     ← Extended metadata (CRITICAL: has lat/lon/angles)
```

### Critical Metadata (from .xml — used by `ingest.py` S1)
```xml
<CENTER_LATITUDE>-6.08</CENTER_LATITUDE>        ← Pipeline uses for ODE bbox query
<CENTER_LONGITUDE>1.25</CENTER_LONGITUDE>        ← Pipeline uses for ODE bbox query
<SOLAR_INCIDENCE_ANGLE>72.3</SOLAR_INCIDENCE_ANGLE> ← Determines preprocessing branch
<SOLAR_AZIMUTH_ANGLE>245.1</SOLAR_AZIMUTH_ANGLE>    ← Used for delta_azimuth_deg
<MAP_SCALE>0.25</MAP_SCALE>                          ← GSD → PairRecord.src.gsd_m
```

### After Download
```bash
# ⚠️ NEVER rename files — isisimport parses the original ISRO filename
unzip ch2_ohr_nrp_*.zip -d data/raw/
```

---

## 📥 Step 3: Download TMC-2 Data

### Search Parameters
| Parameter | Value |
|-----------|-------|
| Mission | Chandrayaan-2 |
| Instrument | **TMC-2** (Terrain Mapping Camera 2) |
| Processing Level | **Level-2** |
| Region | Same region as OHRC |

### After Download
```bash
unzip ch2_tmc_nrp_*.zip -d data/raw/
```

---

## 📥 Step 4: Download IIRS Data (Parallel Track)

> [!IMPORTANT]
> IIRS is handled by a **separate module** (`configs/iirs_wac.yaml`).
> Never fold IIRS into the main OHRC-NAC / TMC-WAC pipeline.
> See: `CONFIGURATION.md §10` — `separate_module: true`

### Search Parameters
| Parameter | Value |
|-----------|-------|
| Mission | Chandrayaan-2 |
| Instrument | **IIRS** (Imaging Infrared Spectrometer) |
| Processing Level | **Level-2** |

### After Download
```bash
unzip ch2_iir_nrp_*.zip -d data/raw/
```

---

## 🤖 Step 5: Automated LRO Reference Download

Once you have CH-2 files in `data/raw/`, the script handles everything else:

```bash
# Parse CH-2 XML to extract coordinates (done by S1 ingest.py)
# For now, use coordinates from the .xml file manually:

# Download 5 matching calibrated NAC strips (ref.type=NAC):
python scripts/fetch_lroc_nac.py nac \
    --min-lat -6.5 --max-lat -5.5 \
    --min-lon 1.0  --max-lon 2.0  \
    --limit 5

# Download matching WAC strips (ref.type=WAC, for TMC-2 pairs):
python scripts/fetch_lroc_nac.py wac \
    --min-lat -6.5 --max-lat -5.5 \
    --min-lon 1.0  --max-lon 2.0

# Batch download for multiple ROIs:
python scripts/fetch_lroc_nac.py nac --manifest data/metadata/roi_manifest.csv
```

### Reference Fallback Chain (from CONFIGURATION.md §2.2)
```
reference_fallback_chain: [nac_ode, wac_crop, selene_wmts]
```
1. **NAC via ODE** → Script queries automatically
2. **WAC 643nm crop** → GDAL crop from local global mosaic
3. **SELENE Moon Trek WMTS** → Future-compatible (marked `selene_status: future_compatible`)

---

## 📁 Step 6: Final Directory Structure

```
data/
├── raw/                                    ← CH-2 downloads (NEVER rename files)
│   ├── ch2_ohr_nrp_20200827T0030107497_d_img_d18.img
│   ├── ch2_ohr_nrp_20200827T0030107497_d_img_d18.lbl
│   ├── ch2_ohr_nrp_20200827T0030107497_d_img_d18.xml
│   ├── ch2_tmc_nrp_*.img
│   └── ch2_iir_nrp_*.img
│
├── calibrated/                             ← S1 output: ISIS .cub files
│   └── (generated by scripts/ingest.py)
│
├── reference/                              ← LRO reference (auto-downloaded)
│   ├── nac/
│   │   ├── M1410460825LC_PYR.TIF           ← Calibrated GeoTIFF (0.5 m/px)
│   │   ├── M1410460825LC.XML               ← PDS4 metadata
│   │   └── manifest.jsonl                  ← Auto-generated product index
│   ├── wac/
│   │   └── (WAC CDR strips)
│   └── wac_643nm.tif                       ← Global WAC mosaic (CONFIGURATION.md §2.2)
│
├── pairs/                                  ← S2 output
│   └── manifest.jsonl                      ← PairRecord entries (INTERFACES.md §1)
│
├── processed/                              ← S3 output
│   └── <pair_id>/
│       ├── src.tif
│       ├── ref.tif
│       ├── valid_mask.png
│       ├── tiles.geojson
│       └── meta.json
│
└── metadata/
    ├── products.jsonl                      ← S1 output: per-product metadata
    ├── gt/                                 ← Ground truth checkpoints
    └── roi_manifest.csv                    ← ROI definitions for batch download
```

---

## ⚠️ Critical Rules (from Architecture Docs)

1. **NEVER rename** Chandrayaan-2 filenames — `isisimport` parses tokens from the original ISRO filename (`PIPELINE.md S1`, `CONFIGURATION.md §2.1: preserve_filename: true`)
2. **Always use Level-2 Calibrated** — Level-1 raw requires ISIS3 `lronaccal`/`ohrcal` calibration we skip
3. **Keep ALL `.xml` files** — the pipeline parses lat/lon/solar angles from XML in S1 (`ingest.py`)
4. **LRO NAC/WAC is 100% automated** — never manually download LRO products
5. **IIRS is a separate module** — never mix with OHRC-NAC / TMC-WAC pipeline
6. **crater_density must have units** — always `craters/km²`, never unitless (`CONFIGURATION.md §2.2`)

---

## 🎯 Pilot Dataset (3 Pairs — from PIPELINE.md §7 Checklist)

| Pair | Source | Reference | Expected Size |
|------|--------|-----------|---------------|
| 1 | OHRC strip (equatorial) | LRO NAC (auto) | ~200 + 15 MB |
| 2 | OHRC strip (different sun angle) | LRO NAC (auto) | ~200 + 15 MB |
| 3 | TMC-2 strip | LRO WAC (auto) | ~50 + 5 MB |

**Total pilot: ~500 MB**

After these 3 pairs pass S1–S9 with M0 (SIFT), expand to RIFT2, LightGlue, and Crater matchers.
