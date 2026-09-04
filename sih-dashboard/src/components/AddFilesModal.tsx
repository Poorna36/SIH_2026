import React, { useState, useRef } from 'react';
import { X, Upload, FileText, CheckCircle2, RefreshCw, Layers } from 'lucide-react';
import { uploadMissionFiles } from '../services/api';
import type { ScenePreset } from '../types';

interface AddFilesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPairCreated?: (newScene: ScenePreset) => void;
}

export const AddFilesModal: React.FC<AddFilesModalProps> = ({
  isOpen,
  onClose,
  onPairCreated,
}) => {
  const [dragOver, setDragOver] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [pairName, setPairName] = useState('');
  const [sensor, setSensor] = useState('OHRC');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFilesAdded = (files: FileList | File[]) => {
    const arr = Array.from(files);
    setSelectedFiles((prev) => [...prev, ...arr]);
    setUploadError(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesAdded(e.dataTransfer.files);
    }
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      setUploadError('Please select at least one lunar mission file to ingest.');
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      const res = await uploadMissionFiles(selectedFiles, pairName, sensor);
      if (res && res.status === 'success') {
        setUploadSuccess(res.message);

        // Notify parent to select the newly created pair
        if (onPairCreated && res.pair_id) {
          const newScene: ScenePreset = {
            id: res.pair_id,
            name: res.name || res.pair_id.replace(/_/g, ' ').toUpperCase(),
            lat: -71.5,
            lon: 42.0,
            height: 80000,
            terrainClass: 'polar_highland',
            solarIncidenceDeg: 66.0,
            solarAzimuthDeg: 175.0,
            gsdM: sensor === 'OHRC' ? 0.31 : 0.50,
            description: `User-ingested mission pair (${selectedFiles.length} files, ${sensor})`,
          };

          setTimeout(() => {
            onPairCreated(newScene);
            onClose();
            setSelectedFiles([]);
            setPairName('');
            setUploadSuccess(null);
          }, 1200);
        }
      } else {
        setUploadError('Failed to upload files. Ensure FastAPI backend is online.');
      }
    } catch (err: any) {
      setUploadError(err?.message || 'Network error during file upload.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-150 select-none font-sans"
      onClick={onClose}
      onPointerDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg bg-[#0B0D13]/95 backdrop-blur-3xl border border-white/20 rounded-3xl p-6 shadow-[0_24px_80px_rgba(0,0,0,0.95)] flex flex-col gap-4 animate-in zoom-in-95 duration-150 text-white"
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#2997FF] shadow-[0_0_8px_rgba(41,151,255,0.8)]" />
              <span className="text-[11px] uppercase font-bold tracking-widest text-[#2997FF]">
                Mission Data Ingestion
              </span>
            </div>
            <h2 className="text-lg font-bold text-white mt-1">Add Lunar Mission Files</h2>
            <p className="text-xs text-white/50">
              Upload PDS-4, TIFF, PNG, or JPG imagery for autonomous co-registration.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Inputs row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-bold text-white/60 uppercase tracking-wider block mb-1.5">
              Target / Corridor Name
            </label>
            <input
              type="text"
              value={pairName}
              onChange={(e) => setPairName(e.target.value)}
              placeholder="e.g. South Pole Crater A"
              className="w-full bg-white/[0.04] border border-white/10 focus:border-[#2997FF] rounded-xl px-3 py-2 text-xs text-white placeholder-white/25 focus:outline-none transition-all font-mono"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-white/60 uppercase tracking-wider block mb-1.5">
              Primary Sensor
            </label>
            <select
              value={sensor}
              onChange={(e) => setSensor(e.target.value)}
              className="w-full bg-black/80 border border-white/10 focus:border-[#2997FF] rounded-xl px-3 py-2 text-xs text-white focus:outline-none transition-all cursor-pointer font-sans"
            >
              <option value="OHRC">Chandrayaan-2 OHRC (0.3m/px)</option>
              <option value="TMC-2">Chandrayaan-2 TMC-2 (5m Stereo)</option>
              <option value="IIRS">Chandrayaan-2 IIRS (Hyperspectral)</option>
              <option value="LRO_NAC">LRO NAC (0.5m Baseline)</option>
            </select>
          </div>
        </div>

        {/* Hidden native input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".xml,.img,.tif,.tiff,.qub,.png,.jpg,.jpeg"
          onChange={(e) => {
            if (e.target.files) handleFilesAdded(e.target.files);
          }}
          className="hidden"
        />

        {/* Drag and Drop Zone */}
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`p-6 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
            dragOver
              ? 'border-[#2997FF] bg-[#2997FF]/10 scale-[1.01]'
              : 'border-white/15 hover:border-white/30 bg-white/[0.02] hover:bg-white/[0.04]'
          }`}
        >
          <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mb-2.5 text-[#2997FF]">
            <Upload size={18} />
          </div>
          <p className="text-xs font-bold text-white">
            Click to browse or drop orbital files here
          </p>
          <p className="text-[11px] text-white/40 mt-1 font-mono">
            Accepts .IMG, .TIF, .TIFF, .QUB, .PNG, .JPG (Source & Reference)
          </p>
        </div>

        {/* Selected files list */}
        {selectedFiles.length > 0 && (
          <div className="space-y-1.5 max-h-36 overflow-y-auto sidebar-scroll pr-1">
            <div className="flex items-center justify-between text-[10px] text-white/40 font-mono px-1">
              <span>SELECTED FILES ({selectedFiles.length})</span>
              <button
                onClick={() => setSelectedFiles([])}
                className="text-red-400 hover:text-red-300 cursor-pointer"
              >
                Clear All
              </button>
            </div>
            {selectedFiles.map((file, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-2 rounded-xl bg-white/[0.03] border border-white/10 text-xs"
              >
                <div className="flex items-center gap-2 truncate">
                  <FileText size={14} className="text-[#2997FF] shrink-0" />
                  <span className="font-mono text-xs text-white truncate">{file.name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-white/40 font-mono">
                    {(file.size / 1024).toFixed(0)} KB
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveFile(i);
                    }}
                    className="p-0.5 rounded text-white/40 hover:text-white hover:bg-white/10 cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error / Success Feedback */}
        {uploadError && (
          <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300">
            {uploadError}
          </div>
        )}

        {uploadSuccess && (
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 size={15} className="shrink-0" />
            <span>{uploadSuccess}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 pt-1">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white font-semibold text-xs border border-white/10 transition-all cursor-pointer"
          >
            Cancel
          </button>

          <button
            onClick={handleUpload}
            disabled={isUploading || selectedFiles.length === 0}
            className={`flex-1 py-2.5 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg active:scale-95 ${
              isUploading || selectedFiles.length === 0
                ? 'bg-white/10 text-white/30 cursor-not-allowed'
                : 'bg-[#0071E3] hover:bg-[#0077ED] text-white shadow-[0_0_20px_rgba(0,113,227,0.5)]'
            }`}
          >
            {isUploading ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                <span>Ingesting to Backend...</span>
              </>
            ) : (
              <>
                <Layers size={14} />
                <span>Upload & Register Pair</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
