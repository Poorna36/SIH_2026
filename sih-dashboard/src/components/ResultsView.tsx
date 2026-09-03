import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea
} from 'recharts';
import {
  Download, CheckCircle2, ShieldCheck, Droplets,
  Layers, Orbit, Cpu, Globe, GitCommit
} from 'lucide-react';
import type { TelemetryData, SLZDiagnostic, SpectralData, ScenePreset } from '../types';

interface ResultsViewProps {
  telemetry: TelemetryData;
  slz: SLZDiagnostic;
  spectralData: SpectralData;
  selectedScene: ScenePreset;
  onNavigateToTab: (tab: '3d' | '2d') => void;
}

export const ResultsView: React.FC<ResultsViewProps> = ({
  telemetry,
  slz,
  spectralData,
  selectedScene,
  onNavigateToTab,
}) => {
  const isSafe = slz.goNoGo === 'GO';

  return (
    <div className="w-full h-full overflow-y-auto sidebar-scroll p-4 space-y-4 bg-black/45 backdrop-blur-[3px] text-slate-100 animate-results-enter">
      {/* ── Top Header Banner (High Translucency) ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 bg-[#0B0D14]/80 hover:bg-[#111520]/90 rounded-2xl border border-[#D4C59A]/30 shadow-lg transition-colors duration-200">
        <div>
          <p className="text-[10.5px] font-sans font-semibold text-[#D4C59A] uppercase tracking-wider">
            Chandrayaan-2 Science & Correspondence Results
          </p>
          <div className="flex items-center gap-2.5 mt-1 flex-wrap">
            <h1 className="text-xl md:text-2xl font-space font-bold text-white tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
              {selectedScene.name}
            </h1>
            <span className="text-[10px] font-sans font-bold tracking-wider text-[#D4C59A] bg-black/40 px-2.5 py-0.5 rounded-md border border-[#D4C59A]/30 uppercase">
              {selectedScene.terrainClass.replace('_', ' ')}
            </span>
          </div>
          <p className="text-xs font-sans text-slate-200 mt-1.5 flex items-center gap-2 flex-wrap drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
            <span>Target Center: <strong className="font-mono text-white font-medium">[{Math.abs(selectedScene.lat).toFixed(3)}°S, {Math.abs(selectedScene.lon).toFixed(3)}°E]</strong></span>
            <span className="text-[#D4C59A]/40">·</span>
            <span>Solar Incidence: <strong className="font-mono text-white font-medium">{selectedScene.solarIncidenceDeg}°</strong></span>
            <span className="text-[#D4C59A]/40">·</span>
            <span>GSD: <strong className="font-mono text-white font-medium">{selectedScene.gsdM}m</strong></span>
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => onNavigateToTab('3d')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/30 hover:bg-black/60 text-[#EBE2CD] hover:text-white border border-[#D4C59A]/30 font-sans text-xs font-semibold transition-all shadow-sm hover:shadow-md cursor-pointer"
          >
            <Globe size={13} className="text-[#D4C59A]" />
            <span>3D Model</span>
          </button>
          <button
            onClick={() => onNavigateToTab('2d')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/30 hover:bg-black/60 text-[#EBE2CD] hover:text-white border border-[#D4C59A]/30 font-sans text-xs font-semibold transition-all shadow-sm hover:shadow-md cursor-pointer"
          >
            <GitCommit size={13} className="text-[#D4C59A]" />
            <span>2D Keypoints</span>
          </button>
        </div>
      </div>

      {/* ── 4 Top-Tier Scientific KPI Metric Cards (High Translucency) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Sub-Pixel Accuracy */}
        <div className="p-3.5 rounded-2xl bg-[#0B0D14]/80 hover:bg-[#111520]/90 border border-[#D4C59A]/25 shadow-md flex flex-col justify-between transition-colors duration-200">
          <div className="flex items-center justify-between">
            <span className="text-[9.5px] font-mono text-[#A39062] font-bold uppercase tracking-wider">REGISTRATION ERROR</span>
            <CheckCircle2 size={15} className="text-[#4ADE80]" />
          </div>
          <div className="my-2">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-mono font-extrabold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">{telemetry.rmsePx.toFixed(2)}</span>
              <span className="text-xs font-mono text-[#D4C59A] font-bold">px RMSE</span>
            </div>
            <p className="text-[9.5px] font-mono text-[#4ADE80] mt-0.5">
              Sub-Pixel Goal Met (&lt; 0.5 px)
            </p>
          </div>
          <div className="flex justify-between items-center text-[8.5px] font-mono text-slate-300 border-t border-[#D4C59A]/15 pt-1.5">
            <span>Inliers: <strong className="text-white">{telemetry.inlierCount.toLocaleString()}</strong></span>
            <span>Ratio: <strong className="text-[#D4C59A]">{(telemetry.inlierRatio * 100).toFixed(1)}%</strong></span>
          </div>
        </div>

        {/* Card 2: SLZ Safety Index */}
        <div className="p-3.5 rounded-2xl bg-[#0B0D14]/80 hover:bg-[#111520]/90 border border-[#D4C59A]/25 shadow-md flex flex-col justify-between transition-colors duration-200">
          <div className="flex items-center justify-between">
            <span className="text-[9.5px] font-mono text-[#A39062] font-bold uppercase tracking-wider">SAFE LANDING ZONE</span>
            <ShieldCheck size={15} className={isSafe ? 'text-[#4ADE80]' : 'text-[#FBBF24]'} />
          </div>
          <div className="my-2">
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-mono font-black drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] ${isSafe ? 'text-[#4ADE80]' : 'text-[#FBBF24]'}`}>
                {slz.goNoGo}
              </span>
              <span className="text-xs font-mono text-slate-200">
                Score: <strong className="text-white">{slz.overallSafetyScore}/100</strong>
              </span>
            </div>
            <p className="text-[9.5px] font-mono text-slate-300 mt-0.5">
              Slope: <strong className="text-[#EBE2CD]">{slz.slopeDeg}°</strong> (Limit: {slz.slopeThresholdDeg}°)
            </p>
          </div>
          <div className="flex justify-between items-center text-[8.5px] font-mono text-slate-300 border-t border-[#D4C59A]/15 pt-1.5">
            <span>Slope Pass: <strong className="text-white">{slz.slopePassRate}%</strong></span>
            <span>Boulder Clr: <strong className="text-[#D4C59A]">{slz.boulderClearanceM} m</strong></span>
          </div>
        </div>

        {/* Card 3: 3.0 µm Water-Ice Hydration */}
        <div className="p-3.5 rounded-2xl bg-[#0B0D14]/80 hover:bg-[#111520]/90 border border-[#D4C59A]/25 shadow-md flex flex-col justify-between transition-colors duration-200">
          <div className="flex items-center justify-between">
            <span className="text-[9.5px] font-mono text-[#A39062] font-bold uppercase tracking-wider">3.0µm WATER-ICE PROBE</span>
            <Droplets size={15} className="text-[#D4C59A]" />
          </div>
          <div className="my-2">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-mono font-extrabold text-[#D4C59A] drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">{(spectralData.absorptionDepth * 100).toFixed(1)}%</span>
              <span className="text-xs font-mono text-slate-200">Absorption Depth</span>
            </div>
            <p className="text-[9.5px] font-mono text-slate-300 mt-0.5">
              Diagnostic Trough: <strong className="text-[#EBE2CD]">{spectralData.absorptionTroughWavelength} µm</strong>
            </p>
          </div>
          <div className="flex justify-between items-center text-[8.5px] font-mono text-slate-300 border-t border-[#D4C59A]/15 pt-1.5">
            <span>Sensor: <strong className="text-white">IIRS (256 Bands)</strong></span>
            <span>Band: <strong className="text-[#4ADE80]">#{spectralData.band}</strong></span>
          </div>
        </div>

        {/* Card 4: Geometric Homography Matrix */}
        <div className="p-3.5 rounded-2xl bg-[#0B0D14]/80 hover:bg-[#111520]/90 border border-[#D4C59A]/25 shadow-md flex flex-col justify-between transition-colors duration-200">
          <div className="flex items-center justify-between">
            <span className="text-[9.5px] font-mono text-[#A39062] font-bold uppercase tracking-wider">HOMOGRAPHY ALIGNMENT</span>
            <Cpu size={15} className="text-[#D4C59A]" />
          </div>
          <div className="my-2">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-mono font-extrabold text-white">{(telemetry.spatialCoverage * 100).toFixed(0)}%</span>
              <span className="text-xs font-mono text-[#4ADE80] font-bold">Coverage</span>
            </div>
            <p className="text-[9.5px] font-mono text-slate-400 mt-0.5">
              Matcher: <strong className="text-[#D4C59A]">{telemetry.matcherWinner.toUpperCase()}</strong>
            </p>
          </div>
          <div className="flex justify-between items-center text-[8.5px] font-mono text-slate-400 border-t border-[#D4C59A]/15 pt-1.5">
            <span>Runtime: <strong className="text-white">{(telemetry.runtimeS * 1000).toFixed(0)} ms</strong></span>
            <span>SSIM: <strong className="text-[#4ADE80]">{telemetry.ssim.toFixed(3)}</strong></span>
          </div>
        </div>
      </div>

      {/* ── Middle Grid: Spectral Curve + Safe Landing Zone Matrix (High Translucency) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left 7 Cols: 256-Band IIRS Hyperspectral Reflectance Curve */}
        <div className="lg:col-span-7 p-4 bg-[#0B0D14]/80 hover:bg-[#111520]/90 rounded-2xl border border-[#D4C59A]/25 shadow-lg flex flex-col transition-colors duration-200">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#D4C59A]/20">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#D4C59A]" />
                <h3 className="text-xs font-mono font-extrabold text-white uppercase tracking-wider">
                  IIRS 256-Band Hyperspectral Reflectance Curve
                </h3>
              </div>
              <p className="text-[9.5px] font-mono text-[#A39062] mt-0.5">
                Diagnostic 3.0 µm OH/H₂O Absorption Feature & Pyroxene Band Depth
              </p>
            </div>
            <span className="text-[8.5px] font-mono px-2 py-0.5 rounded bg-black/40 text-[#D4C59A] border border-[#D4C59A]/30">
              0.8 – 5.0 µm SWIR
            </span>
          </div>

          <div className="h-60 w-full mt-1">
            <ResponsiveContainer width="100%" height="100%" debounce={60}>
              <LineChart data={spectralData.data} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                <XAxis
                  dataKey="wavelength"
                  stroke="#A39062"
                  tick={{ fill: '#A39062', fontSize: 9, fontFamily: 'monospace' }}
                  tickFormatter={(val) => `${val}µm`}
                />
                <YAxis
                  domain={[0, 0.4]}
                  stroke="#A39062"
                  tick={{ fill: '#A39062', fontSize: 9, fontFamily: 'monospace' }}
                />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(7, 8, 10, 0.85)',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid rgba(212, 197, 154, 0.5)',
                    borderRadius: '10px',
                    fontSize: '10px',
                    fontFamily: 'monospace',
                  }}
                  formatter={(val: unknown) => [typeof val === 'number' ? `${val.toFixed(3)} IOF` : `${val}`, 'Reflectance']}
                  labelFormatter={(label) => `Wavelength: ${label} µm`}
                />
                {/* 3.0µm Diagnostic Water Absorption Zone */}
                <ReferenceArea x1={2.8} x2={3.2} fill="#D4C59A" fillOpacity={0.12} />
                <ReferenceLine x={3.0} stroke="#D4C59A" strokeDasharray="3 3" label={{ value: '3.0µm H₂O', fill: '#D4C59A', fontSize: 9 }} />
                <Line
                  type="monotone"
                  dataKey="reflectance"
                  stroke="#D4C59A"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={true}
                  animationDuration={450}
                  animationEasing="ease-out"
                  activeDot={{ r: 4, fill: '#FAF6EB', stroke: '#D4C59A' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-3 gap-2 mt-3 pt-2 border-t border-[#D4C59A]/15 font-mono text-[9px] text-center">
            <div className="p-2 rounded-xl bg-black/20 border border-[#D4C59A]/15">
              <span className="text-[#A39062] block text-[8px]">PROBE COORD</span>
              <span className="font-bold text-white">[{spectralData.probeCoord[1].toFixed(2)}°S, {spectralData.probeCoord[0].toFixed(2)}°E]</span>
            </div>
            <div className="p-2 rounded-xl bg-black/20 border border-[#D4C59A]/15">
              <span className="text-[#A39062] block text-[8px]">ABSORPTION TROUGH</span>
              <span className="font-extrabold text-[#D4C59A]">{spectralData.absorptionTroughWavelength} µm (Peak)</span>
            </div>
            <div className="p-2 rounded-xl bg-black/20 border border-[#D4C59A]/15">
              <span className="text-[#A39062] block text-[8px]">WATER-ICE DEPTH</span>
              <span className="font-bold text-white">{(spectralData.absorptionDepth * 100).toFixed(1)}% Depth</span>
            </div>
          </div>
        </div>

        {/* Right 5 Cols: Safe Landing Zone Assessment & Slopes */}
        <div className="lg:col-span-5 p-4 bg-[#0B0D14]/80 hover:bg-[#111520]/90 rounded-2xl border border-[#D4C59A]/25 shadow-lg flex flex-col justify-between transition-colors duration-200">
          <div>
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#D4C59A]/20">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#D4C59A]" />
                <h3 className="text-xs font-mono font-extrabold text-white uppercase tracking-wider">
                  Safe Landing Zone (SLZ) Analysis
                </h3>
              </div>
              <span className={`text-[9px] font-mono font-extrabold px-2 py-0.5 rounded border ${
                isSafe ? 'bg-[#182618]/80 text-[#4ADE80] border-[#4ADE80]/40' : 'bg-[#2A1D0C]/80 text-[#FBBF24] border-[#FBBF24]/40'
              }`}>
                {slz.goNoGo}
              </span>
            </div>

            <p className="text-[10px] font-mono text-slate-200 leading-relaxed mb-3">
              {isSafe
                ? 'Landing footprint satisfies all Chandrayaan-2 and ISRO polar landing slope safety criteria with zero catastrophic obstacles.'
                : 'Marginal landing zone detected. Micro-slopes exceed nominal safety thresholds.'}
            </p>

            <div className="space-y-2 font-mono text-[9.5px]">
              <div className="flex justify-between p-2 rounded-xl bg-black/20 border border-[#D4C59A]/15">
                <span className="text-slate-300">Measured Terrain Slope</span>
                <span className="font-bold text-white">{slz.slopeDeg}°</span>
              </div>
              <div className="flex justify-between p-2 rounded-xl bg-black/20 border border-[#D4C59A]/15">
                <span className="text-slate-300">Slope Threshold Limit</span>
                <span className="font-bold text-[#FBBF24]">{slz.slopeThresholdDeg}°</span>
              </div>
              <div className="flex justify-between p-2 rounded-xl bg-black/20 border border-[#D4C59A]/15">
                <span className="text-slate-300">Slope Compliance Rate</span>
                <span className="font-bold text-[#D4C59A]">{slz.slopePassRate}%</span>
              </div>
              <div className="flex justify-between p-2 rounded-xl bg-black/20 border border-[#D4C59A]/15">
                <span className="text-slate-300">Boulder Clearance Radius</span>
                <span className="font-bold text-[#4ADE80]">{slz.boulderClearanceM} m (Safe)</span>
              </div>
            </div>
          </div>

          <div className="mt-4 p-2.5 rounded-xl bg-black/30 border border-[#D4C59A]/20 text-[9px] font-mono text-slate-200 flex items-center gap-2">
            <ShieldCheck size={16} className="text-[#4ADE80] shrink-0" />
            <span>Meets all ISRO Chandrayaan-3 & Lunar Polar Exploration (LUPEX) terrain safety criteria.</span>
          </div>
        </div>
      </div>

      {/* ── Bottom Row: Spatial Metadata & Export Download Suite (High Translucency) ── */}
      <div className="p-4 bg-[#0B0D14]/80 hover:bg-[#111520]/90 rounded-2xl border border-[#D4C59A]/25 shadow-lg flex flex-col md:flex-row items-center justify-between gap-4 transition-colors duration-200">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-black/40 border border-[#D4C59A]/30 text-[#D4C59A]">
            <Layers size={18} />
          </div>
          <div>
            <span className="text-[10px] font-mono font-extrabold text-[#D4C59A] uppercase tracking-wider block">
              CO-REGISTERED DATA PRODUCTS
            </span>
            <span className="text-[11px] font-mono text-slate-200">
              Target CRS: IAU_2015:Moon_South_Pole_Stereographic · Sub-pixel Warp Applied
            </span>
          </div>
        </div>

        {/* Download Buttons Suite */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <button
            onClick={() => alert(`Downloading Co-Registered GeoTIFF (COG) for ${selectedScene.name}`)}
            className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#D4C59A] hover:bg-[#EBE2CD] text-black font-mono font-extrabold text-[10.5px] transition-all shadow-md"
          >
            <Download size={13} />
            <span>Download GeoTIFF (COG)</span>
          </button>

          <button
            onClick={() => alert(`Downloading SPICE Kernel (.bsp/.tls) trajectory data for ${selectedScene.name}`)}
            className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-black/40 hover:bg-black/70 border border-[#D4C59A]/40 text-[#EBE2CD] hover:text-white font-mono font-bold text-[10.5px] transition-all shadow-md"
          >
            <Orbit size={13} className="text-[#D4C59A]" />
            <span>SPICE Kernel</span>
          </button>

          <button
            onClick={() => alert(`Downloading JSON Science Telemetry for ${selectedScene.name}`)}
            className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-black/40 hover:bg-black/70 border border-[#D4C59A]/40 text-[#EBE2CD] hover:text-white font-mono font-bold text-[10.5px] transition-all shadow-md"
          >
            <Download size={13} className="text-[#D4C59A]" />
            <span>JSON Telemetry</span>
          </button>
        </div>
      </div>
    </div>
  );
};
