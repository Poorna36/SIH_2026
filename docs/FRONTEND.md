# Lunar Mission Control Dashboard Specification
## SIH 2026 PS-26166: Frontend Architecture and Interface Standards

This document specifies the architecture, component hierarchy, 3D visualization engine, 2D inspection modes, and backend integration protocols for the lunar exploration dashboard (`sih-dashboard`).

---

## 1. System Architecture

The frontend is structured as an interactive scientific mission-control dashboard for exploring Chandrayaan-2 lunar imagery, evaluating cross-sensor co-registration results, and analyzing terrain morphology and hydration signatures.

### Core Technology Stack
- Framework: React 18, TypeScript, Vite
- 3D Geospatial Engine: CesiumJS (custom lunar reference ellipsoid $R = 1,737.4\text{ km}$)
- 3D Physics and Rendering: Three.js (GLSL shaders, Lommel-Seeliger scattering, orbital satellite models)
- Scientific Plotting: Recharts (250-band IIRS hyperspectral absorption profiles)
- Styling and Theme: Vanilla CSS and TailwindCSS with frosted glassmorphism tokens
- Icons and Typography: Lucide React vector icons; tabular monospace numeric readouts

---

## 2. Component Hierarchy and Layout

```text
App.tsx
├── Header.tsx                          (Mission clock IST/UTC, backend link status, active target pill)
├── TopTargetCarousel                   (Target crater selector pills with status beacons)
├── Main Viewport Layout
│   ├── Left Sidebar (SidebarControls)  (Pair ingestion, L1 preprocessing toggles, matcher configuration)
│   ├── Center Viewport
│   │   ├── CesiumViewer.tsx            (3D Moon globe, surface navigation, crater pins, swath draping)
│   │   └── KeypointViewer.tsx          (2D registration inspection, swipe, checkerboard, residual vectors)
│   └── Right Sidebar (SciencePanel)    (Terrain telemetry, match verdict, SLZ score, IIRS spectral plot)
└── Modals / Overlays                   (Satellite telemetry drawer, contact modal, export dialogs)
```

---

## 3. 3D Lunar Visualization Engine (`CesiumViewer.tsx`)

### Planetary Basemap and Shading
- Basemap: 8K NASA LROC master mosaic (8192 x 4096) with micro-relief and ray system visibility.
- Surface Scattering: Custom regolith illumination modeling with high contrast across the solar terminator. Zero atmospheric scattering or distance haze bleed-through.
- Camera Controls: Smooth momentum-based orbiting (`inertiaZoom: 0.65`, `inertiaSpin: 0.70`, `maximumMovementRatio: 0.04`) with pitch limits preventing gimbal flipping at the lunar poles.

### Crater Selection and Trajectory Navigation
- Target Navigation: Single-click selection from the top carousel or 3D globe pins initiates a 2.2-second quadratic camera descent directly to the target feature.
- Bounding Box Computation: Dynamically calculated using `computeAccurateCraterRectangle()`:

$$\Delta\text{lon} = \frac{\text{diameter}}{R_{\text{moon}} \cdot \cos(\phi)}, \quad \Delta\text{lat} = \frac{\text{diameter}}{R_{\text{moon}}}$$

- Swath Clamping: High-resolution local OHRC (0.3m) and IIRS swaths clamp to $\min(\text{diameter}, 28\text{ km})$ to prevent oversized rectangular textures across large maria basins.

---

## 4. 2D Quality Control and Registration Inspector (`KeypointViewer.tsx`)

The 2D co-registration panel provides verification tools for inspecting correspondence alignment accuracy:

### Visualization Modes
1. Vector Correspondence Mode: Renders connected feature vectors between source and reference keypoints with color-coded confidence weights.
2. Residual Error Vector Mode: Color-coded residual vectors indicating sub-pixel deviation against ground truth:
   - Green: Residual $< 0.5\text{ px}$ (optimal sub-pixel alignment)
   - Yellow: Residual between $0.5\text{ px}$ and $1.0\text{ px}$
   - Red: Residual $> 1.0\text{ px}$ (geometric outlier)
3. 64px Conic Checkerboard Mode: Alternating image squares verify visual continuity of continuous geological features (such as crater rims and rilles) across the registered boundary.
4. Interactive Swipe Divider: Draggable horizontal/vertical split divider for direct before-and-after warp comparison.

---

## 5. Scientific Telemetry and Diagnostics (`SciencePanel.tsx`)

### Mission Telemetry Display
- Solar Geometry: Incident angle ($\theta_{\text{inc}}$), emission angle ($\theta_{\text{emi}}$), and phase angle ($\alpha$).
- Spatial Resolution: Source GSD vs reference GSD with scale ratio indicators.
- Terrain Classification: Highland, mare, polar, or crater floor classifications with terrain roughness coefficients.
- Crater Density: Quantitative density ($\text{craters/km}^2$) controlling matcher gating.

### Hyperspectral Analysis (IIRS Profile)
- Displays continuous 250-band reflectance across $0.8\ \mu\text{m}$ to $5.0\ \mu\text{m}$.
- Highlights the diagnostic $2.8\ \mu\text{m} - 3.0\ \mu\text{m}$ hydroxyl/water-ice absorption band.

### Landing Safety Certification (SLZ)
- Evaluates terrain slope ($< 10^\circ$), boulder hazard density, and registration confidence to produce an aggregated Safe Landing Zone index.

---

## 6. Backend API Integration and Resilience (`services/api.ts`)

The dashboard features dual operational modes with automatic fallback:

### Operational Modes
- Live Mode: Connects to the FastAPI backend service (`http://localhost:8000`). Periodically polls health checks (`GET /api/health`), loads real PDS4 pair catalogs (`GET /api/datasets`), and dispatches pipeline runs (`POST /api/pipeline/run`).
- Standalone / Fallback Mode: When the backend service is offline, the interface automatically switches to embedded mock datasets with zero disruption or UI errors.

### Key API Endpoints
- `GET /api/health`: Service status and hardware acceleration flags.
- `GET /api/datasets/`: Catalog of available source-reference pairs from `manifest.jsonl`.
- `GET /api/config/matchers`: Matcher registry configurations and parameter definitions.
- `POST /api/pipeline/run`: Triggers pipeline execution for a selected pair.
- `GET /api/metrics/{pair_id}`: Retrieves final evaluation metrics and inlier checkpoints.

---


