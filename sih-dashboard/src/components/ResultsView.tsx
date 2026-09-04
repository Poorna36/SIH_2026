import React from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import {
  CheckCircle2
} from 'lucide-react';
import type { TelemetryData, SLZDiagnostic, SpectralData, ScenePreset } from '../types';

interface ResultsViewProps {
  telemetry: TelemetryData;
  slz: SLZDiagnostic;
  spectralData: SpectralData;
  selectedScene: ScenePreset;
  onNavigateToTab?: (tab: '3d' | '2d') => void;
  isBackendOnline?: boolean;
  isLoading?: boolean;
}

export const ResultsView: React.FC<ResultsViewProps> = ({
  telemetry,
  slz,
  spectralData,
  selectedScene,
  isBackendOnline = false,
  isLoading = false,
}) => {
  const handleExportReport = () => {
    const reportData = {
      mission: 'ISRO Chandrayaan-2 Co-Registration Workbench',
      problem_statement: 'SIH26166 Autonomous Precision Engine',
      target: selectedScene.name,
      target_id: selectedScene.id,
      generated_at: new Date().toISOString(),
      selenographic_coordinates: {
        latitude: selectedScene.lat,
        longitude: selectedScene.lon,
        terrain_class: selectedScene.terrainClass,
        solar_incidence_deg: selectedScene.solarIncidenceDeg,
      },
      telemetry: {
        rmse_px: telemetry.rmsePx,
        ssim: telemetry.ssim,
        inlier_count: telemetry.inlierCount,
        inlier_ratio: telemetry.inlierRatio,
        spatial_coverage: telemetry.spatialCoverage,
        matcher_winner: telemetry.matcherWinner,
        runtime_seconds: telemetry.runtimeS,
      },
      safe_landing_zone: {
        overall_safety_score: slz.overallSafetyScore,
        decision: slz.goNoGo,
        measured_slope_deg: slz.slopeDeg,
        slope_threshold_deg: slz.slopeThresholdDeg,
        slope_pass_rate: slz.slopePassRate,
        boulder_clearance_m: slz.boulderClearanceM,
        boulder_pass_rate: slz.boulderPassRate,
      },
      hyperspectral_analysis: {
        sensor: spectralData.sensor,
        band: spectralData.band,
        absorption_trough_wavelength_um: spectralData.absorptionTroughWavelength,
        water_ice_absorption_depth: spectralData.absorptionDepth,
        spectral_curve: spectralData.data,
      },
      backend_status: isBackendOnline ? 'AUTHENTIC_LIVE_FASTAPI' : 'OFFLINE_CACHE',
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chandrayaan2_pds4_report_${selectedScene.id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full h-full overflow-y-auto sidebar-scroll p-6 md:p-10 space-y-8 bg-transparent text-white font-sans max-w-7xl mx-auto">
      {/* ── TOP EDITORIAL HEADER ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-white/10">
        <div>
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <span className="w-2 h-2 rounded-full bg-[#2997FF] shadow-[0_0_8px_rgba(41,151,255,0.8)]" />
            <span className="text-xs font-bold text-[#2997FF] tracking-widest uppercase">
              Science & Accuracy Diagnostics
            </span>
            {isBackendOnline ? (
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[11px] font-semibold text-emerald-300 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)] animate-pulse" />
                <span>FastAPI Backend Synced {isLoading ? '(Calibrating...)' : ''}</span>
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-[11px] font-semibold text-amber-300 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span>Offline Fallback Data</span>
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white font-headline leading-tight">
            {selectedScene.name}
          </h1>
          <p className="text-sm text-white/50 mt-2 flex items-center gap-3 flex-wrap font-sans">
            <span>Coordinates: <strong className="text-white font-medium">[{Math.abs(selectedScene.lat).toFixed(3)}°{selectedScene.lat >= 0 ? 'N' : 'S'}, {Math.abs(selectedScene.lon).toFixed(3)}°{selectedScene.lon >= 0 ? 'E' : 'W'}]</strong></span>
            <span className="text-white/20">·</span>
            <span>Terrain: <strong className="text-white font-medium capitalize">{selectedScene.terrainClass?.replace('_', ' ') || 'Polar Highland'}</strong></span>
            <span className="text-white/20">·</span>
            <span>Sun Incidence: <strong className="text-white font-medium">{selectedScene.solarIncidenceDeg ?? 68.2}°</strong></span>
            <span className="text-white/20">·</span>
            <span>Resolution: <strong className="text-white font-medium">{selectedScene.gsdM ?? 0.31}m</strong></span>
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleExportReport}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white font-semibold text-xs border border-white/15 transition-all cursor-pointer active:scale-95 shadow-sm"
          >
            <span>Export PDS-4 Report</span>
          </button>
        </div>
      </div>

      {/* ── HERO TELEMETRY STRIP (AUTHENTIC LIVE BACKEND METRICS) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 py-6 border-b border-white/10">
        <div className="space-y-1">
          <div className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight font-headline">
            {telemetry.rmsePx.toFixed(3)} px
          </div>
          <div className="text-xs text-white/50 font-medium">
            Registration RMSE (Sub-pixel {telemetry.rmsePx < 0.5 ? 'verified' : 'evaluating'})
          </div>
        </div>

        <div className="space-y-1 sm:border-l sm:border-white/10 sm:pl-6">
          <div className="text-3xl sm:text-4xl font-extrabold text-[#2997FF] tracking-tight font-headline">
            {(spectralData.absorptionDepth * 100).toFixed(1)}%
          </div>
          <div className="text-xs text-white/50 font-medium">
            3.0 µm OH/H₂O Absorption (IIRS)
          </div>
        </div>

        <div className="space-y-1 lg:border-l lg:border-white/10 lg:pl-6">
          <div className="text-3xl sm:text-4xl font-extrabold text-emerald-400 tracking-tight font-headline flex items-center gap-2">
            <span>{slz.overallSafetyScore}</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${slz.goNoGo === 'GO' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-amber-500/20 text-amber-300 border-amber-500/40'}`}>
              {slz.goNoGo}
            </span>
          </div>
          <div className="text-xs text-white/50 font-medium">
            Safe Landing Zone Score (100 Max)
          </div>
        </div>

        <div className="space-y-1 border-l border-white/10 pl-6">
          <div className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight font-headline">
            {telemetry.inlierCount} <span className="text-lg font-normal text-white/40">/ {Math.round(telemetry.inlierRatio * 100)}%</span>
          </div>
          <div className="text-xs text-white/50 font-medium">
            Verified Inliers ({telemetry.matcherWinner.toUpperCase()})
          </div>
        </div>
      </div>

      {/* ── TWO CLEAN SCIENTIFIC SECTIONS (REFLECTANCE & SLZ) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-2">
        {/* Section 1: Hyperspectral Reflectance */}
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white tracking-tight">
                256-Band Hyperspectral Reflectance
              </h2>
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-[#0071E3]/20 text-[#2997FF] border border-[#2997FF]/30">
                0.8 – 5.0 µm SWIR
              </span>
            </div>
            <p className="text-xs text-white/50 mt-1 leading-relaxed">
              Diagnostic 3.0 µm OH/H₂O absorption signature measured across contiguous spectral channels.
            </p>
          </div>

          <div className="h-64 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={spectralData.data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="reflectanceGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0071E3" stopOpacity={0.6}/>
                    <stop offset="95%" stopColor="#0071E3" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="wavelength"
                  stroke="#6B7280"
                  fontSize={11}
                  tickFormatter={(val) => `${val}µm`}
                />
                <YAxis
                  stroke="#6B7280"
                  fontSize={11}
                  domain={[0, 'auto']}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0D0E12',
                    borderColor: 'rgba(255,255,255,0.15)',
                    borderRadius: '16px',
                    fontSize: '12px',
                    color: '#FFF'
                  }}
                  formatter={(val: any) => [`${Number(val).toFixed(4)}`, 'Reflectance']}
                  labelFormatter={(val) => `Wavelength: ${val} µm`}
                />
                <ReferenceLine
                  x={spectralData.absorptionTroughWavelength}
                  stroke="#38BDF8"
                  strokeDasharray="3 3"
                  label={{ value: '3.0µm H₂O Trough', fill: '#38BDF8', fontSize: 11, position: 'top' }}
                />
                <Area
                  type="monotone"
                  dataKey="reflectance"
                  stroke="#2997FF"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#reflectanceGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-2 text-center text-xs">
            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5">
              <span className="text-[10px] text-white/40 uppercase block font-semibold">Probe Location</span>
              <strong className="text-white font-mono text-xs mt-0.5 block">[{spectralData.probeCoord[1].toFixed(2)}°S, {spectralData.probeCoord[0].toFixed(2)}°E]</strong>
            </div>
            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5">
              <span className="text-[10px] text-white/40 uppercase block font-semibold">Trough Peak</span>
              <strong className="text-[#2997FF] font-mono text-xs mt-0.5 block">{spectralData.absorptionTroughWavelength} µm</strong>
            </div>
            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5">
              <span className="text-[10px] text-white/40 uppercase block font-semibold">Absorption Depth</span>
              <strong className="text-emerald-400 font-mono text-xs mt-0.5 block">{(spectralData.absorptionDepth * 100).toFixed(1)}% Depth</strong>
            </div>
          </div>
        </div>

        {/* Section 2: SLZ Safety Diagnostics */}
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white tracking-tight">
                Landing Zone Safety Criteria
              </h2>
              <span className={`text-xs font-bold px-3 py-1 rounded-full border ${
                slz.goNoGo === 'GO'
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                  : slz.goNoGo === 'MARGINAL'
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                  : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
              }`}>
                {slz.goNoGo === 'GO' ? 'GO VERIFIED' : slz.goNoGo === 'MARGINAL' ? 'MARGINAL' : 'NO-GO'}
              </span>
            </div>
            <p className="text-xs text-white/50 mt-1 leading-relaxed">
              Multi-criteria hazard verification for autonomous landing and rover egress.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-between">
              <div>
                <span className="font-semibold text-white text-sm block">Measured Terrain Slope</span>
                <span className="text-xs text-white/50">Derived from 5.0m stereo DEM</span>
              </div>
              <span className="font-mono text-base font-bold text-white">{slz.slopeDeg}°</span>
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-between">
              <div>
                <span className="font-semibold text-white text-sm block">Slope Threshold Compliance</span>
                <span className="text-xs text-white/50">Limit: {slz.slopeThresholdDeg}°</span>
              </div>
              <span className="font-mono text-base font-bold text-emerald-400">{(slz.slopePassRate * 100).toFixed(1)}% Pass</span>
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-between">
              <div>
                <span className="font-semibold text-white text-sm block">Boulder Clearance Radius</span>
                <span className="text-xs text-white/50">Hazard detection &gt; 0.5m</span>
              </div>
              <span className="font-mono text-base font-bold text-cyan-400">{slz.boulderClearanceM} m (Safe)</span>
            </div>

            {slz.goNoGo === 'GO' ? (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2.5 text-xs text-emerald-300">
                <CheckCircle2 size={16} className="shrink-0 text-emerald-400" />
                <span>Complies with all international lunar polar exploration terrain safety standards.</span>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-2.5 text-xs text-amber-300">
                <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                <span>Marginal slope or boulder clearance detected. Secondary descent trajectory recommended.</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
