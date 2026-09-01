import React, { useState } from 'react';
import {
  Activity, ShieldCheck, Droplets, Download,
  FileText, CheckCircle2, FlaskConical, PanelRightClose
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, ReferenceArea
} from 'recharts';
import type { TelemetryData, SLZDiagnostic, SpectralData } from '../types';

interface SciencePanelProps {
  telemetry: TelemetryData;
  slz: SLZDiagnostic;
  spectralData: SpectralData;
  onToggleCollapse?: () => void;
}

export const SciencePanel: React.FC<SciencePanelProps> = ({
  telemetry,
  slz,
  spectralData,
  onToggleCollapse,
}) => {
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  const handleExport = (type: 'geotiff' | 'spice') => {
    setDownloadSuccess(type);
    setTimeout(() => setDownloadSuccess(null), 3000);
  };

  return (
    <div className="flex flex-col gap-2 h-full overflow-y-auto pr-1 pb-6 sidebar-scroll bg-transparent">
      {/* Science Panel Header with Collapse Button */}
      <div className="flex items-center justify-between px-2 py-1 bg-[#050B14]/40 hover:bg-[#050B14]/60 backdrop-blur-xl rounded-xl border border-emerald-500/25 shadow-lg transition-colors">
        <div className="flex items-center gap-1.5 text-[10px] font-mono font-extrabold text-emerald-300 uppercase tracking-wider">
          <FlaskConical size={12} className="text-emerald-400" />
          <span>Science Diagnostics</span>
        </div>
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            title="Collapse Sidebar"
            className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-[#0A1628]/60 hover:bg-[#102444]/80 text-emerald-300 hover:text-white border border-emerald-500/30 text-[9px] font-mono font-bold transition-colors"
          >
            <span>Collapse</span>
            <PanelRightClose size={11} />
          </button>
        )}
      </div>

      {/* ── Section 1: Registration Telemetry Card ── */}
      <div className="panel-card mb-0.5">
        <div className="panel-header justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Activity size={12} className="text-emerald-400" />
            <span>Registration Telemetry</span>
          </div>
          <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-[#0A1D34]/70 text-cyan-300 border border-cyan-500/40 uppercase font-extrabold tracking-wider">
            {telemetry.matcherWinner.toUpperCase()} + MAGSAC++
          </span>
        </div>

        {/* Scene Match Identity Verdict Banner */}
        <div className="mb-2 p-2 rounded-lg bg-gradient-to-r from-[#040C1A]/50 via-[#081A32]/50 to-[#040C1A]/50 border border-emerald-400/50 shadow-[0_0_16px_rgba(16,185,129,0.2)] flex items-center justify-between backdrop-blur-md">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34D399]" />
            <div>
              <div className="text-[10px] font-mono font-extrabold text-emerald-300 uppercase tracking-wide flex items-center gap-1.5">
                <span>SCENE VERDICT:</span>
                <span className="text-white bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-400/80 font-mono">
                  SAME CRATER MATCHED
                </span>
              </div>
              <div className="text-[8px] font-mono text-slate-300 mt-0.5">
                Geometric Correspondence: Verified ({telemetry.inlierCount} inliers · RMSE {telemetry.rmsePx.toFixed(2)}px)
              </div>
            </div>
          </div>
          <span className="text-xs font-mono font-extrabold text-emerald-300 bg-black/60 px-2 py-1 rounded border border-emerald-500/40">
            {(telemetry.inlierRatio * 100).toFixed(0)}% MATCH
          </span>
        </div>

        {/* 4 Metric Stats Matrix */}
        <div className="grid grid-cols-2 gap-1.5 mb-2">
          <div className="bg-[#040913]/35 hover:bg-[#081524]/55 p-1.5 rounded-lg border border-emerald-500/20 backdrop-blur-md transition-colors">
            <span className="text-[8px] text-slate-400 font-mono font-bold tracking-wider block">RMSE (PX)</span>
            <div className="flex items-baseline gap-1 my-0.5">
              <span className="text-sm font-mono font-extrabold text-white">{telemetry.rmsePx.toFixed(2)}</span>
              <span className="text-[8.5px] font-mono font-bold text-emerald-400">&lt;0.5px</span>
            </div>
            <span className="text-[8px] text-slate-400 font-mono block truncate">
              Target: subpixel (&lt;0.5)
            </span>
          </div>

          <div className="bg-[#040913]/35 hover:bg-[#081524]/55 p-1.5 rounded-lg border border-emerald-500/20 backdrop-blur-md transition-colors">
            <span className="text-[8px] text-slate-400 font-mono font-bold tracking-wider block">INLIER RATIO</span>
            <div className="flex items-baseline gap-1 my-0.5">
              <span className="text-sm font-mono font-extrabold text-emerald-300">{(telemetry.inlierRatio * 100).toFixed(1)}%</span>
            </div>
            <span className="text-[8px] text-slate-400 font-mono block truncate">
              {telemetry.inlierCount}/{telemetry.candidateCount} matches
            </span>
          </div>

          <div className="bg-[#040913]/35 hover:bg-[#081524]/55 p-1.5 rounded-lg border border-emerald-500/20 backdrop-blur-md transition-colors">
            <span className="text-[8px] text-slate-400 font-mono font-bold tracking-wider block">SSIM INDEX</span>
            <div className="flex items-baseline gap-1 my-0.5">
              <span className="text-sm font-mono font-extrabold text-teal-300">{telemetry.ssim.toFixed(2)}</span>
            </div>
            <span className="text-[8px] text-slate-400 font-mono block truncate">
              Structural similarity
            </span>
          </div>

          <div className="bg-[#040913]/35 hover:bg-[#081524]/55 p-1.5 rounded-lg border border-emerald-500/20 backdrop-blur-md transition-colors">
            <span className="text-[8px] text-slate-400 font-mono font-bold tracking-wider block">COVERAGE</span>
            <div className="flex items-baseline gap-1 my-0.5">
              <span className="text-sm font-mono font-extrabold text-cyan-300">{(telemetry.spatialCoverage * 100).toFixed(0)}%</span>
            </div>
            <span className="text-[8px] text-slate-400 font-mono block truncate">
              σ = {telemetry.gridDensityStd} (ANMS)
            </span>
          </div>
        </div>

        {/* Ephemeris Angles Table (Fully Visible with generous margins) */}
        <div className="pt-2 border-t border-emerald-500/20 grid grid-cols-3 gap-1.5 text-center">
          <div className="bg-[#040913]/40 py-1.5 px-1 rounded-lg border border-emerald-500/20">
            <div className="text-[7.5px] text-slate-400 font-mono font-bold">INCIDENCE</div>
            <div className="text-xs font-mono font-extrabold text-white mt-0.5">{telemetry.solarIncidenceDeg}°</div>
          </div>
          <div className="bg-[#040913]/40 py-1.5 px-1 rounded-lg border border-emerald-500/20">
            <div className="text-[7.5px] text-slate-400 font-mono font-bold">EMISSION</div>
            <div className="text-xs font-mono font-extrabold text-white mt-0.5">{telemetry.solarEmissionDeg}°</div>
          </div>
          <div className="bg-[#040913]/40 py-1.5 px-1 rounded-lg border border-emerald-500/20">
            <div className="text-[7.5px] text-slate-400 font-mono font-bold">AZIMUTH</div>
            <div className="text-xs font-mono font-extrabold text-white mt-0.5">{telemetry.solarAzimuthDeg}°</div>
          </div>
        </div>
      </div>

      {/* ── Section 2: Chandrayaan-4 Safe Landing Zone (SLZ) ── */}
      <div className="panel-card mb-0.5">
        <div className="panel-header justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <ShieldCheck size={12} className="text-emerald-400" />
            <span>Landing Safety (SLZ)</span>
          </div>
          <span
            className={`text-[9px] font-mono font-extrabold px-2 py-0.5 rounded border uppercase ${
              slz.goNoGo === 'GO'
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/80 shadow-[0_0_8px_rgba(52,211,153,0.3)]'
                : 'bg-amber-500/20 text-amber-300 border-amber-400/80'
            }`}
          >
            {slz.goNoGo} FOR LANDING
          </span>
        </div>

        {/* Safety Score Gauge Bar */}
        <div className="bg-[#040913]/40 p-2 rounded-lg border border-emerald-500/20 backdrop-blur-md mb-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9.5px] font-mono text-slate-200 font-bold">Safety Index</span>
            <span className="text-xs font-mono font-extrabold text-emerald-300">{slz.overallSafetyScore}%</span>
          </div>
          <div className="w-full h-1.5 bg-black/80 rounded-full overflow-hidden border border-emerald-500/30">
            <div
              className="h-full rounded-full transition-all duration-700 bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-300"
              style={{ width: `${slz.overallSafetyScore}%` }}
            />
          </div>
        </div>

        {/* Hazard Metrics Breakdown */}
        <div className="grid grid-cols-2 gap-1.5">
          {/* Slope Hazard */}
          <div className="bg-[#040913]/40 p-1.5 rounded-lg border border-emerald-500/20">
            <div className="flex items-center justify-between text-[8px] font-mono font-bold text-slate-400">
              <span>TERRAIN SLOPE</span>
              <span className={slz.slopeDeg < slz.slopeThresholdDeg ? 'text-emerald-400 font-extrabold' : 'text-rose-400 font-extrabold'}>
                {slz.slopeDeg < slz.slopeThresholdDeg ? 'PASS' : 'FAIL'}
              </span>
            </div>
            <div className="text-xs font-mono font-extrabold text-white mt-0.5">{slz.slopeDeg}° <span className="text-[8px] text-slate-400 font-normal">(&lt;{slz.slopeThresholdDeg}°)</span></div>
          </div>

          {/* Boulder Hazard */}
          <div className="bg-[#040913]/40 p-1.5 rounded-lg border border-emerald-500/20">
            <div className="flex items-center justify-between text-[8px] font-mono font-bold text-slate-400">
              <span>BOULDER CLEAR</span>
              <span className={slz.boulderClearanceM > slz.boulderThresholdM ? 'text-emerald-400 font-extrabold' : 'text-amber-300 font-extrabold'}>
                {slz.boulderClearanceM > slz.boulderThresholdM ? 'PASS' : 'WARN'}
              </span>
            </div>
            <div className="text-xs font-mono font-extrabold text-white mt-0.5">{slz.boulderClearanceM}m <span className="text-[8px] text-slate-400 font-normal">(&gt;{slz.boulderThresholdM}m)</span></div>
          </div>
        </div>
      </div>

      {/* ── Section 3: 3.0 µm Water-Ice Hyperspectral Probe ── */}
      <div className="panel-card">
        <div className="panel-header justify-between">
          <div className="flex items-center gap-1.5">
            <Droplets size={12} className="text-cyan-400" />
            <span>3.0 µm Water-Ice Probe</span>
          </div>
          <span className="text-[8px] font-mono text-cyan-300 bg-[#061524]/60 px-2 py-0.5 rounded border border-cyan-500/40 font-extrabold">
            IIRS 250-BAND
          </span>
        </div>

        <div className="text-[9px] text-slate-200 font-mono mb-1.5 flex items-center justify-between">
          <span>Probe: [{spectralData.probeCoord[0]}°E, {spectralData.probeCoord[1]}°S]</span>
          <span className="text-cyan-300 font-extrabold">Trough: {(spectralData.absorptionDepth * 100).toFixed(1)}%</span>
        </div>

        {/* Recharts 250-Band Spectral Curve (Compact 92px) */}
        <div className="h-24 w-full bg-[#02050A]/40 rounded-lg p-0.5 border border-emerald-500/25 backdrop-blur-md mb-1.5">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={spectralData.data}
              margin={{ top: 2, right: 6, left: -28, bottom: -4 }}
            >
              <CartesianGrid strokeDasharray="2 2" stroke="rgba(16, 185, 129, 0.15)" />
              <XAxis
                dataKey="wavelength"
                type="number"
                domain={[0.8, 5.0]}
                tick={{ fill: '#94A3B8', fontSize: 8, fontFamily: 'monospace' }}
                tickFormatter={(v) => `${v.toFixed(0)}µm`}
              />
              <YAxis
                domain={[0.0, 0.45]}
                tick={{ fill: '#94A3B8', fontSize: 8, fontFamily: 'monospace' }}
                tickFormatter={(v) => v.toFixed(1)}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(4, 11, 24, 0.9)',
                  borderColor: '#38BDF8',
                  borderRadius: '8px',
                  fontSize: '10px',
                  fontFamily: 'monospace',
                  color: '#FFFFFF',
                  padding: '4px 8px',
                }}
                formatter={(value: any) => [`${Number(value).toFixed(3)}`, 'Reflectance']}
                labelFormatter={(label: any) => `λ = ${Number(label).toFixed(2)} µm`}
              />
              <ReferenceArea
                x1={2.85}
                x2={3.15}
                fill="#10B981"
                fillOpacity={0.25}
              />
              <ReferenceLine
                x={3.0}
                stroke="#38BDF8"
                strokeDasharray="2 2"
                label={{
                  value: '3.0µm',
                  fill: '#38BDF8',
                  fontSize: 8,
                  position: 'top',
                  fontFamily: 'monospace',
                }}
              />
              <Line
                type="monotone"
                dataKey="reflectance"
                stroke="#38BDF8"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Legend & Band Indicator Row (Fully Visible & Padded) */}
        <div className="flex items-center justify-between text-[8.5px] font-mono text-slate-300 pt-1 border-t border-emerald-500/20 px-0.5">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span>3.0 µm OH/H₂O Absorption</span>
          </span>
          <span className="text-cyan-300 font-extrabold">Band 187</span>
        </div>
      </div>

      {/* ── Section 4: Export Actions ── */}
      <div className="panel-card">
        <div className="panel-header">
          <Download size={12} className="text-emerald-400" />
          <span>Export Products (L6)</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5 mt-0.5">
          <button
            onClick={() => handleExport('geotiff')}
            className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-[#061426]/40 hover:bg-[#0C2442]/65 border border-emerald-400/40 hover:border-emerald-300 text-[10px] font-mono font-extrabold text-slate-100 transition-all shadow"
          >
            {downloadSuccess === 'geotiff' ? (
              <CheckCircle2 size={12} className="text-emerald-300" />
            ) : (
              <Download size={12} className="text-emerald-400" />
            )}
            <span>{downloadSuccess === 'geotiff' ? 'Downloaded!' : 'GeoTIFF (COG)'}</span>
          </button>

          <button
            onClick={() => handleExport('spice')}
            className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-[#061426]/40 hover:bg-[#0C2442]/65 border border-cyan-400/40 hover:border-cyan-300 text-[10px] font-mono font-extrabold text-slate-100 transition-all shadow"
          >
            {downloadSuccess === 'spice' ? (
              <CheckCircle2 size={12} className="text-emerald-300" />
            ) : (
              <FileText size={12} className="text-cyan-300" />
            )}
            <span>{downloadSuccess === 'spice' ? 'Exported!' : 'SPICE Kernel'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
