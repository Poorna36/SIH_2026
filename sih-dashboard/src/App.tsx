import { useState, useMemo, useEffect } from 'react';
import { LunarisLanding } from './components/landing/LunarisLanding';
import { MoonWorkbenchOverlay, type ProbedLocation } from './components/MoonWorkbenchOverlay';
import { LunarTargetPalette } from './components/LunarTargetPalette';
import { EngineInspector } from './components/EngineInspector';
import { KeypointViewer } from './components/KeypointViewer';
import { ResultsView } from './components/ResultsView';
import { WebGlMoonViewer } from './components/landing/WebGlMoonViewer';
import { useBackendData } from './hooks/useBackendData';
import { getSlzData, getSpectralData, getTelemetryData } from './services/api';
import {
  PipelineStage,
  type PipelineOptions,
  type MatcherParameters,
  type ScenePreset,
  type LayerVisibility,
  type TelemetryData,
  type SLZDiagnostic,
  type SpectralData,
} from './types';

const DEFAULT_SCENE: ScenePreset = {
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
  description: 'Primary Chandrayaan-4 SLZ target corridor',
};

const DEFAULT_TELEMETRY: TelemetryData = {
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
  pairId: 'boguslawsky',
  utc: '2020-08-27T00:30:10.884Z',
  runtimeS: 6.8,
  ladderLevel: 2,
};

const DEFAULT_SLZ: SLZDiagnostic = {
  slopeDeg: 6.8,
  slopeThresholdDeg: 10,
  slopePassRate: 0.942,
  boulderClearanceM: 3.2,
  boulderThresholdM: 2.0,
  boulderPassRate: 0.97,
  overallSafetyScore: 94.2,
  goNoGo: 'GO',
};

const DEFAULT_SPECTRAL: SpectralData = {
  pairId: 'boguslawsky',
  sensor: 'IIRS',
  band: 187,
  probeCoord: [43.1, -72.8],
  data: [
    { wavelength: 2.6, reflectance: 0.28 },
    { wavelength: 2.7, reflectance: 0.27 },
    { wavelength: 2.8, reflectance: 0.24 },
    { wavelength: 2.85, reflectance: 0.21 },
    { wavelength: 2.9, reflectance: 0.17 },
    { wavelength: 2.95, reflectance: 0.12 },
    { wavelength: 3.0, reflectance: 0.08 },
    { wavelength: 3.05, reflectance: 0.11 },
    { wavelength: 3.1, reflectance: 0.16 },
    { wavelength: 3.15, reflectance: 0.22 },
    { wavelength: 3.2, reflectance: 0.26 },
    { wavelength: 3.3, reflectance: 0.29 },
  ],
  absorptionTroughWavelength: 3.0,
  absorptionDepth: 0.142,
};

export function App() {
  // Route State: Landing Page vs 3D Mission Control Workbench
  const [appMode, setAppMode] = useState<'landing' | 'workbench'>(() => {
    if (typeof window !== 'undefined' && window.location.hash === '#workbench') {
      return 'workbench';
    }
    return 'landing';
  });

  useEffect(() => {
    const handleHashChange = () => {
      if (window.location.hash === '#workbench') {
        setAppMode('workbench');
      } else {
        setAppMode('landing');
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Backend Live API Data Integration
  const {
    isBackendOnline,
    craters,
    backendPairs,
    datasetStats,
    matcherConfig,
    lastPipelineResult,
    saveMatcherConfig,
    runPipelineOnPair,
  } = useBackendData();

  // Workbench State
  const [selectedScene, setSelectedScene] = useState<ScenePreset>(DEFAULT_SCENE);
  const [activeCenterTab, setActiveCenterTab] = useState<'3d' | '2d' | 'results'>('3d');
  const [pipelineStage, setPipelineStage] = useState<PipelineStage>(PipelineStage.Idle);
  const [isTargetPaletteOpen, setIsTargetPaletteOpen] = useState(false);
  const [isEngineInspectorOpen, setIsEngineInspectorOpen] = useState(false);
  const [cameraZoom, setCameraZoom] = useState<number>(3.8);

  const [isOrbitTourActive, setIsOrbitTourActive] = useState(false);
  const [probedTarget, setProbedTarget] = useState<ProbedLocation | null>(null);

  const handleProbeLocation = (lat: number, lon: number) => {
    const match = craters.find((c) => Math.hypot(c.lat - lat, c.lon - lon) < 6.0);
    if (match) {
      setProbedTarget({
        lat: match.lat,
        lon: match.lon,
        name: match.name,
        region: match.region,
        elevationM: match.depth_km ? Math.round(-match.depth_km * 1000) : -2400,
        solarIncidence: match.solar_incidence_deg ?? Math.round(Math.abs(lat) + 5),
        temperatureK: match.surface_temp_kelvin ?? (Math.abs(lat) > 75 ? 90 : 360),
        waterIceWtPct: match.water_ice_concentration_wt_pct ?? (Math.abs(lat) > 70 ? 3.8 : 0.4),
        psrStatus: match.psr_status ?? (Math.abs(lat) > 80 ? 'Permanently Shadowed (PSR)' : 'Sunlit Plains'),
        craterId: match.id,
      });
    } else {
      const isPolar = Math.abs(lat) > 70;
      setProbedTarget({
        lat,
        lon,
        name: `Selenographic Point (${lat > 0 ? '+' : ''}${lat}°, ${lon > 0 ? '+' : ''}${lon}°)`,
        region: isPolar ? 'South Polar Highland Corridor' : 'Equatorial Regolith Terrain',
        elevationM: Math.round(-1800 + Math.sin(lat * 0.1) * 2200),
        solarIncidence: Math.round(Math.min(88, Math.max(30, Math.abs(lat) + 4))),
        temperatureK: Math.round(isPolar ? 85 + Math.random() * 40 : 340 + Math.random() * 45),
        waterIceWtPct: isPolar ? 2.8 : 0.3,
        psrStatus: isPolar ? 'Cryogenic Micro-cold Trap' : 'Sunlit Basaltic Regolith',
        craterId: undefined,
      });
    }
  };

  const handleInspectProbedTargetIn2D = () => {
    if (!probedTarget) return;
    if (probedTarget.craterId) {
      setSelectedScene({
        id: probedTarget.craterId,
        name: probedTarget.name,
        lat: probedTarget.lat,
        lon: probedTarget.lon,
        height: 80000,
        description: `Probed location in ${probedTarget.region}`,
      });
    } else {
      setSelectedScene({
        id: 'copernicus',
        name: probedTarget.name,
        lat: probedTarget.lat,
        lon: probedTarget.lon,
        height: 75000,
        description: `Custom coordinates probed on 3D Moon: ${probedTarget.lat}°, ${probedTarget.lon}°`,
      });
    }
    setActiveCenterTab('2d');
    setProbedTarget(null);
  };

  const handleLaunchFromLanding = () => {
    setAppMode('workbench');
    window.location.hash = 'workbench';
  };

  const handleBackToLanding = () => {
    setAppMode('landing');
    window.location.hash = 'landing';
  };

  const handleZoomIn = () => {
    setCameraZoom((prev) => Math.max(2.2, prev - 0.4));
  };

  const handleZoomOut = () => {
    setCameraZoom((prev) => Math.min(6.5, prev + 0.4));
  };

  const handleResetView = () => {
    setCameraZoom(3.8);
    setSelectedScene(DEFAULT_SCENE);
    setProbedTarget(null);
  };

  // Live scientific data from backend
  const [liveSlz, setLiveSlz] = useState<SLZDiagnostic | null>(null);
  const [liveSpectral, setLiveSpectral] = useState<SpectralData | null>(null);
  const [liveTelemetry, setLiveTelemetry] = useState<TelemetryData | null>(null);

  useEffect(() => {
    if (!isBackendOnline) {
      setLiveSlz(null);
      setLiveSpectral(null);
      setLiveTelemetry(null);
      return;
    }

    let isMounted = true;
    getSlzData(selectedScene.id).then((data) => {
      if (isMounted && data) {
        setLiveSlz({
          slopeDeg: data.slope_deg,
          slopeThresholdDeg: data.slope_threshold_deg,
          slopePassRate: data.slope_pass_rate,
          boulderClearanceM: data.boulder_clearance_m,
          boulderThresholdM: data.boulder_threshold_m,
          boulderPassRate: data.boulder_pass_rate,
          overallSafetyScore: data.overall_safety_score,
          goNoGo: data.go_no_go as any,
          terrainRoughnessCm: data.terrain_roughness_cm,
          craterDensityKm2: data.crater_density_km2,
        });
      }
    });

    getSpectralData(selectedScene.id).then((data) => {
      if (isMounted && data) {
        setLiveSpectral({
          pairId: data.pair_id,
          sensor: data.sensor as any,
          band: data.band,
          probeCoord: data.probe_coord,
          data: data.data,
          absorptionTroughWavelength: data.absorption_trough_wavelength,
          absorptionDepth: data.absorption_depth,
        });
      }
    });

    getTelemetryData(selectedScene.id).then((data) => {
      if (isMounted && data) {
        setLiveTelemetry({
          rmsePx: data.rmse_px,
          ssim: data.ssim,
          inlierRatio: data.inlier_ratio,
          inlierCount: data.inlier_count,
          candidateCount: data.candidate_count,
          spatialCoverage: data.spatial_coverage,
          gridDensityStd: data.grid_density_std,
          refinementGainPx: data.refinement_gain_px,
          solarIncidenceDeg: data.solar_incidence_deg,
          solarEmissionDeg: data.solar_emission_deg,
          solarAzimuthDeg: data.solar_azimuth_deg,
          matcherWinner: data.matcher_winner as any,
          pairId: data.pair_id,
          utc: '2023-08-23T12:34:00.000Z',
          runtimeS: data.runtime_s,
          ladderLevel: data.ladder_level,
        });
      }
    });

    return () => {
      isMounted = false;
    };
  }, [selectedScene.id, isBackendOnline]);

  const activeTelemetry = useMemo(() => {
    const base = liveTelemetry || DEFAULT_TELEMETRY;
    if (lastPipelineResult && (lastPipelineResult.pair_id === selectedScene.id || selectedScene.id.includes(lastPipelineResult.pair_id)) && lastPipelineResult.metrics) {
      const m = lastPipelineResult.metrics as Record<string, any>;
      return {
        ...base,
        rmsePx: typeof m.rmse_px === 'number' ? m.rmse_px : base.rmsePx,
        ssim: typeof m.ssim === 'number' ? m.ssim : base.ssim,
        inlierRatio: typeof m.inlier_ratio === 'number' ? m.inlier_ratio : base.inlierRatio,
        inlierCount: typeof m.inlier_count === 'number' ? m.inlier_count : base.inlierCount,
        candidateCount: typeof m.candidate_count === 'number' ? m.candidate_count : base.candidateCount,
        spatialCoverage: typeof m.spatial_coverage === 'number' ? m.spatial_coverage : base.spatialCoverage,
        runtimeS: typeof lastPipelineResult.runtime_s === 'number' ? lastPipelineResult.runtime_s : base.runtimeS,
        matcherWinner: (lastPipelineResult.matcher as any) || base.matcherWinner,
      };
    }
    return base;
  }, [selectedScene.id, liveTelemetry, lastPipelineResult]);

  const currentSlz = liveSlz || DEFAULT_SLZ;
  const currentSpectral = liveSpectral || DEFAULT_SPECTRAL;

  const [options, setOptions] = useState<PipelineOptions>({
    activeMatcher: 'sift',
    adaptiveMsm: true,
    clahe: true,
    percentileClipping: true,
    morphologicalGradients: true,
    pcaBandReduction: true,
    ransacThreshold: 1.5,
    maxFeatures: 2000,
    confidenceThreshold: 0.8,
  });

  const [layers, setLayers] = useState<LayerVisibility>({
    basemap: true,
    dem: false,
    waterIce: true,
    craters: true,
    grid: true,
    ohrc: true,
    tmc2Slope: false,
    iirsHyperspectral: true,
    slzOverlay: true,
  });

  const [matcherParams, setMatcherParams] = useState<MatcherParameters>({
    sift: { n_features: 2000, ratio_thresh: 0.75 },
    rift2: { n_scale: 4, n_orient: 6 },
    lnift: { patch_size: 32 },
    lightglue: { max_num_keypoints: 2048 },
    crater: { model_path: 'models/crater_real_best.pt', min_diameter_px: 8 },
  });

  useEffect(() => {
    if (matcherConfig) {
      setMatcherParams(matcherConfig as unknown as MatcherParameters);
    }
  }, [matcherConfig]);

  // Pipeline execution handler calling backend runPipelineOnPair
  const handleRunPipeline = async () => {
    if (pipelineStage !== PipelineStage.Idle && pipelineStage !== PipelineStage.Done) return;
    setPipelineStage(PipelineStage.Ingesting);

    if (isBackendOnline) {
      setTimeout(() => setPipelineStage(PipelineStage.GraphMatching), 600);
      setTimeout(() => setPipelineStage(PipelineStage.MAGSAC), 1200);
      setTimeout(() => setPipelineStage(PipelineStage.Warping), 1800);

      try {
        await runPipelineOnPair({
          pair_id: selectedScene.id,
          matcher: options.activeMatcher,
          options: {
            percentile_clipping: options.percentileClipping,
            clahe: options.clahe,
            morphological_gradients: options.morphologicalGradients,
            pca_band_reduction: options.pcaBandReduction,
          },
        });
      } catch (err) {
        console.warn('Backend run failed:', err);
      } finally {
        setTimeout(() => setPipelineStage(PipelineStage.Done), 2400);
      }
    } else {
      setTimeout(() => setPipelineStage(PipelineStage.GraphMatching), 700);
      setTimeout(() => setPipelineStage(PipelineStage.MAGSAC), 1400);
      setTimeout(() => setPipelineStage(PipelineStage.Warping), 2100);
      setTimeout(() => setPipelineStage(PipelineStage.Done), 2800);
    }
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black text-white font-sans select-none">
      {/* Spatial WebGL 3D Lunar Engine (Always mounted in background for both Landing & Workbench) */}
      <div className="absolute inset-0 w-full h-full z-0">
        <WebGlMoonViewer
          isWorkbenchMode={appMode === 'workbench'}
          selectedCrater={selectedScene}
          cameraZoom={cameraZoom}
          craters={craters}
          isDrawerOpen={isTargetPaletteOpen || isEngineInspectorOpen}
          isOrbitTourActive={isOrbitTourActive}
          onProbeLocation={handleProbeLocation}
          onSelectCrater={(c) => setSelectedScene(c as any)}
          layers={layers}
        />
      </div>

      {/* ── 1. LANDING PAGE OVERVIEW ── */}
      {appMode === 'landing' ? (
        <div className="relative z-10 w-full h-full overflow-y-auto">
          <LunarisLanding
            onLaunchWorkbench={handleLaunchFromLanding}
          />
        </div>
      ) : (
        /* ── 2. 3D MISSION CONTROL WORKBENCH ── */
        <div className="relative z-10 w-full h-full overflow-hidden pointer-events-none">
          {/* Center 2D Registration & Findings View (Conditional overlay) */}
          {activeCenterTab === '2d' && (
            <div className="absolute inset-0 w-full h-full z-10 pt-20 pb-20 px-4 md:px-12 bg-black/85 backdrop-blur-2xl overflow-hidden pointer-events-auto">
              <KeypointViewer pairId={selectedScene.id} rmsePx={activeTelemetry.rmsePx} />
            </div>
          )}

          {activeCenterTab === 'results' && (
            <div className="absolute inset-0 w-full h-full z-10 pt-20 pb-20 px-4 md:px-12 bg-black/85 backdrop-blur-2xl overflow-y-auto sidebar-scroll pointer-events-auto">
              <ResultsView
                telemetry={activeTelemetry}
                slz={currentSlz}
                spectralData={currentSpectral}
                selectedScene={selectedScene}
              />
            </div>
          )}

          {/* Floating Aerospace Island HUD */}
          <MoonWorkbenchOverlay
            selectedScene={selectedScene}
            onSelectScene={(scene) => setSelectedScene(scene)}
            layers={layers}
            onLayerChange={(l) => setLayers(l)}
            options={options}
            onOptionsChange={(opts) => setOptions(opts)}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onResetView={handleResetView}
            activeTab={activeCenterTab}
            onTabChange={(t) => setActiveCenterTab(t)}
            onBackToLanding={handleBackToLanding}
            onOpenTargetPalette={() => setIsTargetPaletteOpen(true)}
            onOpenEngineInspector={() => setIsEngineInspectorOpen(true)}
            pipelineStage={pipelineStage}
            onRunPipeline={handleRunPipeline}
            telemetryRmse={activeTelemetry.rmsePx}
            isOrbitTourActive={isOrbitTourActive}
            onToggleOrbitTour={() => setIsOrbitTourActive((prev) => !prev)}
            probedTarget={probedTarget}
            onCloseProbeTarget={() => setProbedTarget(null)}
            onInspectProbedTargetIn2D={handleInspectProbedTargetIn2D}
          />

          {/* Modern Aerospace Modal 1: Lunar Target Command Palette */}
          {isTargetPaletteOpen && (
            <div className="pointer-events-auto">
              <LunarTargetPalette
                selectedScene={selectedScene}
                onSelectScene={(scene) => {
                  setSelectedScene(scene);
                  setIsTargetPaletteOpen(false);
                }}
                onClose={() => setIsTargetPaletteOpen(false)}
                craters={craters}
              />
            </div>
          )}

          {/* Modern Aerospace Modal 2: Registration Engine & Data Inspector */}
          <div className="pointer-events-auto">
            <EngineInspector
              isOpen={isEngineInspectorOpen}
              onClose={() => setIsEngineInspectorOpen(false)}
              options={options}
              onOptionsChange={setOptions}
              matcherParams={matcherParams}
              onUpdateMatcherParams={setMatcherParams}
              onSaveMatcherConfig={saveMatcherConfig}
              pairs={backendPairs}
              stats={datasetStats}
              selectedPairId={selectedScene.id}
              onSelectPair={(pairId) => {
                // Switch scene matching pair
                const foundCrater = craters.find((c) => c.id === pairId);
                if (foundCrater) {
                  setSelectedScene({
                    id: foundCrater.id,
                    name: foundCrater.name,
                    lat: foundCrater.lat,
                    lon: foundCrater.lon,
                    height: foundCrater.height,
                    description: foundCrater.description,
                  });
                }
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
