// SIH26166 — Realistic Mock Data
// All values derived from real pipeline schemas (INTERFACES.md) and architecture (ARCHITECTURE.md)

import type {
  ScenePreset,
  TelemetryData,
  SpectralData,
  KeypointMatch,
  SLZDiagnostic,
  CraterDetail,
} from '../types';

// ──────────────────────────────────────────────────────────────
// Scene Presets (real selenographic coordinates)
// ──────────────────────────────────────────────────────────────
export const SCENE_PRESETS: ScenePreset[] = [
  {
    id: 'boguslawsky',
    name: 'Boguslawsky Crater (South Pole)',
    lat: -72.8,
    lon: 43.1,
    height: 80000,
    terrainClass: 'polar_highland',
    craterDensity: 4.7,
    solarIncidenceDeg: 68.2,
    solarAzimuthDeg: 178.5,
    gsdM: 0.31,
    overlayOpacity: 0.75,
    description: 'OHRC pair ohr_20200827T003010__nac_M123456789 · MAGSAC++ homography',
  },
  {
    id: 'manzinus',
    name: 'Manzinus C (Sub-polar)',
    lat: -67.5,
    lon: 26.8,
    height: 95000,
    terrainClass: 'polar_highland',
    craterDensity: 3.1,
    solarIncidenceDeg: 71.4,
    solarAzimuthDeg: 162.3,
    gsdM: 0.31,
    overlayOpacity: 0.7,
    description: 'OHRC pair ohr_20200901T012244__nac_M234567890 · RIFT2 + LightGlue',
  },
  {
    id: 'shackleton',
    name: 'Shackleton Crater (Lunar South Pole)',
    lat: -89.9,
    lon: 0.0,
    height: 65000,
    terrainClass: 'polar',
    craterDensity: 5.2,
    solarIncidenceDeg: 88.9,
    solarAzimuthDeg: 210.4,
    gsdM: 0.25,
    overlayOpacity: 0.85,
    description: 'Ultra-cold trap interior · Permanent shadow with water-ice sheets',
  },
  {
    id: 'cabeus',
    name: 'Cabeus Crater (LCROSS Impact Site)',
    lat: -84.9,
    lon: -35.5,
    height: 75000,
    terrainClass: 'polar',
    craterDensity: 4.9,
    solarIncidenceDeg: 84.6,
    solarAzimuthDeg: 195.2,
    gsdM: 0.28,
    overlayOpacity: 0.80,
    description: 'Confirmed volatile deposit site with 5.6 wt% hydroxyl & ice plume',
  },
  {
    id: 'clavius',
    name: 'Clavius Crater (Highland Hydration)',
    lat: -58.4,
    lon: -14.4,
    height: 110000,
    terrainClass: 'highland',
    craterDensity: 3.8,
    solarIncidenceDeg: 62.1,
    solarAzimuthDeg: 140.2,
    gsdM: 0.35,
    overlayOpacity: 0.70,
    description: 'SOFIA & IIRS confirmed glass-trapped water molecules (100–400 ppm)',
  },
  {
    id: 'tycho',
    name: 'Tycho Crater (Impact Central Peak)',
    lat: -43.3,
    lon: -11.2,
    height: 90000,
    terrainClass: 'highland',
    craterDensity: 2.2,
    solarIncidenceDeg: 54.0,
    solarAzimuthDeg: 115.0,
    gsdM: 0.31,
    overlayOpacity: 0.65,
    description: 'Prominent young impact crater with 2km central peak and ray system',
  },
  {
    id: 'equatorial_mare',
    name: 'Mare Tranquillitatis (Equatorial)',
    lat: 2.4,
    lon: 44.1,
    height: 120000,
    terrainClass: 'equatorial_mare',
    craterDensity: 0.8,
    solarIncidenceDeg: 18.6,
    solarAzimuthDeg: 92.1,
    gsdM: 0.31,
    overlayOpacity: 0.65,
    description: 'TMC-2 pair tmc_20200914T092101__wac_M456789012 · LightGlue (GPU)',
  },
];

// ──────────────────────────────────────────────────────────────
// Comprehensive Crater Telemetry & Hydration Database
// ──────────────────────────────────────────────────────────────
export const CRATER_DETAILS: CraterDetail[] = [
  {
    id: 'boguslawsky',
    name: 'Boguslawsky Crater',
    lat: -72.8,
    lon: 43.1,
    height: 80000,
    diameterKm: 97,
    depthKm: 3.4,
    region: 'South Polar Highlands',
    floorInclinationDeg: 4.8,
    wallSlopeDeg: 18.2,
    orbitInclinationDeg: 89.9,
    solarIncidenceDeg: 68.2,
    solarAzimuthDeg: 178.5,
    waterAbsorptionDepthPct: 14.2,
    waterIceConcentrationWtPct: 4.8,
    waterIcePpm: 48000,
    psrStatus: 'Partial Cold Trap',
    subsurfaceHydrationLevel: 'High',
    surfaceTempKelvin: 112,
    frostIndex: 78,
    spectrometerBand: 187,
    description: 'Primary Chandrayaan-4 SLZ target corridor. Features stable micro-cold traps on the southern floor with strong 3.0 µm OH/H₂O signature.',
  },
  {
    id: 'manzinus',
    name: 'Manzinus C',
    lat: -67.5,
    lon: 26.8,
    height: 95000,
    diameterKm: 25,
    depthKm: 2.8,
    region: 'Sub-polar South Rim',
    floorInclinationDeg: 7.1,
    wallSlopeDeg: 22.4,
    orbitInclinationDeg: 88.5,
    solarIncidenceDeg: 71.4,
    solarAzimuthDeg: 162.3,
    waterAbsorptionDepthPct: 9.6,
    waterIceConcentrationWtPct: 2.3,
    waterIcePpm: 23000,
    psrStatus: 'Micro Cold Traps',
    subsurfaceHydrationLevel: 'Moderate',
    surfaceTempKelvin: 128,
    frostIndex: 54,
    spectrometerBand: 187,
    description: 'Sub-polar impact structure. Significant shadow persistence along the northern rim wall providing localized regolith hydration.',
  },
  {
    id: 'shackleton',
    name: 'Shackleton Crater',
    lat: -89.9,
    lon: 0.0,
    height: 65000,
    diameterKm: 21,
    depthKm: 4.2,
    region: 'Lunar South Pole (Exact)',
    floorInclinationDeg: 2.1,
    wallSlopeDeg: 31.5,
    orbitInclinationDeg: 90.0,
    solarIncidenceDeg: 88.9,
    solarAzimuthDeg: 210.4,
    waterAbsorptionDepthPct: 28.5,
    waterIceConcentrationWtPct: 8.9,
    waterIcePpm: 89000,
    psrStatus: 'Permanently Shadowed (PSR)',
    subsurfaceHydrationLevel: 'Extreme',
    surfaceTempKelvin: 40,
    frostIndex: 96,
    spectrometerBand: 187,
    description: 'Peak of eternal light on rim with deep ultra-cold permanent shadow inside. Prime candidate for surface water-ice harvesting.',
  },
  {
    id: 'cabeus',
    name: 'Cabeus Crater',
    lat: -84.9,
    lon: -35.5,
    height: 75000,
    diameterKm: 100,
    depthKm: 4.0,
    region: 'South Polar PSR Basin',
    floorInclinationDeg: 3.5,
    wallSlopeDeg: 24.1,
    orbitInclinationDeg: 89.8,
    solarIncidenceDeg: 84.6,
    solarAzimuthDeg: 195.2,
    waterAbsorptionDepthPct: 22.4,
    waterIceConcentrationWtPct: 6.2,
    waterIcePpm: 62000,
    psrStatus: 'Permanently Shadowed (PSR)',
    subsurfaceHydrationLevel: 'Extreme',
    surfaceTempKelvin: 45,
    frostIndex: 91,
    spectrometerBand: 187,
    description: 'LCROSS impact proven volatile repository with pure water-ice crystals and volatile organics locked in cryogenic permafrost.',
  },
  {
    id: 'clavius',
    name: 'Clavius Crater',
    lat: -58.4,
    lon: -14.4,
    height: 110000,
    diameterKm: 225,
    depthKm: 4.6,
    region: 'Southern Highlands',
    floorInclinationDeg: 3.4,
    wallSlopeDeg: 16.8,
    orbitInclinationDeg: 85.2,
    solarIncidenceDeg: 62.1,
    solarAzimuthDeg: 140.2,
    waterAbsorptionDepthPct: 6.8,
    waterIceConcentrationWtPct: 1.4,
    waterIcePpm: 14000,
    psrStatus: 'Micro Cold Traps',
    subsurfaceHydrationLevel: 'Moderate',
    surfaceTempKelvin: 165,
    frostIndex: 38,
    spectrometerBand: 187,
    description: 'Sunlit lunar hydration baseline. Water molecules locked within glass bead impact melt across the basaltic regolith matrix.',
  },
  {
    id: 'tycho',
    name: 'Tycho Crater',
    lat: -43.3,
    lon: -11.2,
    height: 90000,
    diameterKm: 86,
    depthKm: 4.8,
    region: 'Central Highlands',
    floorInclinationDeg: 8.9,
    wallSlopeDeg: 26.5,
    orbitInclinationDeg: 78.0,
    solarIncidenceDeg: 54.0,
    solarAzimuthDeg: 115.0,
    waterAbsorptionDepthPct: 3.4,
    waterIceConcentrationWtPct: 0.8,
    waterIcePpm: 8000,
    psrStatus: 'Fully Illuminated',
    subsurfaceHydrationLevel: 'Low',
    surfaceTempKelvin: 210,
    frostIndex: 22,
    spectrometerBand: 187,
    description: 'Spectacular young Copernican crater with steep 2km central peak. High mineral freshness with trace hydroxyl signatures.',
  },
  {
    id: 'equatorial_mare',
    name: 'Mare Tranquillitatis',
    lat: 2.4,
    lon: 44.1,
    height: 120000,
    diameterKm: 873,
    depthKm: 0.2,
    region: 'Equatorial Basaltic Mare',
    floorInclinationDeg: 0.9,
    wallSlopeDeg: 3.2,
    orbitInclinationDeg: 0.0,
    solarIncidenceDeg: 18.6,
    solarAzimuthDeg: 92.1,
    waterAbsorptionDepthPct: 1.2,
    waterIceConcentrationWtPct: 0.05,
    waterIcePpm: 500,
    psrStatus: 'Fully Illuminated',
    subsurfaceHydrationLevel: 'Trace',
    surfaceTempKelvin: 385,
    frostIndex: 5,
    spectrometerBand: 187,
    description: 'High-titanium basalt plains. Solar wind proton implantation induces trace OH surface radicals without bulk cryogenic water ice.',
  },
];

export function findNearestCraterOrGenerate(lat: number, lon: number): CraterDetail {
  let closest = CRATER_DETAILS[0];
  let minDistance = Number.MAX_VALUE;

  for (const c of CRATER_DETAILS) {
    const dLat = c.lat - lat;
    const dLon = c.lon - lon;
    const dist = Math.sqrt(dLat * dLat + dLon * dLon);
    if (dist < minDistance) {
      minDistance = dist;
      closest = c;
    }
  }

  // If clicked close to a known crater (within 25 degrees), return it
  if (minDistance < 25) {
    return closest;
  }

  // Otherwise generate selenographic profile for arbitrary Moon location
  const isSouthPolar = lat < -60;
  const isNorthPolar = lat > 60;
  const isPolar = isSouthPolar || isNorthPolar;
  const absorption = isPolar ? parseFloat((8.0 + Math.abs(lat) * 0.2).toFixed(1)) : parseFloat((1.0 + Math.random() * 2.5).toFixed(1));
  const waterWt = parseFloat((absorption * 0.32).toFixed(2));

  return {
    id: `loc_${lat.toFixed(1)}_${lon.toFixed(1)}`,
    name: `Selenographic Site [${Math.abs(lat).toFixed(1)}°${lat < 0 ? 'S' : 'N'}, ${Math.abs(lon).toFixed(1)}°${lon < 0 ? 'W' : 'E'}]`,
    lat,
    lon,
    height: 90000,
    diameterKm: Math.round(15 + Math.random() * 45),
    depthKm: parseFloat((1.5 + Math.random() * 2.5).toFixed(1)),
    region: isPolar ? 'Polar Terrain' : 'Highland / Mare Plains',
    floorInclinationDeg: parseFloat((2.0 + Math.random() * 6).toFixed(1)),
    wallSlopeDeg: parseFloat((12.0 + Math.random() * 16).toFixed(1)),
    orbitInclinationDeg: parseFloat(Math.abs(lat).toFixed(1)),
    solarIncidenceDeg: parseFloat((90 - Math.abs(lat) * 0.8).toFixed(1)),
    solarAzimuthDeg: parseFloat((Math.random() * 360).toFixed(1)),
    waterAbsorptionDepthPct: absorption,
    waterIceConcentrationWtPct: waterWt,
    waterIcePpm: Math.round(waterWt * 10000),
    psrStatus: isPolar ? (Math.abs(lat) > 80 ? 'Permanently Shadowed (PSR)' : 'Partial Cold Trap') : 'Fully Illuminated',
    subsurfaceHydrationLevel: isPolar ? 'High' : 'Trace',
    surfaceTempKelvin: isPolar ? Math.round(60 + (90 - Math.abs(lat)) * 3) : Math.round(280 + Math.random() * 80),
    frostIndex: isPolar ? Math.round(40 + Math.abs(lat) * 0.6) : Math.round(5 + Math.random() * 15),
    spectrometerBand: 187,
    description: `Dynamic selenographic sampling at ${Math.abs(lat).toFixed(2)}°${lat < 0 ? 'S' : 'N'}, ${Math.abs(lon).toFixed(2)}°${lon < 0 ? 'W' : 'E'}. Evaluated via TMC-2 slope elevation model and IIRS 250-band hyperspectral cube.`,
  };
}


// ──────────────────────────────────────────────────────────────
// Telemetry per scene
// ──────────────────────────────────────────────────────────────
export const TELEMETRY_BY_SCENE: Record<string, TelemetryData> = {
  boguslawsky: {
    rmsePx: 0.34,
    ssim: 0.89,
    inlierRatio: 0.924,
    inlierCount: 157,
    candidateCount: 170,
    spatialCoverage: 0.78,
    gridDensityStd: 2.3,
    refinementGainPx: 0.23,
    solarIncidenceDeg: 68.2,
    solarEmissionDeg: 2.1,
    solarAzimuthDeg: 178.5,
    matcherWinner: 'lightglue',
    pairId: 'ohr_20200827T003010__nac_M123456789',
    utc: '2020-08-27T00:30:10.749Z',
    runtimeS: 4.8,
    ladderLevel: 2,
  },
  manzinus: {
    rmsePx: 0.51,
    ssim: 0.82,
    inlierRatio: 0.871,
    inlierCount: 128,
    candidateCount: 147,
    spatialCoverage: 0.69,
    gridDensityStd: 3.1,
    refinementGainPx: 0.18,
    solarIncidenceDeg: 71.4,
    solarEmissionDeg: 3.4,
    solarAzimuthDeg: 162.3,
    matcherWinner: 'rift2',
    pairId: 'ohr_20200901T012244__nac_M234567890',
    utc: '2020-09-01T01:22:44.012Z',
    runtimeS: 12.2,
    ladderLevel: 1,
  },
  shackleton: {
    rmsePx: 0.29,
    ssim: 0.91,
    inlierRatio: 0.945,
    inlierCount: 182,
    candidateCount: 192,
    spatialCoverage: 0.84,
    gridDensityStd: 1.8,
    refinementGainPx: 0.27,
    solarIncidenceDeg: 88.9,
    solarEmissionDeg: 1.2,
    solarAzimuthDeg: 210.4,
    matcherWinner: 'lightglue',
    pairId: 'ohr_20210115T120042__nac_M345678901',
    utc: '2021-01-15T12:00:42.115Z',
    runtimeS: 5.2,
    ladderLevel: 2,
  },
  cabeus: {
    rmsePx: 0.38,
    ssim: 0.87,
    inlierRatio: 0.898,
    inlierCount: 144,
    candidateCount: 160,
    spatialCoverage: 0.74,
    gridDensityStd: 2.6,
    refinementGainPx: 0.21,
    solarIncidenceDeg: 84.6,
    solarEmissionDeg: 2.8,
    solarAzimuthDeg: 195.2,
    matcherWinner: 'rift2',
    pairId: 'ohr_20210320T041855__nac_M456789012',
    utc: '2021-03-20T04:18:55.334Z',
    runtimeS: 8.7,
    ladderLevel: 2,
  },
  clavius: {
    rmsePx: 0.25,
    ssim: 0.93,
    inlierRatio: 0.952,
    inlierCount: 198,
    candidateCount: 208,
    spatialCoverage: 0.86,
    gridDensityStd: 1.6,
    refinementGainPx: 0.29,
    solarIncidenceDeg: 62.1,
    solarEmissionDeg: 1.5,
    solarAzimuthDeg: 140.2,
    matcherWinner: 'lightglue',
    pairId: 'tmc_20210512T083411__wac_M567890123',
    utc: '2021-05-12T08:34:11.902Z',
    runtimeS: 4.1,
    ladderLevel: 2,
  },
  tycho: {
    rmsePx: 0.32,
    ssim: 0.88,
    inlierRatio: 0.915,
    inlierCount: 165,
    candidateCount: 180,
    spatialCoverage: 0.81,
    gridDensityStd: 2.1,
    refinementGainPx: 0.24,
    solarIncidenceDeg: 54.0,
    solarEmissionDeg: 1.9,
    solarAzimuthDeg: 115.0,
    matcherWinner: 'sift',
    pairId: 'tmc_20210708T164522__wac_M678901234',
    utc: '2021-07-08T16:45:22.450Z',
    runtimeS: 3.8,
    ladderLevel: 2,
  },
  equatorial_mare: {
    rmsePx: 0.21,
    ssim: 0.94,
    inlierRatio: 0.962,
    inlierCount: 214,
    candidateCount: 222,
    spatialCoverage: 0.89,
    gridDensityStd: 1.4,
    refinementGainPx: 0.31,
    solarIncidenceDeg: 18.6,
    solarEmissionDeg: 0.9,
    solarAzimuthDeg: 92.1,
    matcherWinner: 'lightglue',
    pairId: 'tmc_20200914T092101__wac_M456789012',
    utc: '2020-09-14T09:21:01.333Z',
    runtimeS: 3.1,
    ladderLevel: 2,
  },
};

// ──────────────────────────────────────────────────────────────
// 250-band IIRS Spectral Curve (0.8 – 5.0 µm)
// Modelled with genuine 3.0 µm OH/H₂O absorption trough
// ──────────────────────────────────────────────────────────────
function generateSpectralCurve(): { wavelength: number; reflectance: number }[] {
  const points: { wavelength: number; reflectance: number }[] = [];
  const bandCount = 250;
  const wlMin = 0.8;
  const wlMax = 5.0;

  for (let i = 0; i < bandCount; i++) {
    const wl = wlMin + (i / (bandCount - 1)) * (wlMax - wlMin);

    // Base regolith reflectance (slightly increasing from VIS to NIR, then falling in MWIR)
    let r = 0.28 + 0.06 * Math.exp(-((wl - 1.2) ** 2) / 0.8);

    // Broad 1 µm pyroxene absorption
    r -= 0.06 * Math.exp(-((wl - 1.0) ** 2) / 0.06);

    // Broad 2 µm pyroxene absorption
    r -= 0.04 * Math.exp(-((wl - 2.0) ** 2) / 0.12);

    // Sharp 3.0 µm OH/H₂O absorption trough (water-ice signature)
    r -= 0.14 * Math.exp(-((wl - 3.0) ** 2) / 0.015);

    // Secondary 2.7 µm hydroxyl feature
    r -= 0.06 * Math.exp(-((wl - 2.73) ** 2) / 0.008);

    // Thermal emission rise beyond 3.5 µm
    if (wl > 3.5) r += 0.04 * (wl - 3.5) ** 1.5;

    // Instrument noise
    r += (Math.random() - 0.5) * 0.004;

    points.push({ wavelength: parseFloat(wl.toFixed(4)), reflectance: parseFloat(Math.max(0.02, Math.min(0.55, r)).toFixed(4)) });
  }
  return points;
}

export const SPECTRAL_DATA: SpectralData = {
  pairId: 'ohr_20200827T003010__nac_M123456789',
  sensor: 'IIRS',
  band: 187,
  probeCoord: [43.112, -72.831],
  data: generateSpectralCurve(),
  absorptionTroughWavelength: 3.0,
  absorptionDepth: 0.14,
};

// ──────────────────────────────────────────────────────────────
// Keypoint Matches (32 inliers + 8 shadow outliers)
// src_xy and ref_xy are (col, row) per INTERFACES.md §8 convention
// Images shown at 512×512 px in the viewer
// ──────────────────────────────────────────────────────────────
function rnd(min: number, max: number) {
  return parseFloat((min + Math.random() * (max - min)).toFixed(1));
}

function generateKeypoints(): KeypointMatch[] {
  const matches: KeypointMatch[] = [];

  // 32 inlier matches — spatially distributed (grid-based as per L3 ANMS)
  const gridCells = [
    [0, 0], [1, 0], [2, 0], [3, 0],
    [0, 1], [1, 1], [2, 1], [3, 1],
    [0, 2], [1, 2], [2, 2], [3, 2],
    [0, 3], [1, 3], [2, 3], [3, 3],
    [0, 4], [1, 4], [2, 4], [3, 4],
    [0, 5], [1, 5], [2, 5], [3, 5],
    [0, 6], [1, 6], [2, 6], [3, 6],
    [0, 7], [1, 7], [2, 7], [3, 7],
  ];

  gridCells.forEach(([cx, cy], i) => {
    const baseX = cx * 128 + 20;
    const baseY = cy * 64 + 10;
    const srcX = rnd(baseX, baseX + 80);
    const srcY = rnd(baseY, baseY + 44);
    // Simulate homography warp (slight shear + translation for OHRC→NAC)
    const refX = parseFloat((srcX * 1.003 + 12.4 + rnd(-3, 3)).toFixed(1));
    const refY = parseFloat((srcY * 0.998 - 8.1 + rnd(-3, 3)).toFixed(1));
    matches.push({
      id: i,
      srcXy: [Math.min(srcX, 500), Math.min(srcY, 500)],
      refXy: [Math.min(Math.max(refX, 10), 500), Math.min(Math.max(refY, 10), 500)],
      confidence: rnd(0.78, 0.99),
      isInlier: true,
      isShadowOutlier: false,
      refinedDelta: [rnd(-0.4, 0.4), rnd(-0.4, 0.4)],
      refineSharpness: rnd(0.72, 0.96),
    });
  });

  // 8 shadow outliers — concentrated in dark regions (top-left corner per OHRC shadow)
  for (let i = 0; i < 8; i++) {
    matches.push({
      id: 32 + i,
      srcXy: [rnd(10, 180), rnd(10, 200)],
      refXy: [rnd(200, 450), rnd(50, 400)], // wildly wrong — shadow region
      confidence: rnd(0.31, 0.55),
      isInlier: false,
      isShadowOutlier: true,
    });
  }

  return matches;
}

export const KEYPOINT_MATCHES: KeypointMatch[] = generateKeypoints();

// ──────────────────────────────────────────────────────────────
// SLZ Diagnostics per scene
// ──────────────────────────────────────────────────────────────
export const SLZ_BY_SCENE: Record<string, SLZDiagnostic> = {
  boguslawsky: {
    slopeDeg: 6.8,
    slopeThresholdDeg: 10,
    slopePassRate: 0.942,
    boulderClearanceM: 3.2,
    boulderThresholdM: 2.0,
    boulderPassRate: 0.97,
    overallSafetyScore: 94.2,
    goNoGo: 'GO',
  },
  manzinus: {
    slopeDeg: 11.3,
    slopeThresholdDeg: 10,
    slopePassRate: 0.58,
    boulderClearanceM: 1.4,
    boulderThresholdM: 2.0,
    boulderPassRate: 0.61,
    overallSafetyScore: 59.5,
    goNoGo: 'MARGINAL',
  },
  shackleton: {
    slopeDeg: 4.2,
    slopeThresholdDeg: 10,
    slopePassRate: 0.965,
    boulderClearanceM: 2.8,
    boulderThresholdM: 2.0,
    boulderPassRate: 0.95,
    overallSafetyScore: 92.0,
    goNoGo: 'GO',
  },
  cabeus: {
    slopeDeg: 7.9,
    slopeThresholdDeg: 10,
    slopePassRate: 0.882,
    boulderClearanceM: 2.1,
    boulderThresholdM: 2.0,
    boulderPassRate: 0.89,
    overallSafetyScore: 86.4,
    goNoGo: 'GO',
  },
  clavius: {
    slopeDeg: 3.8,
    slopeThresholdDeg: 10,
    slopePassRate: 0.978,
    boulderClearanceM: 4.1,
    boulderThresholdM: 2.0,
    boulderPassRate: 0.985,
    overallSafetyScore: 96.3,
    goNoGo: 'GO',
  },
  tycho: {
    slopeDeg: 14.5,
    slopeThresholdDeg: 10,
    slopePassRate: 0.42,
    boulderClearanceM: 1.1,
    boulderThresholdM: 2.0,
    boulderPassRate: 0.49,
    overallSafetyScore: 45.0,
    goNoGo: 'NO-GO',
  },
  equatorial_mare: {
    slopeDeg: 2.1,
    slopeThresholdDeg: 10,
    slopePassRate: 0.991,
    boulderClearanceM: 5.8,
    boulderThresholdM: 2.0,
    boulderPassRate: 0.999,
    overallSafetyScore: 98.7,
    goNoGo: 'GO',
  },
};

// ──────────────────────────────────────────────────────────────
// Pipeline stage labels
// ──────────────────────────────────────────────────────────────
export const PIPELINE_STAGE_LABELS: Record<string, string> = {
  idle: 'Ready',
  ingesting: 'Ingesting & calibrating (L0)',
  graph_matching: 'Graph matching — LightGlue M2 (L2)',
  magsac: 'MAGSAC++ geometric verification (L4)',
  warping: 'Warping → GeoTIFF (L6)',
  done: 'Co-registration complete',
};
