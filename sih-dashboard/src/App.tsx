import { useState, useRef, useEffect, useMemo } from 'react';
import { Header } from './components/Header';
import { SidebarControls } from './components/SidebarControls';
import { CesiumViewer } from './components/CesiumViewer';
import { KeypointViewer } from './components/KeypointViewer';
import { ResultsView } from './components/ResultsView';
import { LunarisLanding } from './components/landing/LunarisLanding';
import { useMagneticButtons } from './hooks/useMagneticButtons';
import { useBackendData } from './hooks/useBackendData';
import { getSlzData, getSpectralData } from './services/api';
import {
  PipelineStage,
  type ScenePreset,
  type ProcessingOptions,
  type LayerVisibility,
  type SLZDiagnostic,
  type SpectralData,
} from './types';
import {
  SCENE_PRESETS,
  TELEMETRY_BY_SCENE,
  SLZ_BY_SCENE,
  SPECTRAL_DATA,
} from './data/mockData';
import {
  Globe, GitCommit,
  Settings2, FlaskConical, Maximize2, Minimize2
} from 'lucide-react';

export function App() {
  // Global 3D Magnetic Physics for all buttons & interactive controls
  useMagneticButtons();

  // Route State: Landing Page (LUNARIS) vs 3D Mission Control Workbench
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
      } else if (window.location.hash === '#landing' || !window.location.hash) {
        setAppMode('landing');
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // When switching to workbench, trigger window resize so Cesium recalibrates canvas buffer immediately
  useEffect(() => {
    if (appMode === 'workbench') {
      const t = setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 50);
      return () => clearTimeout(t);
    }
  }, [appMode]);

  // Backend Live API Data Integration (with offline fallback)
  const {
    isBackendOnline,
    backendLatencyMs,
    backendPairs,
    datasetStats,
    matcherConfig,
    pipelineHistory,
    lastPipelineResult,
    fetchSensorConfig,
    runPipelineOnPair,
    refreshData,
  } = useBackendData();

  // State
  const [selectedScene, setSelectedScene] = useState<ScenePreset>(SCENE_PRESETS[0]);

  const [activeCenterTab, setActiveCenterTab] = useState<'3d' | '2d' | 'results'>('3d');
  const [pipelineStage, setPipelineStage] = useState<PipelineStage>(PipelineStage.Idle);

  // Live backend scientific data (falls back to mockData when offline)
  const [liveSlz, setLiveSlz] = useState<SLZDiagnostic | null>(null);
  const [liveSpectral, setLiveSpectral] = useState<SpectralData | null>(null);

  useEffect(() => {
    if (!isBackendOnline) {
      setLiveSlz(null);
      setLiveSpectral(null);
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
          goNoGo: data.go_no_go,
        });
      }
    });

    getSpectralData(selectedScene.id).then((data) => {
      if (isMounted && data) {
        setLiveSpectral({
          pairId: data.pair_id,
          sensor: (data.sensor as any) || 'IIRS',
          band: data.band,
          probeCoord: [data.probe_coord[0], data.probe_coord[1]],
          data: data.data,
          absorptionTroughWavelength: data.absorption_trough_wavelength,
          absorptionDepth: data.absorption_depth,
        });
      }
    });

    return () => {
      isMounted = false;
    };
  }, [selectedScene.id, isBackendOnline]);

  // Collapsible Sidebar State (Default collapsed at start)
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(true);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnterControls = () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      setIsLeftCollapsed(false);
    }, 220); // calm hover intent delay
  };

  const handleMouseLeaveControls = () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      setIsLeftCollapsed(true);
    }, 320); // calm retreat delay
  };
  
  // Full-Screen / Maximized Canvas Mode
  const [isMaximized, setIsMaximized] = useState(false);

  const [options, setOptions] = useState<ProcessingOptions>({
    percentileClipping: true,
    clahe: true,
    morphologicalGradients: false,
    pcaBandReduction: false,
    selectedMatcher: 'lightglue',
  });

  const [layers, setLayers] = useState<LayerVisibility>({
    ohrc: true,
    tmc2Slope: false,
    iirsHyperspectral: true,
    slzOverlay: true,
  });

  // Scene-dependent data merged with live backend pipeline metrics
  const activeTelemetry = useMemo(() => {
    const base = TELEMETRY_BY_SCENE[selectedScene.id] || TELEMETRY_BY_SCENE.boguslawsky;
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
  }, [selectedScene.id, lastPipelineResult]);

  const currentSlz = liveSlz || SLZ_BY_SCENE[selectedScene.id] || SLZ_BY_SCENE.boguslawsky;
  const currentSpectral = liveSpectral || SPECTRAL_DATA;

  // Pipeline execution (Triggers backend registration API when online)
  const handleRunPipeline = async () => {
    if (pipelineStage !== PipelineStage.Idle && pipelineStage !== PipelineStage.Done) return;

    setPipelineStage(PipelineStage.Ingesting);

    if (isBackendOnline) {
      // Fire live backend pipeline run
      runPipelineOnPair({
        pair_id: selectedScene.id,
        matcher: options.selectedMatcher,
      }).catch((err) => console.debug('Backend pipeline error:', err));
    }

    setTimeout(() => {
      setPipelineStage(PipelineStage.GraphMatching);
      setTimeout(() => {
        setPipelineStage(PipelineStage.MAGSAC);
        setTimeout(() => {
          setPipelineStage(PipelineStage.Warping);
          setTimeout(() => {
            setPipelineStage(PipelineStage.Done);
          }, 1000);
        }, 1100);
      }, 1200);
    }, 900);
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#07080A]">
      {/* ── 3D Mission Control Workbench (Always mounted so Cesium pre-renders & caches in background) ── */}
      <div
        className={`absolute inset-0 w-full h-full flex flex-col bg-[#07080A] text-slate-100 overflow-hidden font-sans transition-opacity duration-500 ${
          appMode === 'workbench'
            ? 'opacity-100 pointer-events-auto z-10'
            : 'opacity-0 pointer-events-none z-0'
        }`}
      >
        {/* ── Top Fixed Glassy Header ── */}
        <Header
          activeStage={pipelineStage}
          selectedScene={selectedScene.name}
          isBackendOnline={isBackendOnline}
          backendLatencyMs={backendLatencyMs}
          onRefreshBackend={refreshData}
          onBackToLanding={() => {
            setAppMode('landing');
            window.location.hash = '';
          }}
        />

      {/* ── Main Flex Scientific Workbench Layout ── */}
      <main className="relative flex-1 flex gap-2 p-2 pt-10 h-full overflow-hidden bg-[#07080A]">
        {/* ── Left Column: Collapsed Solid Docked Strip OR Expanded Transparent Overlay over Model ── */}
        {/* ── Left Column: Docked Collapsed Strip + Slowly Gliding Transparent Drawer ── */}
        {!isMaximized && (
          <>
            {/* Collapsed State: Expands slowly on hover */}
            <div
              onMouseEnter={handleMouseEnterControls}
              className="h-full w-14 min-w-[56px] flex flex-col items-center justify-between py-4 px-1 bg-[#0D0E12]/95 backdrop-blur-2xl rounded-2xl border border-[#D4C59A]/25 shadow-2xl z-20 shrink-0 select-none cursor-pointer group hover:border-[#D4C59A]/50 transition-all duration-500"
              title="Hover to expand panel"
            >
              {/* Top Mission Indicator */}
              <div className="flex flex-col items-center gap-1.5 w-full pt-1">
                <span className="w-2 h-2 rounded-full bg-[#D4C59A] shadow-[0_0_8px_rgba(212,197,154,0.6)] group-hover:scale-125 transition-transform duration-500" />
              </div>

              {/* List of sections */}
              <div className="flex flex-col items-center gap-4 py-2 w-full">
                {[
                  { icon: <Settings2 size={13} />, name: 'INGESTION', label: '1. Ingest' },
                  { icon: <Globe size={13} />, name: 'PRESETS', label: '2. Presets' },
                  { icon: <GitCommit size={13} />, name: 'L1 FILTERS', label: '3. L1 Filters' },
                  { icon: <FlaskConical size={13} />, name: 'MATCHERS', label: '4. Matchers' },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    title={`Open: ${item.name}`}
                    className="flex flex-col items-center gap-1 p-1 rounded-lg text-[#D4C59A]/80 group-hover:text-white transition-colors duration-300 w-full text-center"
                  >
                    <div className="text-[#D4C59A] group-hover:scale-110 transition-transform duration-300">{item.icon}</div>
                    <span className="text-[7.5px] font-mono font-bold leading-tight text-slate-300">
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Expanded State: Slowly glides and fades in over the 3D model */}
            <div
              onMouseEnter={() => {
                if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
              }}
              onMouseLeave={handleMouseLeaveControls}
              className={`absolute left-3 top-12 bottom-3 w-84 max-w-[92vw] z-30 flex flex-col bg-black/45 backdrop-blur-xl rounded-2xl border border-[#D4C59A]/35 p-2 shadow-2xl overflow-y-auto sidebar-scroll transition-all duration-700 ease-out transform ${
                isLeftCollapsed
                  ? 'opacity-0 -translate-x-8 pointer-events-none scale-[0.98]'
                  : 'opacity-100 translate-x-0 pointer-events-auto scale-100'
              }`}
            >
              <SidebarControls
                selectedScene={selectedScene}
                onSceneChange={(scene) => setSelectedScene(scene)}
                options={options}
                onOptionsChange={(opts) => setOptions(opts)}
                pipelineStage={pipelineStage}
                onRunPipeline={handleRunPipeline}
                onViewResults={() => setActiveCenterTab('results')}
                onToggleCollapse={() => setIsLeftCollapsed(true)}
                backendPairs={backendPairs}
                datasetStats={datasetStats}
                matcherConfig={matcherConfig}
                pipelineHistory={pipelineHistory}
                fetchSensorConfig={fetchSensorConfig}
                isBackendOnline={isBackendOnline}
              />
            </div>
          </>
        )}

        {/* ── Main Viewport Column (Expands to Full Width) ── */}
        <div className="flex-1 h-full min-w-0 flex flex-col gap-1.5 overflow-hidden">
          {/* Top Viewport Navigation Strip & Mode Switcher */}
          <div className="flex items-center justify-between px-3 py-1.5 bg-[#0D0E12]/80 backdrop-blur-2xl rounded-xl border border-[#D4C59A]/20 shadow-lg">
            {/* Left: 3D / 2D / Results View Switcher */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setActiveCenterTab('3d')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-mono font-extrabold transition-all duration-200 ${
                  activeCenterTab === '3d'
                    ? 'bg-[#D4C59A] text-black shadow-[0_0_12px_rgba(212,197,154,0.4)]'
                    : 'text-[#D4C59A]/70 hover:text-white hover:bg-[#181B24]'
                }`}
              >
                <Globe size={13} />
                <span>3D Model</span>
              </button>

              <button
                onClick={() => setActiveCenterTab('2d')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-mono font-extrabold transition-all duration-200 ${
                  activeCenterTab === '2d'
                    ? 'bg-[#D4C59A] text-black shadow-[0_0_12px_rgba(212,197,154,0.4)]'
                    : 'text-[#D4C59A]/70 hover:text-white hover:bg-[#181B24]'
                }`}
              >
                <GitCommit size={13} />
                <span>2D Registration & Keypoints</span>
              </button>

              <button
                onClick={() => setActiveCenterTab('results')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-mono font-extrabold transition-all duration-200 ${
                  activeCenterTab === 'results'
                    ? 'bg-[#D4C59A] text-black shadow-[0_0_12px_rgba(212,197,154,0.4)]'
                    : 'text-[#D4C59A]/70 hover:text-white hover:bg-[#181B24]'
                }`}
              >
                <FlaskConical size={13} />
                <span>Science Results & Findings</span>
              </button>
            </div>

            {/* Right: Fullscreen Mode */}
            <div className="flex items-center gap-2">

              <button
                onClick={() => setIsMaximized(!isMaximized)}
                title={isMaximized ? 'Restore Split View' : 'Maximize Moon Window'}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-mono font-extrabold border transition-all ${
                  isMaximized
                    ? 'bg-[#D4C59A] text-black border-[#FAF6EB] shadow-[0_0_10px_rgba(212,197,154,0.4)]'
                    : 'bg-[#12141B] hover:bg-[#1A1D26] text-[#EBE2CD] hover:text-white border-[#D4C59A]/25'
                }`}
              >
                {isMaximized ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                <span>{isMaximized ? 'Restore View' : 'Maximize Window'}</span>
              </button>
            </div>
          </div>

          {/* Viewport Content (Expands to Full Dimensions) */}
          <div className="flex-1 w-full h-[calc(100%-38px)] overflow-hidden rounded-xl bg-black border border-[#D4C59A]/20 relative">
            {/* 3D Cesium Moon is always kept mounted in DOM so WebGL context is never destroyed and recreated */}
            <div className={`absolute inset-0 w-full h-full transition-opacity duration-300 ease-out ${
              activeCenterTab === '2d' ? 'opacity-0 pointer-events-none' : 'opacity-100'
            }`}>
              <CesiumViewer
                selectedScene={selectedScene}
                layers={layers}
                onLayerChange={(l) => setLayers(l)}
                onSelectScene={(scene) => setSelectedScene(scene)}
                hideControls={activeCenterTab === 'results'}
              />
            </div>

            {/* 2D Keypoint Viewer */}
            {activeCenterTab === '2d' && (
              <div className="absolute inset-0 w-full h-full z-10 pointer-events-auto animate-in fade-in duration-200">
                <KeypointViewer />
              </div>
            )}

            {/* Science Results & Findings (Transparent Glass Overlay Over Cesium Moon) */}
            {activeCenterTab === 'results' && (
              <div className="absolute inset-0 w-full h-full z-20 pointer-events-auto animate-results-enter">
                <ResultsView
                  telemetry={activeTelemetry}
                  slz={currentSlz}
                  spectralData={currentSpectral}
                  selectedScene={selectedScene}
                  onNavigateToTab={(tab) => setActiveCenterTab(tab)}
                />
              </div>
            )}
          </div>
        </div>
      </main>
      </div>

      {/* ── LUNARIS Editorial Landing Page (Rendered on top when appMode === 'landing') ── */}
      {appMode === 'landing' && (
        <div className="absolute inset-0 w-full h-full z-20 overflow-y-auto pointer-events-auto animate-in fade-in duration-300">
          <LunarisLanding
            onLaunchWorkbench={() => {
              setAppMode('workbench');
              window.location.hash = 'workbench';
            }}
          />
        </div>
      )}
    </div>
  );
}

export default App;
