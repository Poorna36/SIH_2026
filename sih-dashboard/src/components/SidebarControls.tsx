import React, { useState, useCallback, useRef } from 'react';
import {
  Upload, FolderOpen, ChevronDown, Plus, Trash2,
  Database, Settings2, Layers, PanelLeftClose, Sliders, Activity
} from 'lucide-react';
import { PipelineStage, type ProcessingOptions, type ScenePreset, type UploadedFile } from '../types';
import { PIPELINE_STAGE_LABELS, SCENE_PRESETS } from '../data/mockData';
import type { PairSummary, DatasetStats, MatchersConfig } from '../services/api';

interface SidebarControlsProps {
  selectedScene: ScenePreset;
  onSceneChange: (scene: ScenePreset) => void;
  options: ProcessingOptions;
  onOptionsChange: (opts: ProcessingOptions) => void;
  pipelineStage: PipelineStage;
  onRunPipeline: () => void;
  onViewResults?: () => void;
  onToggleCollapse?: () => void;
  backendPairs?: PairSummary[];
  datasetStats?: DatasetStats | null;
  matcherConfig?: MatchersConfig | null;
  pipelineHistory?: any[];
  fetchSensorConfig?: (sensorName: string) => Promise<Record<string, unknown> | null>;
  isBackendOnline?: boolean;
}

const STAGE_SEQUENCE: PipelineStage[] = [
  PipelineStage.Idle,
  PipelineStage.Ingesting,
  PipelineStage.GraphMatching,
  PipelineStage.MAGSAC,
  PipelineStage.Warping,
  PipelineStage.Done,
];

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg bg-[#0A0C10]/60 hover:bg-[#141720]/80 border border-[#D4C59A]/20 hover:border-[#D4C59A]/40 transition-all group backdrop-blur-md"
    >
      <span className="text-[11px] text-slate-200 font-medium">{label}</span>
      <div className={`relative w-8 h-4 rounded-full transition-all duration-300 ${value ? 'bg-[#D4C59A] shadow-[0_0_10px_rgba(212,197,154,0.7)]' : 'bg-black/70 border border-slate-700'}`}>
        <div className={`absolute top-0.5 w-3 h-3 rounded-full transition-all duration-300 ${value ? 'left-4 bg-[#07080A]' : 'left-0.5 bg-slate-400'}`} />
      </div>
    </button>
  );
}

const SENSOR_BADGE: Record<string, { label: string; color: string }> = {
  '.xml': { label: 'PDS4', color: 'bg-[#1C1A14] text-[#D4C59A] border-[#D4C59A]/40' },
  '.img': { label: 'OHRC 0.25m', color: 'bg-[#221F16] text-[#EBE2CD] border-[#D4C59A]/50' },
  '.tif': { label: 'TMC-2 5.0m', color: 'bg-[#1C1D18] text-[#C2B080] border-[#C2B080]/40' },
  '.tiff': { label: 'TMC-2 5.0m', color: 'bg-[#1C1D18] text-[#C2B080] border-[#C2B080]/40' },
  '.qub': { label: 'IIRS 80m', color: 'bg-[#261E14] text-[#FBBF24] border-[#FBBF24]/40' },
};

function getSensorBadge(filename: string) {
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
  return SENSOR_BADGE[ext] || { label: 'RAW', color: 'bg-[#12141A] text-slate-300 border-slate-700' };
}

const DEFAULT_SAMPLE_FILES: UploadedFile[] = [
  { name: 'ohr_20200827T003010_nac.img', size: 1175157, sensor: 'OHRC', status: 'ready' },
  { name: 'tmc_20200827T003010_dsm.tif', size: 842100, sensor: 'TMC-2', status: 'ready' },
  { name: 'iirs_20200827_hyd250.qub', size: 624096, sensor: 'IIRS', status: 'ready' },
  { name: 'ch2_pds4_header_v1.xml', size: 45200, sensor: 'PDS4', status: 'ready' },
];

export const SidebarControls: React.FC<SidebarControlsProps> = ({
  selectedScene,
  onSceneChange,
  options,
  onOptionsChange,
  pipelineStage,
  onRunPipeline,
  onViewResults,
  onToggleCollapse,
  backendPairs = [],
  datasetStats = null,
  matcherConfig = null,
  pipelineHistory = [],
  fetchSensorConfig,
  isBackendOnline = false,
}) => {
  const [dragOver, setDragOver] = useState(false);
  const [files, setFiles] = useState<UploadedFile[]>(DEFAULT_SAMPLE_FILES);
  const [showSceneDropdown, setShowSceneDropdown] = useState(false);
  const [selectedSensorProfile, setSelectedSensorProfile] = useState<string | null>(null);
  const [sensorProfileData, setSensorProfileData] = useState<Record<string, any> | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleSelectSensorProfile = async (sensorKey: string) => {
    if (selectedSensorProfile === sensorKey) {
      setSelectedSensorProfile(null);
      setSensorProfileData(null);
      return;
    }
    setSelectedSensorProfile(sensorKey);
    if (fetchSensorConfig) {
      setIsLoadingProfile(true);
      const data = await fetchSensorConfig(sensorKey);
      setSensorProfileData(data);
      setIsLoadingProfile(false);
    }
  };

  const isRunning = pipelineStage !== PipelineStage.Idle && pipelineStage !== PipelineStage.Done;
  const isDone = pipelineStage === PipelineStage.Done;

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const dropped = Array.from(e.dataTransfer.files).map((f) => ({
        name: f.name,
        size: f.size,
        sensor: 'OHRC' as const,
        status: 'ready' as const,
      }));
      setFiles((prev) => [...prev, ...dropped]);
    }
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selected = Array.from(e.target.files).map((f) => ({
        name: f.name,
        size: f.size,
        sensor: 'OHRC' as const,
        status: 'ready' as const,
      }));
      setFiles((prev) => [...prev, ...selected]);
    }
  };

  const handleClearFiles = () => {
    setFiles([]);
  };

  const handleResetSampleFiles = () => {
    setFiles(DEFAULT_SAMPLE_FILES);
  };

  const setOpt = <K extends keyof ProcessingOptions>(key: K, val: ProcessingOptions[K]) => {
    onOptionsChange({ ...options, [key]: val });
  };

  const stageIndex = STAGE_SEQUENCE.indexOf(pipelineStage);
  const pipelineLabel = PIPELINE_STAGE_LABELS[pipelineStage];

  return (
    <aside className="flex flex-col gap-2 h-full overflow-y-auto pr-1 pb-20 sidebar-scroll bg-transparent">
      {/* Top Collapse Button */}
      {onToggleCollapse && (
        <div className="flex items-center justify-end px-1 pb-0.5">
          <button
            onClick={onToggleCollapse}
            title="Collapse Sidebar"
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#141620]/80 hover:bg-[#1C202C] text-[#D4C59A] hover:text-white border border-[#D4C59A]/25 text-[9px] font-mono font-bold transition-colors shadow-sm"
          >
            <PanelLeftClose size={11} />
            <span>Collapse</span>
          </button>
        </div>
      )}

      {/* ── Section: Data Ingestion ── */}
      <div className="panel-card">
        <div className="panel-header justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <Upload size={12} className="text-[#D4C59A]" />
            <span>Data Ingestion</span>
          </div>
          <span className="text-[8.5px] font-mono text-[#D4C59A] bg-[#1C1A14] px-2 py-0.5 rounded border border-[#D4C59A]/30 font-bold">
            {files.length} {files.length === 1 ? 'FILE' : 'FILES'} LOADED
          </span>
        </div>

        {/* Hidden Native File Picker Input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".xml,.img,.tif,.tiff,.qub,.png,.jpg,.jpeg,.json"
          onChange={handleFileInput}
          className="hidden"
        />

        {/* Interactive Dropzone / Click to Browse */}
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          title="Click to browse files from your computer or drag & drop here"
          className={`relative border border-dashed rounded-xl py-3 px-2 text-center cursor-pointer transition-all duration-300 group
            ${dragOver
              ? 'border-[#D4C59A] bg-[#1C1A14]/70 shadow-[0_0_20px_rgba(212,197,154,0.4)] scale-[0.99]'
              : 'border-[#D4C59A]/25 hover:border-[#D4C59A]/60 bg-[#0A0C10]/40 hover:bg-[#12141B]/70 shadow-lg backdrop-blur-md'
            }`}
        >
          <FolderOpen size={20} className={`mx-auto mb-1 transition-transform group-hover:scale-110 ${dragOver ? 'text-[#FAF6EB]' : 'text-[#D4C59A]'}`} />
          <p className="text-[11px] text-slate-100 font-bold group-hover:text-[#EBE2CD] transition-colors">
            Click to Browse or Drop Files
          </p>
          <p className="text-[8.5px] text-[#A39062] font-mono mt-0.5">
            .xml · .img (OHRC) · .tif (TMC-2) · .qub (IIRS)
          </p>
          {dragOver && (
            <div className="absolute inset-0 rounded-xl border border-[#D4C59A] animate-pulse bg-[#D4C59A]/10" />
          )}
        </div>

        {/* File Actions & Previews */}
        {files.length > 0 ? (
          <div className="mt-2">
            <div className="flex items-center justify-between text-[8px] font-mono text-slate-300 mb-1 px-0.5">
              <span>ACTIVE SENSOR BUNDLE</span>
              <button
                onClick={handleClearFiles}
                title="Clear file queue"
                className="text-[#D4C59A] hover:text-[#FAF6EB] flex items-center gap-0.5 underline font-bold"
              >
                <Trash2 size={10} />
                <span>Clear</span>
              </button>
            </div>

            <div className="space-y-1 max-h-24 overflow-y-auto sidebar-scroll pr-0.5">
              {files.map((f, i) => {
                const badge = getSensorBadge(f.name);
                return (
                  <div key={i} className="flex items-center gap-1.5 px-2 py-1 bg-[#090A0E]/70 rounded-lg border border-[#D4C59A]/15">
                    <span className={`text-[7.5px] font-mono font-extrabold px-1.5 py-0.5 rounded border ${badge.color}`}>{badge.label}</span>
                    <span className="text-[8.5px] text-slate-200 truncate flex-1 font-mono font-medium">{f.name}</span>
                    <span className="text-[7.5px] text-[#A39062] font-mono">{(f.size / 1024).toFixed(0)} KB</span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="mt-2 text-center">
            <button
              onClick={handleResetSampleFiles}
              className="text-[9px] font-mono text-[#D4C59A] hover:text-white bg-[#141620] px-2.5 py-1 rounded-lg border border-[#D4C59A]/30 transition-colors inline-flex items-center gap-1"
            >
              <Plus size={10} />
              <span>Load Sample Chandrayaan-2 Bundle</span>
            </button>
          </div>
        )}
      </div>

      {/* ── Section: Scene Preset & Backend Pairs ── */}
      <div
        className={`panel-card transition-all ${showSceneDropdown ? 'z-50 shadow-[0_0_25px_rgba(0,0,0,0.8)]' : 'z-10'}`}
        style={{ zIndex: showSceneDropdown ? 50 : 10 }}
      >
        <div className="panel-header flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Database size={12} className="text-[#D4C59A]" />
            <span>Scene Preset & Pairs</span>
          </div>
          {datasetStats && (
            <span className="text-[7.5px] font-mono text-[#D4C59A] bg-[#1C1A14] px-1.5 py-0.5 rounded border border-[#D4C59A]/30">
              {datasetStats.total_pairs} PDS-4 Pairs
            </span>
          )}
        </div>

        <div className="relative" style={{ zIndex: showSceneDropdown ? 50 : 10 }}>
          <button
            onClick={() => setShowSceneDropdown(!showSceneDropdown)}
            className="w-full flex items-center justify-between px-2.5 py-1.5 bg-[#0A0C10]/50 hover:bg-[#12141C]/80 border border-[#D4C59A]/20 hover:border-[#D4C59A]/50 rounded-lg text-left transition-all backdrop-blur-md"
          >
            <div>
              <p className="text-[11px] text-slate-100 font-bold leading-tight">{selectedScene.name}</p>
              <p className="text-[9px] font-mono text-[#D4C59A] mt-0.5">
                {selectedScene.lat.toFixed(1)}°, {selectedScene.lon.toFixed(1)}° · ρ={selectedScene.craterDensity}
              </p>
            </div>
            <ChevronDown size={12} className={`text-[#D4C59A] transition-transform ${showSceneDropdown ? 'rotate-180' : ''}`} />
          </button>

          {showSceneDropdown && (
            <>
              {/* Invisible click-outside dismiss backdrop */}
              <div
                className="fixed inset-0 z-40 bg-transparent"
                onClick={() => setShowSceneDropdown(false)}
              />
              <div className="absolute top-full mt-1 left-0 right-0 z-50 bg-[#0A0B0F] border border-[#D4C59A]/40 rounded-xl overflow-hidden shadow-[0_12px_40px_rgba(0,0,0,0.95)] backdrop-blur-2xl max-h-72 overflow-y-auto sidebar-scroll">
                <div className="px-2 py-1 bg-[#1C1A14] text-[8px] font-mono text-[#D4C59A] font-bold uppercase border-b border-[#D4C59A]/20">
                  Primary Landing Sites & SLZ Targets
                </div>
                {SCENE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => { onSceneChange(preset); setShowSceneDropdown(false); }}
                    className={`w-full px-2.5 py-1.5 text-left hover:bg-[#181B24] transition-colors border-b border-[#D4C59A]/10 last:border-0
                      ${selectedScene.id === preset.id ? 'bg-[#222018]' : ''}`}
                  >
                    <p className={`text-[11px] font-bold ${selectedScene.id === preset.id ? 'text-[#D4C59A]' : 'text-slate-100'}`}>{preset.name}</p>
                    <p className="text-[8px] font-mono text-slate-400">{preset.terrainClass} · GSD {preset.gsdM}m</p>
                  </button>
                ))}

              {backendPairs && backendPairs.length > 0 && (
                <>
                  <div className="px-2 py-1 bg-[#141820] text-[8px] font-mono text-[#EBE2CD] font-bold uppercase border-t border-b border-[#D4C59A]/20">
                    Live Backend PDS-4 Pairs ({backendPairs.length})
                  </div>
                  {backendPairs.map((p) => {
                    const lat = p.latitude_center_deg ?? 0;
                    const lon = p.longitude_center_deg ?? 0;
                    const isSelected = selectedScene.id === p.pair_id;
                    return (
                      <button
                        key={p.pair_id}
                        onClick={() => {
                          onSceneChange({
                            id: p.pair_id,
                            name: p.pair_id,
                            lat,
                            lon,
                            height: 85000,
                            terrainClass: (p.terrain_class as any) || 'highland',
                            craterDensity: p.crater_density_per_km2 ?? 3.5,
                            solarIncidenceDeg: p.src.solar_incidence_deg ?? 45.0,
                            solarAzimuthDeg: p.src.solar_azimuth_deg ?? 180.0,
                            gsdM: p.src.gsd_m,
                            overlayOpacity: 0.75,
                            description: `${p.src.sensor} (${p.src.product_id}) vs ${p.ref.type} (${p.ref.product_id}) · Overlap: ${(p.overlap_fraction * 100).toFixed(0)}%`,
                          });
                          setShowSceneDropdown(false);
                        }}
                        className={`w-full px-2.5 py-1.5 text-left hover:bg-[#181B24] transition-colors border-b border-[#D4C59A]/10 last:border-0 ${
                          isSelected ? 'bg-[#222018]' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <p className={`text-[10px] font-mono font-bold truncate max-w-[200px] ${isSelected ? 'text-[#D4C59A]' : 'text-slate-100'}`}>
                            {p.pair_id}
                          </p>
                          <span className="text-[7.5px] font-mono px-1 py-0.2 rounded bg-[#1C1A14] text-[#D4C59A] border border-[#D4C59A]/30">
                            {p.src.sensor}
                          </span>
                        </div>
                        <p className="text-[7.5px] font-mono text-slate-400 mt-0.5">
                          {lat.toFixed(1)}°, {lon.toFixed(1)}° · GSD {p.src.gsd_m}m · Split: {p.split}
                        </p>
                      </button>
                    );
                  })}
                </>
              )}
            </div>
            </>
          )}
        </div>

        {/* Scene metadata chips */}
        <div className="flex flex-wrap gap-1 mt-1.5">
          {[
            { label: `Inc: ${selectedScene.solarIncidenceDeg}°`, title: 'Solar Incidence' },
            { label: `${selectedScene.terrainClass.replace('_', ' ')}`, title: 'Terrain' },
            { label: `ρ: ${selectedScene.craterDensity}`, title: 'Crater Density' },
          ].map((chip) => (
            <span key={chip.label} title={chip.title} className="text-[8px] font-mono font-semibold px-1.5 py-0.5 bg-[#0A0B0E] text-[#D4C59A]/90 rounded border border-[#D4C59A]/20">
              {chip.label}
            </span>
          ))}
        </div>
      </div>

      {/* ── Section: Processing Toggles ── */}
      <div className="panel-card">
        <div className="panel-header">
          <Settings2 size={12} className="text-[#D4C59A]" />
          <span>L1 Preprocessing</span>
        </div>
        <div className="space-y-1">
          <Toggle label="2nd/98th Percentile Clip" value={options.percentileClipping} onChange={(v) => setOpt('percentileClipping', v)} />
          <Toggle label="CLAHE Enhancement" value={options.clahe} onChange={(v) => setOpt('clahe', v)} />
          <Toggle label="Morphological Gradients" value={options.morphologicalGradients} onChange={(v) => setOpt('morphologicalGradients', v)} />
          <Toggle label="PCA Band Reduction" value={options.pcaBandReduction} onChange={(v) => setOpt('pcaBandReduction', v)} />
        </div>
      </div>

      {/* ── Section: Matcher Selection ── */}
      <div className="panel-card">
        <div className="panel-header flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Layers size={12} className="text-[#D4C59A]" />
            <span>L2 Matcher Engine</span>
          </div>
          {isBackendOnline && matcherConfig && (
            <span className="text-[7.5px] font-mono text-[#D4C59A] bg-[#1C1A14] px-1.5 py-0.5 rounded border border-[#D4C59A]/30" title="Loaded from configs/matchers.yaml">
              YAML Config
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {([
            { id: 'sift', label: 'M0 SIFT', desc: matcherConfig?.sift?.enabled !== false ? 'Baseline (Always-On)' : 'Baseline' },
            { id: 'rift2', label: 'M1 RIFT2', desc: 'Illum-Robust' },
            { id: 'lightglue', label: 'M2 LightGlue', desc: 'GPU Learned' },
            { id: 'crater', label: 'M3 Crater', desc: 'Topology' },
          ] as const).map((m) => (
            <button
              key={m.id}
              onClick={() => setOpt('selectedMatcher', m.id)}
              className={`p-1.5 rounded-lg border text-left transition-all backdrop-blur-md
                ${options.selectedMatcher === m.id
                  ? 'border-[#D4C59A] bg-[#222018] text-white shadow-[0_0_12px_rgba(212,197,154,0.3)] font-bold'
                  : 'border-[#D4C59A]/15 bg-[#090A0E]/50 hover:bg-[#141620] text-slate-300 hover:border-[#D4C59A]/40 hover:text-white'}`}
            >
              <p className="text-[10px] font-mono font-extrabold text-[#D4C59A]">{m.label}</p>
              <p className="text-[8px] text-slate-400">{m.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* ── Section: Sensor Profiles (Live Backend YAML) ── */}
      <div className="panel-card">
        <div className="panel-header flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Sliders size={12} className="text-[#D4C59A]" />
            <span>Sensor Config Profiles</span>
          </div>
          <span className="text-[7.5px] font-mono text-[#A39062]">
            {isBackendOnline ? 'YAML API' : 'OFFLINE'}
          </span>
        </div>
        <div className="grid grid-cols-4 gap-1">
          {[
            { key: 'ohrc_nac', label: 'OHRC' },
            { key: 'tmc_wac', label: 'TMC-2' },
            { key: 'iirs_wac', label: 'IIRS' },
            { key: 'msm', label: 'MSM' },
          ].map((s) => (
            <button
              key={s.key}
              onClick={() => handleSelectSensorProfile(s.key)}
              className={`px-1.5 py-1 rounded text-[8.5px] font-mono font-bold border transition-all ${
                selectedSensorProfile === s.key
                  ? 'bg-[#D4C59A] text-black border-[#FAF6EB]'
                  : 'bg-[#0A0C10]/60 text-slate-300 hover:text-white border-[#D4C59A]/20 hover:border-[#D4C59A]/50'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {selectedSensorProfile && (
          <div className="mt-2 p-2 rounded-lg bg-black/80 border border-[#D4C59A]/30 text-[8px] font-mono max-h-32 overflow-y-auto sidebar-scroll">
            <div className="flex items-center justify-between text-[#D4C59A] font-bold pb-1 border-b border-[#D4C59A]/20">
              <span>CONFIG: {selectedSensorProfile.toUpperCase()}.YAML</span>
              {isLoadingProfile && <span className="animate-pulse">Loading...</span>}
            </div>
            {sensorProfileData ? (
              <pre className="text-slate-300 whitespace-pre-wrap font-mono mt-1 text-[7.5px] leading-tight">
                {JSON.stringify(sensorProfileData, null, 2)}
              </pre>
            ) : !isLoadingProfile ? (
              <p className="text-slate-400 mt-1">Select profile to view parameters.</p>
            ) : null}
          </div>
        )}
      </div>

      {/* ── Section: Recent Backend Pipeline Runs ── */}
      {pipelineHistory && pipelineHistory.length > 0 && (
        <div className="panel-card">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="panel-header w-full flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center gap-1.5">
              <Activity size={12} className="text-[#D4C59A]" />
              <span>Recent Pipeline Runs ({pipelineHistory.length})</span>
            </div>
            <ChevronDown size={12} className={`text-[#D4C59A] transition-transform ${showHistory ? 'rotate-180' : ''}`} />
          </button>
          {showHistory && (
            <div className="space-y-1 mt-1 max-h-28 overflow-y-auto sidebar-scroll">
              {pipelineHistory.slice(0, 5).map((run, i) => (
                <div key={i} className="p-1.5 rounded bg-black/60 border border-[#D4C59A]/20 text-[8px] font-mono flex items-center justify-between">
                  <div>
                    <span className="text-[#D4C59A] font-bold">[{run.run_id}]</span>{' '}
                    <span className="text-white truncate max-w-[90px] inline-block align-bottom">{run.pair_id}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-emerald-400 font-bold uppercase">{run.matcher}</span> ·{' '}
                    <span className="text-slate-400">{run.runtime_s}s</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Action Buttons ── */}
      <div className="pt-2 pb-2 space-y-2">
        {/* Primary Pipeline Execution Button */}
        <button
          onClick={onRunPipeline}
          disabled={isRunning}
          className={`relative w-full py-2.5 px-4 rounded-xl font-bold text-[11.5px] tracking-wider uppercase transition-all duration-300 overflow-hidden text-center shadow-md ${
            isDone
              ? 'bg-gradient-to-r from-[#D4C59A] via-[#EBE2CD] to-[#C2B080] text-black border border-[#FAF6EB]/70 shadow-[0_0_18px_rgba(212,197,154,0.4)]'
              : isRunning
              ? 'bg-[#12141A] border border-[#D4C59A]/30 text-[#D4C59A] cursor-not-allowed shadow-inner'
              : 'bg-[#D4C59A] hover:bg-[#EBE2CD] text-black border border-[#FAF6EB]/50 hover:shadow-[0_2px_18px_rgba(212,197,154,0.4)] active:scale-[0.98]'
          }`}
        >
          {/* Subtle top light hairline */}
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/40 to-transparent" />

          {isDone ? (
            <span className="font-sans font-bold tracking-wide">
              CO-REGISTRATION COMPLETE
            </span>
          ) : isRunning ? (
            <span className="font-mono text-[11px] font-semibold tracking-normal lowercase first-letter:uppercase">
              {pipelineLabel}
            </span>
          ) : (
            <span className="font-sans font-extrabold tracking-wider">
              RUN CO-REGISTRATION PIPELINE
            </span>
          )}
        </button>

        {/* Clean Professional Science Results CTA Button */}
        {onViewResults && (
          <button
            onClick={onViewResults}
            className="w-full flex items-center justify-center py-2.5 px-4 rounded-xl bg-[#0D0E12]/80 hover:bg-[#151822] border border-[#D4C59A]/30 hover:border-[#D4C59A]/60 text-slate-200 hover:text-white transition-all shadow-sm hover:shadow-md backdrop-blur-xl cursor-pointer"
          >
            <span className="font-sans font-bold text-xs tracking-wide text-center">
              Science Results & Findings
            </span>
          </button>
        )}
      </div>

      {/* Stage breadcrumb */}
      {isRunning && (
        <div className="flex items-center gap-1 px-1 flex-wrap">
          {STAGE_SEQUENCE.slice(1).map((stage, idx) => {
            const isPast = idx + 1 < stageIndex;
            const isCurrent = idx + 1 === stageIndex;
            return (
              <React.Fragment key={stage}>
                <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded transition-all font-bold
                  ${isCurrent ? 'bg-[#D4C59A] text-black' : isPast ? 'text-[#D4C59A]' : 'text-slate-600'}`}>
                  {stage.replace('_', ' ')}
                </span>
                {idx < STAGE_SEQUENCE.length - 2 && <span className="text-[#A39062] text-[8px]">›</span>}
              </React.Fragment>
            );
          })}
        </div>
      )}
    </aside>
  );
};
