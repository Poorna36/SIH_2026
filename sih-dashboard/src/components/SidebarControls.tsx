import React, { useState, useCallback, useRef } from 'react';
import {
  Upload, FolderOpen, ChevronDown, Plus, Trash2,
  Loader2, CheckCircle2, Zap, Database, Settings2, Layers, PanelLeftClose
} from 'lucide-react';
import { PipelineStage, type ProcessingOptions, type ScenePreset, type UploadedFile } from '../types';
import { PIPELINE_STAGE_LABELS, SCENE_PRESETS } from '../data/mockData';

interface SidebarControlsProps {
  selectedScene: ScenePreset;
  onSceneChange: (scene: ScenePreset) => void;
  options: ProcessingOptions;
  onOptionsChange: (opts: ProcessingOptions) => void;
  pipelineStage: PipelineStage;
  onRunPipeline: () => void;
  onToggleCollapse?: () => void;
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
      className="flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg bg-[#060D1A]/35 hover:bg-[#0B172E]/55 border border-emerald-500/20 hover:border-emerald-400/40 transition-all group backdrop-blur-md"
    >
      <span className="text-[11px] text-slate-200 font-medium">{label}</span>
      <div className={`relative w-8 h-4 rounded-full transition-all duration-300 ${value ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_10px_rgba(16,185,129,0.8)]' : 'bg-black/70 border border-slate-700'}`}>
        <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-all duration-300 ${value ? 'left-4' : 'left-0.5'}`} />
      </div>
    </button>
  );
}

const SENSOR_BADGE: Record<string, { label: string; color: string }> = {
  '.xml': { label: 'PDS4', color: 'bg-emerald-950/70 text-emerald-300 border-emerald-500/50' },
  '.img': { label: 'OHRC', color: 'bg-sky-950/70 text-sky-300 border-sky-400/60' },
  '.tif': { label: 'TMC-2', color: 'bg-teal-950/70 text-teal-300 border-teal-500/50' },
  '.tiff': { label: 'TMC-2', color: 'bg-teal-950/70 text-teal-300 border-teal-500/50' },
  '.qub': { label: 'IIRS', color: 'bg-amber-950/70 text-amber-300 border-amber-400/60' },
};

function getSensorBadge(filename: string) {
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
  return SENSOR_BADGE[ext] || { label: 'RAW', color: 'bg-slate-850/70 text-slate-200 border-slate-700' };
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
  onToggleCollapse,
}) => {
  const [dragOver, setDragOver] = useState(false);
  const [files, setFiles] = useState<UploadedFile[]>(DEFAULT_SAMPLE_FILES);
  const [showSceneDropdown, setShowSceneDropdown] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
      {/* Sidebar Header with Collapse Button */}
      <div className="flex items-center justify-between px-2 py-1 bg-[#050B14]/40 hover:bg-[#050B14]/60 backdrop-blur-xl rounded-xl border border-emerald-500/25 shadow-lg transition-colors">
        <div className="flex items-center gap-1.5 text-[10px] font-mono font-extrabold text-emerald-300 uppercase tracking-wider">
          <Settings2 size={12} className="text-emerald-400" />
          <span>Mission Controls</span>
        </div>
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            title="Collapse Sidebar"
            className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-[#0A1628]/60 hover:bg-[#102444]/80 text-emerald-300 hover:text-white border border-emerald-500/30 text-[9px] font-mono font-bold transition-colors"
          >
            <PanelLeftClose size={11} />
            <span>Collapse</span>
          </button>
        )}
      </div>

      {/* ── Section: Data Ingestion ── */}
      <div className="panel-card">
        <div className="panel-header justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <Upload size={12} className="text-emerald-400" />
            <span>Data Ingestion</span>
          </div>
          <span className="text-[8.5px] font-mono text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/40 font-bold">
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
              ? 'border-emerald-400 bg-emerald-950/40 shadow-[0_0_20px_rgba(16,185,129,0.4)] scale-[0.99]'
              : 'border-emerald-500/30 hover:border-emerald-400/80 bg-[#050C17]/35 hover:bg-[#0A1628]/60 shadow-lg backdrop-blur-md'
            }`}
        >
          <FolderOpen size={20} className={`mx-auto mb-1 transition-transform group-hover:scale-110 ${dragOver ? 'text-emerald-300' : 'text-emerald-400'}`} />
          <p className="text-[11px] text-slate-100 font-bold group-hover:text-emerald-200 transition-colors">
            Click to Browse or Drop Files
          </p>
          <p className="text-[8.5px] text-slate-400 font-mono mt-0.5">
            .xml · .img · .tif · .qub · .tiff
          </p>
          {dragOver && (
            <div className="absolute inset-0 rounded-xl border border-emerald-400 animate-pulse bg-emerald-500/10" />
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
                className="text-emerald-400 hover:text-emerald-200 flex items-center gap-0.5 underline font-bold"
              >
                <Trash2 size={10} />
                <span>Clear</span>
              </button>
            </div>

            <div className="space-y-1 max-h-24 overflow-y-auto sidebar-scroll pr-0.5">
              {files.map((f, i) => {
                const badge = getSensorBadge(f.name);
                return (
                  <div key={i} className="flex items-center gap-1.5 px-2 py-1 bg-[#040913]/50 rounded-lg border border-emerald-500/20">
                    <span className={`text-[7.5px] font-mono font-extrabold px-1.5 py-0.5 rounded border ${badge.color}`}>{badge.label}</span>
                    <span className="text-[8.5px] text-slate-200 truncate flex-1 font-mono font-medium">{f.name}</span>
                    <span className="text-[7.5px] text-slate-400 font-mono">{(f.size / 1024).toFixed(0)} KB</span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="mt-2 text-center">
            <button
              onClick={handleResetSampleFiles}
              className="text-[9px] font-mono text-emerald-300 hover:text-white bg-[#0A1628]/70 px-2.5 py-1 rounded-lg border border-emerald-500/40 transition-colors inline-flex items-center gap-1"
            >
              <Plus size={10} />
              <span>Load Sample Chandrayaan-2 Bundle</span>
            </button>
          </div>
        )}
      </div>

      {/* ── Section: Scene Preset ── */}
      <div className="panel-card">
        <div className="panel-header">
          <Database size={12} className="text-emerald-400" />
          <span>Scene Preset</span>
        </div>

        <div className="relative">
          <button
            onClick={() => setShowSceneDropdown(!showSceneDropdown)}
            className="w-full flex items-center justify-between px-2.5 py-1.5 bg-[#050C17]/40 hover:bg-[#081528]/60 border border-emerald-500/25 hover:border-emerald-400 rounded-lg text-left transition-all backdrop-blur-md"
          >
            <div>
              <p className="text-[11px] text-slate-100 font-bold leading-tight">{selectedScene.name}</p>
              <p className="text-[9px] font-mono text-emerald-300 mt-0.5">
                {selectedScene.lat.toFixed(1)}°, {selectedScene.lon.toFixed(1)}° · ρ={selectedScene.craterDensity}
              </p>
            </div>
            <ChevronDown size={12} className={`text-emerald-400 transition-transform ${showSceneDropdown ? 'rotate-180' : ''}`} />
          </button>

          {showSceneDropdown && (
            <div className="absolute top-full mt-1 left-0 right-0 z-40 bg-[#060F1E]/95 border border-emerald-500/40 rounded-xl overflow-hidden shadow-2xl backdrop-blur-2xl">
              {SCENE_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => { onSceneChange(preset); setShowSceneDropdown(false); }}
                  className={`w-full px-2.5 py-1.5 text-left hover:bg-[#0B1E38] transition-colors border-b border-emerald-500/15 last:border-0
                    ${selectedScene.id === preset.id ? 'bg-[#0E2748]' : ''}`}
                >
                  <p className={`text-[11px] font-bold ${selectedScene.id === preset.id ? 'text-emerald-300' : 'text-slate-100'}`}>{preset.name}</p>
                  <p className="text-[8px] font-mono text-slate-400">{preset.terrainClass} · GSD {preset.gsdM}m</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Scene metadata chips */}
        <div className="flex flex-wrap gap-1 mt-1.5">
          {[
            { label: `Inc: ${selectedScene.solarIncidenceDeg}°`, title: 'Solar Incidence' },
            { label: `${selectedScene.terrainClass.replace('_', ' ')}`, title: 'Terrain' },
            { label: `ρ: ${selectedScene.craterDensity}`, title: 'Crater Density' },
          ].map((chip) => (
            <span key={chip.label} title={chip.title} className="text-[8px] font-mono font-semibold px-1.5 py-0.5 bg-[#040913]/50 text-emerald-300/90 rounded border border-emerald-500/25">
              {chip.label}
            </span>
          ))}
        </div>
      </div>

      {/* ── Section: Processing Toggles ── */}
      <div className="panel-card">
        <div className="panel-header">
          <Settings2 size={12} className="text-emerald-400" />
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
        <div className="panel-header">
          <Layers size={12} className="text-emerald-400" />
          <span>L2 Matcher Engine</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {([
            { id: 'sift', label: 'M0 SIFT', desc: 'Baseline' },
            { id: 'rift2', label: 'M1 RIFT2', desc: 'Illum-Robust' },
            { id: 'lightglue', label: 'M2 LightGlue', desc: 'GPU Learned' },
            { id: 'crater', label: 'M3 Crater', desc: 'Topology' },
          ] as const).map((m) => (
            <button
              key={m.id}
              onClick={() => setOpt('selectedMatcher', m.id)}
              className={`p-1.5 rounded-lg border text-left transition-all backdrop-blur-md
                ${options.selectedMatcher === m.id
                  ? 'border-emerald-400 bg-[#0A241A]/70 text-white shadow-[0_0_12px_rgba(16,185,129,0.3)] font-bold'
                  : 'border-emerald-500/20 bg-[#040913]/40 hover:bg-[#081524]/60 text-slate-300 hover:border-emerald-400/50 hover:text-white'}`}
            >
              <p className="text-[10px] font-mono font-extrabold text-emerald-300">{m.label}</p>
              <p className="text-[8px] text-slate-400">{m.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* ── Primary CTA ── */}
      <div className="pt-1 pb-3">
        <button
          onClick={onRunPipeline}
          disabled={isRunning}
          className={`relative w-full py-3 rounded-xl font-extrabold text-xs tracking-wider uppercase transition-all duration-300 overflow-hidden shadow-2xl ${
            isDone
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 border border-emerald-400 text-white shadow-[0_0_15px_rgba(16,185,129,0.4)]'
              : isRunning
              ? 'bg-[#06140D] border border-emerald-500/40 text-emerald-200 cursor-not-allowed'
              : 'bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500 hover:from-emerald-400 hover:to-teal-300 text-black shadow-[0_0_22px_rgba(16,185,129,0.5)] border border-emerald-300'
          }`}
        >
          {isDone ? (
            <span className="flex items-center justify-center gap-1.5">
              <CheckCircle2 size={14} /> Co-Registration Complete
            </span>
          ) : isRunning ? (
            <span className="flex items-center justify-center gap-1.5">
              <Loader2 size={14} className="animate-spin" />
              {pipelineLabel}
            </span>
          ) : (
            <span className="flex items-center justify-center gap-1.5">
              <Zap size={14} className="fill-black" />
              Run Co-Registration Pipeline
            </span>
          )}
        </button>
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
                  ${isCurrent ? 'bg-emerald-400 text-black' : isPast ? 'text-emerald-400' : 'text-slate-600'}`}>
                  {stage.replace('_', ' ')}
                </span>
                {idx < STAGE_SEQUENCE.length - 2 && <span className="text-emerald-600 text-[8px]">›</span>}
              </React.Fragment>
            );
          })}
        </div>
      )}
    </aside>
  );
};
