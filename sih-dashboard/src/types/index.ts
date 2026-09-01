// SIH26166 — TypeScript Interfaces
// All types derived from INTERFACES.md and ARCHITECTURE.md schemas

export type SensorType = 'OHRC' | 'TMC-2' | 'IIRS' | 'PDS4';
export type MatcherType = 'sift' | 'rift2' | 'lightglue' | 'crater';
export type TerrainClass = 'polar_highland' | 'polar' | 'highland' | 'mare' | 'equatorial_mare';

export const PipelineStage = {
  Idle: 'idle',
  Ingesting: 'ingesting',
  GraphMatching: 'graph_matching',
  MAGSAC: 'magsac',
  Warping: 'warping',
  Done: 'done',
} as const;

export type PipelineStage = (typeof PipelineStage)[keyof typeof PipelineStage];

export interface ScenePreset {
  id: string;
  name: string;
  lat: number;
  lon: number;
  height: number; // camera altitude in meters
  terrainClass: TerrainClass;
  craterDensity: number;
  solarIncidenceDeg: number;
  solarAzimuthDeg: number;
  gsdM: number;
  overlayOpacity: number;
  description: string;
}

export interface TelemetryData {
  rmsePx: number;
  ssim: number;
  inlierRatio: number;
  inlierCount: number;
  candidateCount: number;
  spatialCoverage: number;
  gridDensityStd: number;
  refinementGainPx: number;
  solarIncidenceDeg: number;
  solarEmissionDeg: number;
  solarAzimuthDeg: number;
  matcherWinner: MatcherType;
  pairId: string;
  utc: string;
  runtimeS: number;
  ladderLevel: number; // 0=similarity, 1=affine, 2=homography
}

export interface SpectralDataPoint {
  wavelength: number; // µm
  reflectance: number; // 0-1
}

export interface SpectralData {
  pairId: string;
  sensor: SensorType;
  band: number;
  probeCoord: [number, number]; // [lon, lat]
  data: SpectralDataPoint[];
  absorptionTroughWavelength: number; // µm (3.0 for water-ice)
  absorptionDepth: number; // relative depth 0-1
}

export interface KeypointMatch {
  id: number;
  srcXy: [number, number]; // [col, row]
  refXy: [number, number];
  confidence: number;
  isInlier: boolean;
  isShadowOutlier: boolean;
  refinedDelta?: [number, number];
  refineSharpness?: number;
}

export interface ProcessingOptions {
  percentileClipping: boolean;
  clahe: boolean;
  morphologicalGradients: boolean;
  pcaBandReduction: boolean;
  selectedMatcher: MatcherType;
}

export interface SLZDiagnostic {
  slopeDeg: number;
  slopeThresholdDeg: number;
  slopePassRate: number;
  boulderClearanceM: number;
  boulderThresholdM: number;
  boulderPassRate: number;
  overallSafetyScore: number; // 0-100
  goNoGo: 'GO' | 'NO-GO' | 'MARGINAL';
}

export interface LayerVisibility {
  ohrc: boolean;
  tmc2Slope: boolean;
  iirsHyperspectral: boolean;
  slzOverlay: boolean;
}

export interface UploadedFile {
  name: string;
  size: number;
  sensor: SensorType;
  status: 'pending' | 'processing' | 'done' | 'ready' | 'error';
}

export interface CraterDetail {
  id: string;
  name: string;
  lat: number;
  lon: number;
  height: number;
  diameterKm: number;
  depthKm: number;
  region: string;
  // Inclination & Slopes
  floorInclinationDeg: number;
  wallSlopeDeg: number;
  orbitInclinationDeg: number;
  solarIncidenceDeg: number;
  solarAzimuthDeg: number;
  // Water & Ice Telemetry
  waterAbsorptionDepthPct: number; // e.g. 14.2%
  waterIceConcentrationWtPct: number; // e.g. 4.8 wt%
  waterIcePpm: number; // e.g. 48000 ppm
  psrStatus: 'Permanently Shadowed (PSR)' | 'Partial Cold Trap' | 'Fully Illuminated' | 'Micro Cold Traps';
  subsurfaceHydrationLevel: 'Extreme' | 'High' | 'Moderate' | 'Low' | 'Trace';
  surfaceTempKelvin: number;
  frostIndex: number; // 0 - 100
  spectrometerBand: number;
  description: string;
}

