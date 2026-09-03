import React from 'react';
import { Activity, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { PipelineStage } from '../types';
import { PIPELINE_STAGE_LABELS } from '../data/mockData';

interface HeaderProps {
  activeStage: PipelineStage;
  selectedScene?: string;
  isBackendOnline?: boolean;
  backendLatencyMs?: number | null;
  onRefreshBackend?: () => void;
  onBackToLanding?: () => void;
}

const STAGE_ORDER = [
  PipelineStage.Idle,
  PipelineStage.Ingesting,
  PipelineStage.GraphMatching,
  PipelineStage.MAGSAC,
  PipelineStage.Warping,
  PipelineStage.Done,
];

export const Header: React.FC<HeaderProps> = ({
  activeStage,
  isBackendOnline = false,
  backendLatencyMs = null,
  onRefreshBackend,
  onBackToLanding,
}) => {
  const isRunning = activeStage !== PipelineStage.Idle && activeStage !== PipelineStage.Done;
  const isDone = activeStage === PipelineStage.Done;

  const stageIndex = STAGE_ORDER.indexOf(activeStage);
  const progressPct = isDone ? 100 : (stageIndex / (STAGE_ORDER.length - 1)) * 100;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-8 border-b border-[#D4C59A]/20 bg-[#07080A]/95 backdrop-blur-2xl flex items-center justify-between px-3 shadow-[0_4px_25px_rgba(0,0,0,0.9)]">
      {/* Return to Landing Page Button */}
      {onBackToLanding ? (
        <button
          onClick={onBackToLanding}
          className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-[#141620] hover:bg-[#1E2230] text-[#D4C59A] hover:text-white border border-[#D4C59A]/30 text-[9px] font-mono font-bold tracking-wider transition-all cursor-pointer shadow-sm shrink-0"
          title="Return to LUNARIS Landing Page"
        >
          <span>⟵ LANDING PAGE</span>
        </button>
      ) : (
        <div className="w-20" />
      )}

      {/* Pipeline Progress Indicator */}
      <div className="w-full max-w-2xl mx-auto flex items-center gap-3">
        <div className="flex items-center gap-1.5 min-w-max">
          <span className={`text-[10px] font-mono font-extrabold tracking-wider uppercase ${
            isDone ? 'text-[#D4C59A]' : isRunning ? 'text-[#EBE2CD]' : 'text-slate-400'
          }`}>
            PIPELINE: {PIPELINE_STAGE_LABELS[activeStage]}
          </span>
          {isRunning && (
            <Activity size={11} className="text-[#D4C59A] animate-pulse" />
          )}
        </div>

        <div className="flex-1 h-1.5 bg-black/80 rounded-full overflow-hidden border border-[#D4C59A]/20">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${progressPct}%`,
              background: isDone
                ? 'linear-gradient(90deg, #D4C59A, #EBE2CD, #4ADE80)'
                : isRunning
                ? 'linear-gradient(90deg, #D4C59A, #4ADE80, #FAF6EB)'
                : '#1A1D24',
              boxShadow: isRunning ? '0 0 10px rgba(212,197,154,0.6)' : 'none',
            }}
          />
        </div>

        <span className="text-[10px] font-mono font-bold text-[#D4C59A] min-w-max">{progressPct.toFixed(0)}%</span>
      </div>

      {/* Right Side: Live Backend API Connection Status */}
      <div className="flex items-center gap-2 shrink-0">
        <div
          title={isBackendOnline ? `FastAPI Server Connected (port 8000) · ${backendLatencyMs ? `${backendLatencyMs}ms` : 'online'}` : 'Backend Offline · Running in Standalone Mock Mode'}
          className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-[8.5px] font-mono font-bold transition-all ${
            isBackendOnline
              ? 'bg-[#0B1A12] border-emerald-500/40 text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.2)]'
              : 'bg-[#1C1710] border-amber-500/30 text-amber-300'
          }`}
        >
          {isBackendOnline ? (
            <>
              <Wifi size={10} className="text-emerald-400 animate-pulse" />
              <span>API LIVE</span>
              {backendLatencyMs && <span className="text-[7.5px] opacity-75">{backendLatencyMs}ms</span>}
            </>
          ) : (
            <>
              <WifiOff size={10} className="text-amber-400" />
              <span>OFFLINE (MOCK)</span>
            </>
          )}

          {onRefreshBackend && (
            <button
              onClick={onRefreshBackend}
              title="Ping & Reconnect Backend API"
              className="ml-1 hover:text-white transition-transform active:rotate-180"
            >
              <RefreshCw size={9} />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
