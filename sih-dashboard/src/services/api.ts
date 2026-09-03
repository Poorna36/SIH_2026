/**
 * sih-dashboard/src/services/api.ts
 * ----------------------------------
 * Typed HTTP client for the SIH26166 Lunar Pipeline Backend API.
 * All methods include automatic fallback: if the backend is offline,
 * they return null and the calling hooks fall back to mock data.
 */

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');
const TIMEOUT_MS = 5000;

// ── Generic fetcher with timeout + error swallowing ──

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers || {}),
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`[API] ${path} responded with ${response.status}`);
      return null;
    }

    return (await response.json()) as T;
  } catch (err) {
    // Network error, timeout, or backend offline — silent fallback
    console.debug(`[API] Backend unavailable for ${path}:`, err instanceof Error ? err.message : err);
    return null;
  }
}


// ── Type Definitions (matching backend Pydantic models) ──

export interface HealthStatus {
  status: string;
  service: string;
  version: string;
}

export interface FootprintSource {
  product_id: string;
  sensor: string;
  gsd_m: number;
  utc?: string;
  footprint_ll?: number[][];
  footprint_shape?: number[];
  solar_incidence_deg?: number;
  solar_azimuth_deg?: number;
}

export interface FootprintReference {
  product_id: string;
  gsd_m: number;
  type: string;
  footprint_ll?: number[][];
}

export interface PairSummary {
  pair_id: string;
  src: FootprintSource;
  ref: FootprintReference;
  overlap_fraction: number;
  terrain_class?: string;
  latitude_center_deg?: number;
  longitude_center_deg?: number;
  crater_density_per_km2?: number;
  split: string;
  created_at: string;
}

export interface DatasetStats {
  total_pairs: number;
  train_pairs: number;
  test_pairs: number;
  skipped_pairs: number;
  sensors: string[];
  terrain_classes: string[];
}

export interface MatchMetrics {
  pair_id: string;
  matcher?: string;
  rmse_px?: number;
  ssim?: number;
  inlier_ratio?: number;
  inlier_count?: number;
  candidate_count?: number;
  spatial_coverage?: number;
  runtime_s?: number;
  terrain_class?: string;
  src_sensor?: string;
  src_gsd_m?: number;
  ref_type?: string;
  ref_gsd_m?: number;
  solar_incidence_deg?: number;
  solar_azimuth_deg?: number;
  latitude_center_deg?: number;
  longitude_center_deg?: number;
  has_ground_truth: boolean;
}

export interface PipelineRunRequest {
  pair_id: string;
  matcher?: string;
  options?: Record<string, unknown>;
}

export interface PipelineResult {
  run_id: string;
  pair_id: string;
  status: string;
  matcher: string;
  stages_completed: string[];
  metrics?: Record<string, unknown>;
  runtime_s: number;
  timestamp: string;
}

export interface MatcherConfig {
  enabled?: boolean;
  [key: string]: unknown;
}

export interface MatchersConfig {
  sift?: MatcherConfig;
  rift2?: MatcherConfig;
  lnift?: MatcherConfig;
  lightglue?: MatcherConfig;
  crater?: MatcherConfig;
  arbitration?: Record<string, unknown>;
  selection?: Record<string, unknown>;
}


// ── API Methods ──

/** Check if backend is online */
export async function checkHealth(): Promise<HealthStatus | null> {
  return apiFetch<HealthStatus>('/api/health');
}

/** List all image pairs from the manifest */
export async function listPairs(): Promise<PairSummary[] | null> {
  return apiFetch<PairSummary[]>('/api/datasets/');
}

/** Get dataset statistics */
export async function getDatasetStats(): Promise<DatasetStats | null> {
  return apiFetch<DatasetStats>('/api/datasets/stats');
}

/** Get details for a specific pair */
export async function getPairDetails(pairId: string): Promise<Record<string, unknown> | null> {
  return apiFetch<Record<string, unknown>>(`/api/datasets/${encodeURIComponent(pairId)}`);
}

/** Get metrics for all pairs */
export async function listMetrics(): Promise<MatchMetrics[] | null> {
  return apiFetch<MatchMetrics[]>('/api/metrics/');
}

/** Get metrics for a specific pair */
export interface BackendSLZDiagnostic {
  slope_deg: number;
  slope_threshold_deg: number;
  slope_pass_rate: number;
  boulder_clearance_m: number;
  boulder_threshold_m: number;
  boulder_pass_rate: number;
  overall_safety_score: number;
  go_no_go: 'GO' | 'NO-GO' | 'MARGINAL';
  terrain_roughness_cm?: number;
  crater_density_km2?: number;
}

export interface BackendSpectralData {
  pair_id: string;
  sensor: string;
  band: number;
  probe_coord: [number, number];
  data: Array<{ wavelength: number; reflectance: number }>;
  absorption_trough_wavelength: number;
  absorption_depth: number;
}

export interface BackendKeypointMatch {
  id: number;
  src_xy: [number, number];
  ref_xy: [number, number];
  confidence: number;
  is_inlier: boolean;
  is_shadow_outlier: boolean;
  refined_delta: [number, number];
  refine_sharpness: number;
}

export interface BackendCraterDetail {
  id: string;
  name: string;
  lat: number;
  lon: number;
  height: number;
  diameter_km: number;
  depth_km: number;
  region: string;
  floor_inclination_deg: number;
  wall_slope_deg: number;
  orbit_inclination_deg: number;
  solar_incidence_deg: number;
  solar_azimuth_deg: number;
  water_absorption_depth_pct: number;
  water_ice_concentration_wt_pct: number;
  water_ice_ppm: number;
  psr_status: string;
  subsurface_hydration_level: string;
  surface_temp_kelvin: number;
  frost_index: number;
  spectrometer_band: number;
  description: string;
}

export async function getPairMetrics(pairId: string): Promise<MatchMetrics | null> {
  return apiFetch<MatchMetrics>(`/api/metrics/${encodeURIComponent(pairId)}`);
}

/** Get ground-truth data for a pair */
export async function getGroundTruth(pairId: string): Promise<Record<string, unknown> | null> {
  return apiFetch<Record<string, unknown>>(`/api/metrics/ground-truth/${encodeURIComponent(pairId)}`);
}

/** Run the pipeline on a specific pair */
export async function runPipeline(request: PipelineRunRequest): Promise<PipelineResult | null> {
  return apiFetch<PipelineResult>('/api/pipeline/run', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

/** Check pipeline run status */
export async function getPipelineStatus(runId: string): Promise<PipelineResult | null> {
  return apiFetch<PipelineResult>(`/api/pipeline/status/${encodeURIComponent(runId)}`);
}

/** Get all completed pipeline runs */
export async function getPipelineHistory(): Promise<PipelineResult[] | null> {
  return apiFetch<PipelineResult[]>('/api/pipeline/history');
}

/** Get matcher configuration */
export async function getMatchersConfig(): Promise<MatchersConfig | null> {
  return apiFetch<MatchersConfig>('/api/config/matchers');
}

/** Update and persist matcher configuration */
export async function updateMatchersConfig(config: MatchersConfig): Promise<Record<string, unknown> | null> {
  return apiFetch<Record<string, unknown>>('/api/config/matchers', {
    method: 'POST',
    body: JSON.stringify(config),
  });
}

/** Get all configs merged */
export async function getAllConfigs(): Promise<Record<string, unknown> | null> {
  return apiFetch<Record<string, unknown>>('/api/config/all');
}

/** Get sensor-specific config */
export async function getSensorConfig(sensorName: string): Promise<Record<string, unknown> | null> {
  return apiFetch<Record<string, unknown>>(`/api/config/sensor/${encodeURIComponent(sensorName)}`);
}

/** Get Safe Landing Zone diagnostics for a scene */
export async function getSlzData(sceneId: string): Promise<BackendSLZDiagnostic | null> {
  return apiFetch<BackendSLZDiagnostic>(`/api/science/slz/${encodeURIComponent(sceneId)}`);
}

/** Get IIRS hyperspectral curve and 3.0µm water absorption */
export async function getSpectralData(sceneId: string): Promise<BackendSpectralData | null> {
  return apiFetch<BackendSpectralData>(`/api/science/spectral/${encodeURIComponent(sceneId)}`);
}

/** Get 2D correspondence keypoints */
export async function getKeypointMatches(pairId: string): Promise<BackendKeypointMatch[] | null> {
  return apiFetch<BackendKeypointMatch[]>(`/api/science/keypoints/${encodeURIComponent(pairId)}`);
}

/** Get full lunar crater catalog, optionally with search query */
export async function getCraterCatalog(query?: string): Promise<BackendCraterDetail[] | null> {
  const url = query && query.trim() ? `/api/science/craters/?q=${encodeURIComponent(query.trim())}` : '/api/science/craters/';
  return apiFetch<BackendCraterDetail[]>(url);
}
