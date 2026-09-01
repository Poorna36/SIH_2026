import React from 'react';
import { Satellite, Cpu, Clock, Activity, ChevronRight } from 'lucide-react';
import { useMissionClock } from '../hooks/useMissionClock';
import { PipelineStage } from '../types';
import { PIPELINE_STAGE_LABELS } from '../data/mockData';

interface HeaderProps {
  activeStage: PipelineStage;
  selectedScene: string;
}

const STAGE_ORDER = [
  PipelineStage.Idle,
  PipelineStage.Ingesting,
  PipelineStage.GraphMatching,
  PipelineStage.MAGSAC,
  PipelineStage.Warping,
  PipelineStage.Done,
];

export const Header: React.FC<HeaderProps> = ({ activeStage, selectedScene }) => {
  const utc = useMissionClock();
  const isRunning = activeStage !== PipelineStage.Idle && activeStage !== PipelineStage.Done;
  const isDone = activeStage === PipelineStage.Done;

  const stageIndex = STAGE_ORDER.indexOf(activeStage);
  const progressPct = isDone ? 100 : (stageIndex / (STAGE_ORDER.length - 1)) * 100;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-11 border-b border-emerald-500/25 bg-[#02050A]/95 backdrop-blur-2xl flex items-center px-3 gap-3 shadow-[0_4px_25px_rgba(0,0,0,0.9)]">
      {/* Logo / Mission ID */}
      <div className="flex items-center gap-2 min-w-max">
        <div className="p-1 rounded-lg bg-emerald-500/15 border border-emerald-400/40 text-emerald-400">
          <Satellite size={13} className="animate-pulse text-emerald-400" />
        </div>
        <span className="font-mono text-xs font-extrabold text-emerald-400 tracking-wider uppercase">SIH26166</span>
        <ChevronRight size={12} className="text-slate-600" />
        <span className="text-slate-100 text-[11px] font-bold tracking-tight">Chandrayaan-2 Co-Registration Workbench</span>
      </div>

      {/* Pipeline Progress Indicator */}
      <div className="flex-1 mx-2">
        <div className="flex items-center justify-between mb-0.5">
          <div className="flex items-center gap-1.5">
            <span className={`text-[9px] font-mono font-extrabold tracking-wider uppercase ${
              isDone ? 'text-emerald-400' : isRunning ? 'text-cyan-300' : 'text-slate-400'
            }`}>
              PIPELINE: {PIPELINE_STAGE_LABELS[activeStage]}
            </span>
            {isRunning && (
              <Activity size={10} className="text-cyan-300 animate-pulse" />
            )}
          </div>
          <span className="text-[9px] font-mono font-bold text-emerald-300">{progressPct.toFixed(0)}%</span>
        </div>
        <div className="h-1 bg-black/80 rounded-full overflow-hidden border border-emerald-500/25">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${progressPct}%`,
              background: isDone
                ? 'linear-gradient(90deg, #10B981, #38BDF8)'
                : isRunning
                ? 'linear-gradient(90deg, #34D399, #38BDF8, #A7F3D0)'
                : '#1E293B',
              boxShadow: isRunning ? '0 0 10px #34D399' : 'none',
            }}
          />
        </div>
      </div>

      {/* Scene Target Badge */}
      <div className="hidden lg:flex items-center gap-1.5 px-2 py-0.5 bg-[#081220]/80 rounded-lg border border-emerald-500/30 backdrop-blur-md">
        <span className="text-[8px] text-cyan-300 font-mono font-extrabold uppercase tracking-widest">TARGET</span>
        <span className="text-[10px] text-slate-100 font-mono font-semibold">{selectedScene || '—'}</span>
      </div>

      {/* Hardware Accelerator Badge */}
      <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#06140D]/80 rounded-lg border border-emerald-400/40">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        <Cpu size={11} className="text-emerald-400" />
        <span className="text-[9px] font-mono text-emerald-300 font-bold">CUDA 12.3</span>
      </div>

      {/* Live UTC Mission Clock */}
      <div className="flex items-center gap-1 px-2 py-0.5 bg-black/80 rounded-lg border border-emerald-500/30 min-w-max">
        <Clock size={11} className="text-emerald-400" />
        <span className="font-mono text-[10px] font-bold text-slate-200">{utc.replace('GMT', 'UTC').split(' ').slice(1, 5).join(' ')}</span>
      </div>
    </header>
  );
};
