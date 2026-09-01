import React, { useState, useRef, useEffect } from 'react';
import { Layers, CheckCircle, AlertTriangle, Crosshair, Grid3X3, Eye, MoveHorizontal, Activity } from 'lucide-react';
import type { KeypointMatch } from '../types';
import { KEYPOINT_MATCHES } from '../data/mockData';

interface KeypointViewerProps {
  onProbeCoord?: (x: number, y: number) => void;
}

export const KeypointViewer: React.FC<KeypointViewerProps> = ({ onProbeCoord }) => {
  const [sliderPos, setSliderPos] = useState<number>(50); // percentage (0 - 100)
  const [showInliers, setShowInliers] = useState<boolean>(true);
  const [showOutliers, setShowOutliers] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<'side-by-side' | 'split' | 'checkerboard' | 'residuals'>('side-by-side');
  const [hoveredMatch] = useState<KeypointMatch | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isDragging = useRef<boolean>(false);

  const inlierCount = KEYPOINT_MATCHES.filter((m) => m.isInlier).length;
  const outlierCount = KEYPOINT_MATCHES.filter((m) => !m.isInlier).length;

  // Handle drag for swipe slider
  const handleMouseDown = () => {
    isDragging.current = true;
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging.current && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      setSliderPos((x / rect.width) * 100);
    }
  };

  // Draw keypoints, correspondence curves, and residual vectors on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.parentElement?.clientWidth || 800;
    const height = canvas.parentElement?.clientHeight || 450;
    canvas.width = width;
    canvas.height = height;

    ctx.clearRect(0, 0, width, height);

    if (viewMode === 'side-by-side') {
      const paneWidth = width / 2;
      const paneHeight = height;

      const scaleX1 = (paneWidth - 20) / 512;
      const scaleY1 = (paneHeight - 40) / 512;
      const scaleX2 = (paneWidth - 20) / 512;
      const scaleY2 = (paneHeight - 40) / 512;

      const offsetX1 = 10;
      const offsetY1 = 20;
      const offsetX2 = paneWidth + 10;
      const offsetY2 = 20;

      KEYPOINT_MATCHES.forEach((match) => {
        if (match.isInlier && !showInliers) return;
        if (!match.isInlier && !showOutliers) return;

        const x1 = offsetX1 + match.srcXy[0] * scaleX1;
        const y1 = offsetY1 + match.srcXy[1] * scaleY1;
        const x2 = offsetX2 + match.refXy[0] * scaleX2;
        const y2 = offsetY2 + match.refXy[1] * scaleY2;

        const isHovered = hoveredMatch?.id === match.id;

        // Connecting Bezier curves
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        const cpX1 = x1 + (x2 - x1) * 0.4;
        const cpY1 = y1 - 20;
        const cpX2 = x1 + (x2 - x1) * 0.6;
        const cpY2 = y2 - 20;
        ctx.bezierCurveTo(cpX1, cpY1, cpX2, cpY2, x2, y2);

        if (match.isInlier) {
          ctx.strokeStyle = isHovered ? '#FFFFFF' : 'rgba(52, 211, 153, 0.9)';
          ctx.lineWidth = isHovered ? 2.5 : 1.5;
          ctx.setLineDash([]);
        } else {
          ctx.strokeStyle = isHovered ? '#FCA5A5' : 'rgba(239, 68, 68, 0.6)';
          ctx.lineWidth = 1.2;
          ctx.setLineDash([4, 4]);
        }
        ctx.stroke();

        // Source keypoint circle
        ctx.beginPath();
        ctx.arc(x1, y1, isHovered ? 5.5 : 4, 0, 2 * Math.PI);
        ctx.fillStyle = match.isInlier ? '#34D399' : '#EF4444';
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Reference keypoint circle
        ctx.beginPath();
        ctx.arc(x2, y2, isHovered ? 5.5 : 4, 0, 2 * Math.PI);
        ctx.fillStyle = match.isInlier ? '#38BDF8' : '#EF4444';
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });
    } else if (viewMode === 'residuals') {
      // F21 Residual Error Vector Heatmap Mode
      const scaleX = width / 512;
      const scaleY = height / 512;

      KEYPOINT_MATCHES.forEach((match) => {
        if (match.isInlier && !showInliers) return;
        if (!match.isInlier && !showOutliers) return;

        const x = match.srcXy[0] * scaleX;
        const y = match.srcXy[1] * scaleY;
        const dx = (match.refXy[0] - match.srcXy[0]) * scaleX * 2.5; // magnified for clear QC visualization
        const dy = (match.refXy[1] - match.srcXy[1]) * scaleY * 2.5;
        const errPx = Math.sqrt((match.refXy[0] - match.srcXy[0])**2 + (match.refXy[1] - match.srcXy[1])**2);

        // Color coding per F21 spec: green < 0.5px, yellow 0.5-1.0px, red > 1.0px
        let color = '#34D399';
        if (errPx > 1.0 || !match.isInlier) color = '#EF4444';
        else if (errPx > 0.5) color = '#FBBF24';

        // Draw residual error vector arrow
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + dx, y + dy);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.0;
        ctx.setLineDash([]);
        ctx.stroke();

        // Arrow tip circle
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      });
    } else if (viewMode === 'split') {
      const scaleX = width / 512;
      const scaleY = height / 512;

      KEYPOINT_MATCHES.forEach((match) => {
        if (match.isInlier && !showInliers) return;
        if (!match.isInlier && !showOutliers) return;

        const x1 = match.srcXy[0] * scaleX;
        const y1 = match.srcXy[1] * scaleY;

        ctx.beginPath();
        ctx.arc(x1, y1, 4, 0, 2 * Math.PI);
        ctx.fillStyle = match.isInlier ? '#34D399' : '#EF4444';
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      });
    }
  }, [viewMode, showInliers, showOutliers, hoveredMatch]);

  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || !onProbeCoord) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 512;
    const y = ((e.clientY - rect.top) / rect.height) * 512;
    onProbeCoord(parseFloat(x.toFixed(1)), parseFloat(y.toFixed(1)));
  };

  return (
    <div className="flex flex-col h-full bg-[#020408] rounded-xl overflow-hidden border border-emerald-500/25 shadow-2xl">
      {/* Top QC Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-emerald-500/20 bg-[#050B14]/95 backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <Layers size={13} className="text-emerald-400" />
            <span className="text-[11px] font-mono font-extrabold text-slate-100">2D Co-Registration & Quality Control</span>
          </div>

          <div className="flex items-center gap-1.5 border-l border-emerald-500/30 pl-2.5">
            <button
              onClick={() => setShowInliers(!showInliers)}
              className={`flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[9px] font-mono font-extrabold border transition-all ${
                showInliers ? 'bg-emerald-500/25 text-emerald-300 border-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.3)]' : 'bg-[#040913]/70 text-slate-400 border-emerald-500/20'
              }`}
            >
              <CheckCircle size={10} />
              <span>Inliers ({inlierCount})</span>
            </button>

            <button
              onClick={() => setShowOutliers(!showOutliers)}
              className={`flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[9px] font-mono font-extrabold border transition-all ${
                showOutliers ? 'bg-rose-950/90 text-rose-300 border-rose-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]' : 'bg-[#040913]/70 text-slate-400 border-emerald-500/20'
              }`}
            >
              <AlertTriangle size={10} />
              <span>Outliers ({outlierCount})</span>
            </button>
          </div>

          {/* Scene Identity Match Pill */}
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/90 border border-emerald-400/60 shadow-[0_0_10px_rgba(52,211,153,0.2)]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[9px] font-mono font-extrabold text-emerald-300">
              VERDICT: SAME CRATER VERIFIED (92.4% Match)
            </span>
          </div>
        </div>

        {/* 4 Multi-Modal QC View Modes (F21 spec) */}
        <div className="flex items-center gap-0.5 bg-[#02050A]/90 p-0.5 rounded-lg border border-emerald-500/25">
          <button
            onClick={() => setViewMode('side-by-side')}
            title="Dual-Pane Side-by-Side Inlier Match Graph"
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[9.5px] font-mono font-extrabold transition-all ${
              viewMode === 'side-by-side' ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-black shadow-md' : 'text-slate-300 hover:text-white'
            }`}
          >
            <Eye size={11} />
            <span>Side-by-Side</span>
          </button>

          <button
            onClick={() => setViewMode('split')}
            title="Swipe Comparison Wipe Slider"
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[9.5px] font-mono font-extrabold transition-all ${
              viewMode === 'split' ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-black shadow-md' : 'text-slate-300 hover:text-white'
            }`}
          >
            <MoveHorizontal size={11} />
            <span>Swipe Slider</span>
          </button>

          <button
            onClick={() => setViewMode('checkerboard')}
            title="F21: 64px Checkerboard Interleaving QC Alignment"
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[9.5px] font-mono font-extrabold transition-all ${
              viewMode === 'checkerboard' ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-black shadow-md' : 'text-slate-300 hover:text-white'
            }`}
          >
            <Grid3X3 size={11} />
            <span>Checkerboard (F21)</span>
          </button>

          <button
            onClick={() => setViewMode('residuals')}
            title="F21: Residual Error Vectors & Colormap Heatmap"
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[9.5px] font-mono font-extrabold transition-all ${
              viewMode === 'residuals' ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-black shadow-md' : 'text-slate-300 hover:text-white'
            }`}
          >
            <Activity size={11} />
            <span>Residuals (F21)</span>
          </button>
        </div>
      </div>

      {/* Main Visual Display */}
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleContainerClick}
        className="relative flex-1 bg-black overflow-hidden cursor-crosshair select-none"
      >
        {viewMode === 'side-by-side' && (
          <div className="grid grid-cols-2 h-full w-full gap-2 p-2 relative">
            {/* Left: OHRC (0.3m) */}
            <div className="relative rounded-xl overflow-hidden border border-emerald-500/25 bg-black shadow-2xl">
              <img
                src="/assets/ohrc.jpg"
                alt="ISRO OHRC Source"
                className="w-full h-full object-cover contrast-125 brightness-105"
              />
              <div className="absolute top-2 left-2 px-2.5 py-1 rounded-lg bg-[#030E08]/85 backdrop-blur-xl border border-emerald-400/60 shadow-lg">
                <span className="text-[9px] font-mono text-emerald-300 font-extrabold">SOURCE: CH-2 OHRC (0.3m)</span>
              </div>
              <div className="absolute bottom-2 left-2 text-[9px] font-mono text-white font-bold bg-black/80 px-2 py-0.5 rounded border border-emerald-500/30">
                2048 x 512 px · Inc: 68.2°
              </div>
            </div>

            {/* Right: Warped IIRS / Reference */}
            <div className="relative rounded-xl overflow-hidden border border-emerald-500/25 bg-black shadow-2xl">
              <img
                src="/assets/iirs.jpg"
                alt="ISRO IIRS Warped"
                className="w-full h-full object-cover brightness-110 contrast-110"
              />
              <div className="absolute top-2 left-2 px-2.5 py-1 rounded-lg bg-[#040913]/90 backdrop-blur-xl border border-cyan-400/60 shadow-lg">
                <span className="text-[9px] font-mono text-cyan-300 font-extrabold">WARPED: CH-2 IIRS (3.0µm)</span>
              </div>
              <div className="absolute bottom-2 left-2 text-[9px] font-mono text-white font-bold bg-black/80 px-2 py-0.5 rounded border border-emerald-500/30">
                250 Bands · Resampled 80m → 0.3m
              </div>
            </div>
          </div>
        )}

        {viewMode === 'split' && (
          /* Split / Swipe Slider Mode */
          <div className="relative w-full h-full">
            <img
              src="/assets/iirs.jpg"
              alt="Reference Layer"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute top-2 right-2 px-2.5 py-1 rounded-lg bg-[#040913]/90 border border-cyan-400/60 shadow-lg">
              <span className="text-[9px] font-mono text-cyan-300 font-extrabold">WARPED IIRS (3.0µm)</span>
            </div>

            {/* Clipped top layer: OHRC */}
            <div
              className="absolute inset-0 overflow-hidden"
              style={{ width: `${sliderPos}%` }}
            >
              <img
                src="/assets/ohrc.jpg"
                alt="Source OHRC"
                className="absolute top-0 left-0 h-full object-cover contrast-125"
                style={{ width: containerRef.current?.clientWidth || '100%', maxWidth: 'none' }}
              />
              <div className="absolute top-2 left-2 px-2.5 py-1 rounded-lg bg-[#040913]/90 border border-emerald-400/60 shadow-lg">
                <span className="text-[9px] font-mono text-emerald-300 font-extrabold">SOURCE OHRC (0.3m)</span>
              </div>
            </div>

            {/* Slider Divider Line & Thumb */}
            <div
              onMouseDown={handleMouseDown}
              className="absolute top-0 bottom-0 w-1 bg-gradient-to-b from-emerald-400 via-white to-cyan-400 cursor-ew-resize shadow-[0_0_15px_#38BDF8]"
              style={{ left: `${sliderPos}%` }}
            >
              <div className="absolute top-1/2 -translate-y-1/2 -left-3.5 w-7 h-7 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 border-2 border-white flex items-center justify-center shadow-lg text-black text-xs font-extrabold">
                ↔
              </div>
            </div>
          </div>
        )}

        {viewMode === 'checkerboard' && (
          /* F21: 64px Checkerboard Interleaving Mode */
          <div className="relative w-full h-full bg-black">
            {/* Background Warped IIRS */}
            <img
              src="/assets/iirs.jpg"
              alt="IIRS Warped Base"
              className="absolute inset-0 w-full h-full object-cover"
            />
            {/* Foreground OHRC with 64px CSS Checkerboard Mask */}
            <img
              src="/assets/ohrc.jpg"
              alt="OHRC Checkerboard"
              className="absolute inset-0 w-full h-full object-cover contrast-125"
              style={{
                maskImage: 'conic-gradient(#000 90deg, transparent 90deg 180deg, #000 180deg 270deg, transparent 270deg)',
                WebkitMaskImage: 'conic-gradient(#000 90deg, transparent 90deg 180deg, #000 180deg 270deg, transparent 270deg)',
                maskSize: '64px 64px',
                WebkitMaskSize: '64px 64px',
              }}
            />
            <div className="absolute top-2 left-2 px-2.5 py-1 rounded-lg bg-[#040913]/90 border border-emerald-400/60 shadow-lg">
              <span className="text-[9px] font-mono text-emerald-300 font-extrabold">F21 CHECKERBOARD (64px Alternating OHRC / IIRS)</span>
            </div>
          </div>
        )}

        {viewMode === 'residuals' && (
          /* F21: Residual Error Vectors & Heatmap Mode */
          <div className="relative w-full h-full bg-black">
            <img
              src="/assets/ohrc.jpg"
              alt="OHRC Surface with Residuals"
              className="absolute inset-0 w-full h-full object-cover opacity-80"
            />
            <div className="absolute top-2 left-2 px-2.5 py-1 rounded-lg bg-[#040913]/90 border border-emerald-400/60 shadow-lg flex items-center gap-2">
              <span className="text-[9px] font-mono text-emerald-300 font-extrabold">F21 RESIDUAL ERROR VECTORS</span>
              <span className="text-[8px] font-mono text-emerald-400 bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-500/40 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                <span>&lt;0.5px</span>
              </span>
              <span className="text-[8px] font-mono text-amber-300 bg-amber-950 px-1.5 py-0.5 rounded border border-amber-500/40 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                <span>0.5-1.0px</span>
              </span>
              <span className="text-[8px] font-mono text-rose-300 bg-rose-950 px-1.5 py-0.5 rounded border border-rose-500/40 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 inline-block" />
                <span>&gt;1.0px</span>
              </span>
            </div>
          </div>
        )}

        {/* Canvas Vector Lines Overlay */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 pointer-events-none w-full h-full"
        />

        {/* Bottom Telemetry Strip */}
        <div className="absolute bottom-2 left-2 right-2 px-3 py-1.5 rounded-lg bg-[#040913]/95 backdrop-blur-xl border border-emerald-500/30 flex items-center justify-between text-[10px] font-mono text-white shadow-2xl">
          <div className="flex items-center gap-2">
            <Crosshair size={12} className="text-cyan-400 animate-pulse" />
            <span className="text-slate-200 font-bold">Click image to probe 250-band IIRS reflectance signature</span>
          </div>
          <div className="flex items-center gap-2 font-extrabold">
            <span className="text-emerald-400">Inliers: {inlierCount}/{KEYPOINT_MATCHES.length}</span>
            <span className="text-emerald-700">|</span>
            <span className="text-white">RMSE: 0.34 px</span>
            <span className="text-emerald-700">|</span>
            <span className="text-cyan-300">MAGSAC++: 10k iter</span>
          </div>
        </div>
      </div>
    </div>
  );
};
