import React from 'react';
import {
  Plus, Minus, RotateCcw, Globe, GitCommit, FlaskConical,
  ChevronDown, Play, Check, Sliders, Compass, Upload
} from 'lucide-react';
import { PipelineStage, type ScenePreset, type LayerVisibility, type PipelineOptions } from '../types';
import { MapLayerControl } from './MapLayerControl';

export interface ProbedLocation {
  lat: number;
  lon: number;
  name: string;
  region: string;
  elevationM: number;
  solarIncidence: number;
  temperatureK: number;
  waterIceWtPct: number;
  psrStatus: string;
  craterId?: string;
}

interface MoonWorkbenchOverlayProps {
  selectedScene: ScenePreset;
  onSelectScene?: (scene: ScenePreset) => void;
  layers: LayerVisibility;
  onLayerChange?: (layers: LayerVisibility) => void;
  options: PipelineOptions;
  onOptionsChange: (options: PipelineOptions) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  activeTab: '3d' | '2d' | 'results';
  onTabChange: (tab: '3d' | '2d' | 'results') => void;
  onBackToLanding: () => void;
  onOpenTargetPalette: () => void;
  onOpenEngineInspector: () => void;
  onOpenAddFiles?: () => void;
  pipelineStage: PipelineStage;
  onRunPipeline: () => void;
  telemetryRmse?: number;
  isOrbitTourActive?: boolean;
  onToggleOrbitTour?: () => void;
  probedTarget?: ProbedLocation | null;
  onCloseProbeTarget?: () => void;
  onInspectProbedTargetIn2D?: () => void;
  isBackendOnline?: boolean;
}

export const MoonWorkbenchOverlay: React.FC<MoonWorkbenchOverlayProps> = ({
  selectedScene,
  layers,
  onLayerChange,
  options,
  onOptionsChange,
  onZoomIn,
  onZoomOut,
  onResetView,
  activeTab,
  onTabChange,
  onBackToLanding,
  onOpenTargetPalette,
  onOpenEngineInspector,
  onOpenAddFiles,
  pipelineStage,
  onRunPipeline,
  telemetryRmse = 0.34,
  isOrbitTourActive = false,
  onToggleOrbitTour,
  isBackendOnline = false,
}) => {
  const isRunning = pipelineStage !== PipelineStage.Idle && pipelineStage !== PipelineStage.Done;
  const isDone = pipelineStage === PipelineStage.Done;

  return (
    <div className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden select-none font-sans z-20">
      {/* ── 1. TOP-LEFT: BRAND & CRATER SELECTOR + ADD FILES (BESIDE) ── */}
      <div className="absolute top-4 left-4 sm:top-5 sm:left-5 pointer-events-auto flex items-center gap-2">
        <div className="flex items-center gap-2 sm:gap-2.5 bg-black/60 hover:bg-black/80 backdrop-blur-xl border border-white/15 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.6)] transition-all">
          {/* Brand: Voyage (Click goes to Home) */}
          <button
            onClick={onBackToLanding}
            className="flex items-center gap-2 group cursor-pointer focus:outline-none"
            title="Return to Home Overview"
          >
            <span className="font-logo text-base sm:text-lg font-extrabold tracking-[0.08em] text-white group-hover:text-[#2997FF] transition-colors">
              Voyage
            </span>
            <div className="w-4 h-4 rounded-full bg-gradient-to-tr from-[#0F1117] via-slate-300 to-white shadow-[0_0_8px_rgba(255,255,255,0.35)] relative overflow-hidden flex items-center justify-center shrink-0 border border-white/30">
              <div className="absolute inset-0 bg-black/75 rounded-full translate-x-1 -translate-y-0.5" />
            </div>
          </button>

          <div className="w-px h-4 bg-white/20" />

          {/* Current Crater Selector (Opens Target Palette) */}
          <button
            onClick={onOpenTargetPalette}
            className="flex items-center gap-2 text-white/80 hover:text-white transition-colors cursor-pointer group"
            title="Open Lunar Target Palette"
          >
            <span className="w-2 h-2 rounded-full bg-[#2997FF] shadow-[0_0_8px_rgba(41,151,255,0.8)]" />
            <span className="text-xs font-semibold max-w-[105px] sm:max-w-[160px] md:max-w-none truncate">
              {selectedScene.name}
            </span>
            <ChevronDown size={13} className="text-white/40 group-hover:text-white transition-transform group-hover:translate-y-0.5" />
          </button>

          {/* Add Files Button (Right beside crater selector) */}
          {onOpenAddFiles && (
            <>
              <div className="w-px h-4 bg-white/20" />
              <button
                onClick={onOpenAddFiles}
                className="flex items-center gap-1.5 text-white/75 hover:text-white transition-all cursor-pointer group active:scale-95 text-xs font-semibold"
                title="Add Lunar Mission Imagery / PDS-4 Files"
              >
                <Upload size={12} className="text-[#2997FF] group-hover:scale-110 transition-transform" />
                <span>Add Files</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── 2. TOP-RIGHT: WORKBENCH MODE SWITCHER & ENGINE INSPECTOR ── */}
      <div className="absolute top-4 right-4 sm:top-5 sm:right-5 pointer-events-auto flex items-center bg-black/60 hover:bg-black/80 backdrop-blur-xl border border-white/15 p-1 rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.6)] transition-all">
        <button
          onClick={() => onTabChange('3d')}
          className={`flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-full font-semibold transition-all cursor-pointer text-xs ${
            activeTab === '3d'
              ? 'bg-white text-black shadow-md'
              : 'text-white/65 hover:text-white hover:bg-white/10'
          }`}
        >
          <Globe size={13} />
          <span>3D Globe</span>
        </button>

        <button
          onClick={() => onTabChange('2d')}
          className={`flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-full font-semibold transition-all cursor-pointer text-xs ${
            activeTab === '2d'
              ? 'bg-white text-black shadow-md'
              : 'text-white/65 hover:text-white hover:bg-white/10'
          }`}
        >
          <GitCommit size={13} />
          <span>2D Alignment</span>
        </button>

        <button
          onClick={() => onTabChange('results')}
          className={`flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-full font-semibold transition-all cursor-pointer text-xs ${
            activeTab === 'results'
              ? 'bg-white text-black shadow-md'
              : 'text-white/65 hover:text-white hover:bg-white/10'
          }`}
        >
          <FlaskConical size={13} />
          <span>Findings</span>
        </button>

        <div className="w-px h-3.5 bg-white/20 mx-1" />

        {/* Polar Orbit Tour Toggle */}
        <button
          onClick={onToggleOrbitTour}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-semibold transition-all cursor-pointer text-xs ${
            isOrbitTourActive
              ? 'bg-[#2997FF] text-white shadow-[0_0_12px_rgba(41,151,255,0.6)]'
              : 'text-white/65 hover:text-white hover:bg-white/10'
          }`}
          title="Toggle Chandrayaan-2 Polar Orbit Inspection Mode"
        >
          <Compass size={13} className={isOrbitTourActive ? 'animate-spin' : ''} />
          <span className="hidden md:inline">Orbit Tour</span>
        </button>

        {/* Engine Inspector Trigger Button */}
        <button
          onClick={onOpenEngineInspector}
          className="flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-full font-semibold transition-all cursor-pointer text-xs text-white/65 hover:text-white hover:bg-white/10"
          title="Open Registration Engine & Dataset Inspector"
        >
          <Sliders size={13} />
          <span className="hidden sm:inline">Engine</span>
        </button>
      </div>

      {/* ── 2B. POLAR ORBIT TELEMETRY RIBBON ── */}
      {isOrbitTourActive && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 pointer-events-auto flex items-center gap-2 px-4 py-1.5 rounded-full bg-black/75 backdrop-blur-xl border border-[#2997FF]/50 text-xs font-mono text-white shadow-[0_0_20px_rgba(41,151,255,0.35)] animate-in fade-in duration-200">
          <span className="w-2 h-2 rounded-full bg-[#2997FF] animate-ping" />
          <span className="font-bold text-[#2997FF]">CH-2 POLAR ORBIT:</span>
          <span>100.4 KM ALT · 1.68 KM/S · NADIR CAMERA ACTIVE</span>
        </div>
      )}



      {/* ── 3. BOTTOM-CENTER: PRIMARY ACTION BAR ONLY (ZERO REDUNDANT BUTTONS) ── */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 pointer-events-auto flex items-center gap-2.5 bg-black/75 hover:bg-black/85 backdrop-blur-2xl border border-white/15 p-1.5 sm:p-2 rounded-full shadow-[0_12px_40px_rgba(0,0,0,0.8)] transition-all">
        {/* Primary Action Button: Run Co-Registration */}
        <button
          onClick={onRunPipeline}
          disabled={isRunning}
          className={`flex items-center gap-2 px-5 sm:px-6 py-2 rounded-full font-bold text-xs tracking-wide uppercase transition-all cursor-pointer active:scale-95 shadow-md ${
            isDone
              ? 'bg-white text-black shadow-lg hover:bg-white/90'
              : isRunning
              ? 'bg-white/10 text-white/40 cursor-not-allowed'
              : 'bg-[#0071E3] hover:bg-[#0077ED] text-white shadow-[0_0_16px_rgba(0,113,227,0.4)]'
          }`}
        >
          {isDone ? (
            <Check size={13} strokeWidth={3} className="text-emerald-600" />
          ) : (
            <Play size={13} className={isRunning ? 'animate-spin' : 'fill-current'} />
          )}
          <span>{isDone ? `Registered (${telemetryRmse.toFixed(3)} px)` : isRunning ? 'Aligning...' : 'Run Co-Registration'}</span>
        </button>

        <div className="w-px h-4 bg-white/20 mx-0.5" />

        {/* Live Telemetry Readout */}
        <div className="px-3 py-1 text-xs text-white/60 font-mono flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${isBackendOnline ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]' : 'bg-amber-400'}`} />
          <span>RMSE: <strong className="text-white">{telemetryRmse.toFixed(3)} px</strong></span>
          <span className="text-[10px] text-white/40 ml-1">({isBackendOnline ? 'LIVE' : 'CACHE'})</span>
        </div>
      </div>

      {/* ── 4. BOTTOM-LEFT: FLOATING LAYER CONTROL CAPSULE ── */}
      <div className="absolute bottom-5 left-5 pointer-events-auto">
        <MapLayerControl
          layers={layers}
          onLayerChange={onLayerChange || (() => {})}
          options={options}
          onOptionsChange={onOptionsChange}
        />
      </div>

      {/* ── 5. BOTTOM-RIGHT: CAMERA CONTROLS ONLY ── */}
      <div className="absolute bottom-5 right-5 pointer-events-auto flex items-center gap-1 bg-black/60 hover:bg-black/80 backdrop-blur-xl border border-white/15 p-1 rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.6)] transition-all">
        <button
          onClick={onZoomIn}
          title="Zoom In"
          className="p-2 rounded-full text-white/70 hover:text-white hover:bg-white/15 transition-colors cursor-pointer active:scale-95"
        >
          <Plus size={14} />
        </button>
        <button
          onClick={onZoomOut}
          title="Zoom Out"
          className="p-2 rounded-full text-white/70 hover:text-white hover:bg-white/15 transition-colors cursor-pointer active:scale-95"
        >
          <Minus size={14} />
        </button>
        <div className="w-px h-3.5 bg-white/15 mx-0.5" />
        <button
          onClick={onResetView}
          title="Reset Camera View"
          className="p-2 rounded-full text-white/70 hover:text-white hover:bg-white/15 transition-colors cursor-pointer active:scale-95"
        >
          <RotateCcw size={13} />
        </button>
      </div>
    </div>
  );
};
