import { useState } from 'react';
import { Header } from './components/Header';
import { SidebarControls } from './components/SidebarControls';
import { CesiumViewer } from './components/CesiumViewer';
import { KeypointViewer } from './components/KeypointViewer';
import { SciencePanel } from './components/SciencePanel';
import {
  PipelineStage,
  type ScenePreset,
  type ProcessingOptions,
  type LayerVisibility,
} from './types';
import {
  SCENE_PRESETS,
  TELEMETRY_BY_SCENE,
  SLZ_BY_SCENE,
  SPECTRAL_DATA,
} from './data/mockData';
import {
  Globe, GitCommit, PanelLeftOpen, PanelRightOpen,
  Settings2, FlaskConical, Maximize2, Minimize2
} from 'lucide-react';

export function App() {
  // State
  const [selectedScene, setSelectedScene] = useState<ScenePreset>(SCENE_PRESETS[0]);
  const [activeCenterTab, setActiveCenterTab] = useState<'3d' | '2d'>('3d');
  const [pipelineStage, setPipelineStage] = useState<PipelineStage>(PipelineStage.Idle);

  // Collapsible Sidebars State (Default collapsed at start)
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(true);
  const [isRightCollapsed, setIsRightCollapsed] = useState(true);
  
  // Full-Screen / Maximized 3D Moon Canvas Mode
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

  // Scene-dependent data
  const telemetry = TELEMETRY_BY_SCENE[selectedScene.id] || TELEMETRY_BY_SCENE.boguslawsky;
  const slz = SLZ_BY_SCENE[selectedScene.id] || SLZ_BY_SCENE.boguslawsky;

  // Pipeline execution animation
  const handleRunPipeline = () => {
    if (pipelineStage !== PipelineStage.Idle && pipelineStage !== PipelineStage.Done) return;

    setPipelineStage(PipelineStage.Ingesting);
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
    <div className="flex flex-col h-screen w-screen bg-[#020408] text-slate-100 overflow-hidden font-sans">
      {/* ── Top Fixed Glassy Header (h-11 = 44px) ── */}
      <Header activeStage={pipelineStage} selectedScene={selectedScene.name} />

      {/* ── Main Flex Scientific Workbench Layout with Collapsible Sidebars ── */}
      <main className="flex-1 flex gap-1.5 p-1.5 pt-12 h-full overflow-hidden bg-[#020408]/90">
        {/* ── Left Column: Data Ingestion & Controls (Collapsible / Hide in Maximized Mode) ── */}
        {!isMaximized && (
          <div
            className={`h-full transition-all duration-300 ease-in-out flex flex-col bg-transparent ${
              isLeftCollapsed ? 'w-14 min-w-[56px]' : 'w-80 min-w-[300px] max-w-[340px]'
            }`}
          >
            {isLeftCollapsed ? (
              <div
                onClick={() => setIsLeftCollapsed(false)}
                className="h-full flex flex-col items-center justify-between py-2 px-1 bg-[#050B14]/40 hover:bg-[#050B14]/65 backdrop-blur-2xl rounded-xl border border-emerald-500/25 shadow-xl cursor-pointer hover:border-emerald-400/50 transition-all group"
              >
                {/* Expand Action Button */}
                <div className="flex flex-col items-center gap-1 w-full">
                  <button
                    onClick={(e) => { e.stopPropagation(); setIsLeftCollapsed(false); }}
                    title="Expand Ingestion & Controls Sidebar"
                    className="p-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 text-black border border-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.5)] group-hover:scale-110 transition-transform"
                  >
                    <PanelLeftOpen size={15} />
                  </button>
                  <span className="text-[7.5px] font-mono font-extrabold text-emerald-300 tracking-wider">EXPAND</span>
                </div>

                {/* List of sections it contains */}
                <div className="flex flex-col items-center gap-2.5 py-1.5 w-full">
                  {[
                    { icon: <Settings2 size={12} />, name: 'INGESTION', label: '1. Ingest' },
                    { icon: <Globe size={12} />, name: 'PRESETS', label: '2. Presets' },
                    { icon: <GitCommit size={12} />, name: 'L1 FILTERS', label: '3. L1 Filters' },
                    { icon: <FlaskConical size={12} />, name: 'MATCHERS', label: '4. Matchers' },
                  ].map((item, idx) => (
                    <div
                      key={idx}
                      title={`Click to open: ${item.name}`}
                      className="flex flex-col items-center gap-0.5 p-1 rounded-lg hover:bg-[#0A1628]/60 text-emerald-300/80 hover:text-white transition-colors w-full text-center"
                    >
                      <div className="text-emerald-400">{item.icon}</div>
                      <span className="text-[7px] font-mono font-bold leading-tight text-slate-300">
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Vertical Title */}
                <div className="flex flex-col items-center gap-1 py-1">
                  <span
                    className="text-[8.5px] font-mono font-extrabold text-slate-300 tracking-widest uppercase select-none"
                    style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                  >
                    MISSION CONTROLS
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse mt-1" />
                </div>
              </div>
            ) : (
              <div className="h-full overflow-hidden bg-transparent">
                <SidebarControls
                  selectedScene={selectedScene}
                  onSceneChange={(scene) => setSelectedScene(scene)}
                  options={options}
                  onOptionsChange={(opts) => setOptions(opts)}
                  pipelineStage={pipelineStage}
                  onRunPipeline={handleRunPipeline}
                  onToggleCollapse={() => setIsLeftCollapsed(true)}
                />
              </div>
            )}
          </div>
        )}

        {/* ── Center Column: 3D Globe / 2D Multi-Modal Viewport (Dominates 60% Space) ── */}
        <div className="flex-1 h-full min-w-0 flex flex-col gap-1 overflow-hidden">
          {/* Top Viewport Navigation Strip & Quick Scene Targets Bar */}
          <div className="flex items-center justify-between px-2 py-1 bg-[#050B14]/45 backdrop-blur-2xl rounded-xl border border-emerald-500/25 shadow-lg">
            {/* Left: 3D / 2D View Switcher */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveCenterTab('3d')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-mono font-extrabold transition-all duration-200 ${
                  activeCenterTab === '3d'
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-black shadow-[0_0_12px_rgba(16,185,129,0.4)]'
                    : 'text-slate-400 hover:text-white hover:bg-[#081524]/60'
                }`}
              >
                <Globe size={13} />
                <span>3D Mission Control (CesiumJS)</span>
              </button>

              <button
                onClick={() => setActiveCenterTab('2d')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-mono font-extrabold transition-all duration-200 ${
                  activeCenterTab === '2d'
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-black shadow-[0_0_12px_rgba(16,185,129,0.4)]'
                    : 'text-slate-400 hover:text-white hover:bg-[#081524]/60'
                }`}
              >
                <GitCommit size={13} />
                <span>2D Registration & Keypoints</span>
              </button>
            </div>

            {/* Right: Quick Telemetry Pills & Fullscreen Mode */}
            <div className="flex items-center gap-2">
              <span className="text-[8px] font-mono text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30 font-bold hidden sm:inline">
                ● LUNAR 3D TILESET
              </span>

              <button
                onClick={() => setIsMaximized(!isMaximized)}
                title={isMaximized ? 'Restore Split View' : 'Maximize Moon Window'}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-mono font-extrabold border transition-all ${
                  isMaximized
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-black border-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.4)]'
                    : 'bg-[#081524]/60 hover:bg-[#0E243C]/80 text-emerald-300 hover:text-white border-emerald-500/30'
                }`}
              >
                {isMaximized ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                <span>{isMaximized ? 'Restore View' : 'Maximize Moon Window'}</span>
              </button>
            </div>
          </div>

          {/* Viewport Content (Expands to Full Dimensions) */}
          <div className="flex-1 w-full h-[calc(100%-34px)] overflow-hidden rounded-lg bg-black border border-emerald-500/20 relative">
            {activeCenterTab === '3d' ? (
              <CesiumViewer
                selectedScene={selectedScene}
                layers={layers}
                onLayerChange={(l) => setLayers(l)}
                onSelectScene={(scene) => setSelectedScene(scene)}
              />
            ) : (
              <KeypointViewer />
            )}
          </div>
        </div>

        {/* ── Right Column: Telemetry, Science & Diagnostics (Collapsible / Hide in Maximized Mode) ── */}
        {!isMaximized && (
          <div
            className={`h-full transition-all duration-300 ease-in-out flex flex-col bg-transparent ${
              isRightCollapsed ? 'w-14 min-w-[56px]' : 'w-84 min-w-[320px] max-w-[360px]'
            }`}
          >
          {isRightCollapsed ? (
            <div
              onClick={() => setIsRightCollapsed(false)}
              className="h-full flex flex-col items-center justify-between py-2.5 px-1 bg-[#050B14]/40 hover:bg-[#050B14]/65 backdrop-blur-2xl rounded-2xl border border-emerald-500/25 shadow-xl cursor-pointer hover:border-emerald-400/50 transition-all group"
            >
              {/* Expand Action Button */}
              <div className="flex flex-col items-center gap-1 w-full">
                <button
                  onClick={(e) => { e.stopPropagation(); setIsRightCollapsed(false); }}
                  title="Expand Science & Telemetry Sidebar"
                  className="p-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 text-black border border-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.5)] group-hover:scale-110 transition-transform"
                >
                  <PanelRightOpen size={16} />
                </button>
                <span className="text-[8px] font-mono font-extrabold text-emerald-300 tracking-wider">EXPAND</span>
              </div>

              {/* List of sections it contains */}
              <div className="flex flex-col items-center gap-3 py-2 w-full">
                {[
                  { label: '1. Telemetry', sub: `${telemetry.rmsePx}px` },
                  { label: '2. SLZ Zone', sub: `${slz.goNoGo}` },
                  { label: '3. 3.0µm H₂O', sub: 'IIRS' },
                  { label: '4. Export', sub: 'GeoTIFF' },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    title={`Click to open: ${item.label}`}
                    className="flex flex-col items-center p-1 rounded-lg hover:bg-[#0A1628]/60 text-emerald-300/80 hover:text-white transition-colors w-full text-center"
                  >
                    <span className="text-[7.5px] font-mono font-extrabold text-slate-300 leading-tight">
                      {item.label}
                    </span>
                    <span className="text-[6.5px] font-mono text-emerald-400 font-bold">
                      {item.sub}
                    </span>
                  </div>
                ))}
              </div>

              {/* Vertical Title */}
              <div className="flex flex-col items-center gap-1 py-1">
                <span
                  className="text-[9px] font-mono font-extrabold text-emerald-300 tracking-widest uppercase select-none"
                  style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                >
                  SCIENCE & FINDINGS
                </span>
                <span className={`text-[7px] font-mono font-extrabold px-1 py-0.5 rounded border mt-1 ${
                  slz.goNoGo === 'GO' ? 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40' : 'bg-amber-950/70 text-amber-300 border-amber-500/40'
                }`}>
                  {slz.goNoGo}
                </span>
              </div>
            </div>
          ) : (
            <div className="h-full overflow-hidden bg-transparent">
              <SciencePanel
                telemetry={telemetry}
                slz={slz}
                spectralData={SPECTRAL_DATA}
                onToggleCollapse={() => setIsRightCollapsed(true)}
              />
            </div>
          )}
        </div>
      )}
      </main>
    </div>
  );
}

export default App;
