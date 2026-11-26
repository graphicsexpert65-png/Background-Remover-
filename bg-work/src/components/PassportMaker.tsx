import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  UserCheck,
  Download,
  Printer,
  Sliders,
  RotateCw,
  Move,
  ZoomIn,
  ZoomOut,
  Maximize2,
  AlertTriangle,
  UploadCloud,
  Check,
  FileText,
  FileImage,
  RefreshCw,
  Info,
} from 'lucide-react';
import {
  PASSPORT_PRESETS,
  calculatePassportPixels,
  renderPassportPhoto,
  renderPrintableSheet,
  exportSheetToPdf,
  drawBiometricGuides,
  loadImage,
} from '../services/canvasProcessing';
import { PassportSettings, PassportPreset } from '../types';

interface PassportMakerProps {
  initialImageBlob?: Blob | null;
  initialImageUrl?: string | null;
}

export const PassportMaker: React.FC<PassportMakerProps> = ({
  initialImageBlob,
  initialImageUrl,
}) => {
  const [sourceBlob, setSourceBlob] = useState<Blob | null>(initialImageBlob || null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(initialImageUrl || null);

  // Settings
  const [selectedPresetId, setSelectedPresetId] = useState<string>('us-passport');
  const [customWidthMm, setCustomWidthMm] = useState<number>(35);
  const [customHeightMm, setCustomHeightMm] = useState<number>(45);
  const [dpi, setDpi] = useState<300 | 600 | 150>(300);
  const [bgColor, setBgColor] = useState<string>('#ffffff');
  const [zoom, setZoom] = useState<number>(1.2);
  const [offsetX, setOffsetX] = useState<number>(0);
  const [offsetY, setOffsetY] = useState<number>(0);
  const [rotation, setRotation] = useState<number>(0);
  const [showGuides, setShowGuides] = useState<boolean>(true);
  const [borderStroke, setBorderStroke] = useState<boolean>(true);

  // Sheet print settings
  const [activeMode, setActiveMode] = useState<'single' | 'sheet'>('single');
  const [sheetSize, setSheetSize] = useState<'4x6' | 'A4'>('4x6');
  const [sheetCopies, setSheetCopies] = useState<number>(8);
  const [sheetSpacingMm, setSheetSpacingMm] = useState<number>(3);
  const [sheetMarginMm, setSheetMarginMm] = useState<number>(6);
  const [showCuttingMarks, setShowCuttingMarks] = useState<boolean>(true);

  // Canvas refs and previews
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const sheetCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Update source if initial props change
  useEffect(() => {
    if (initialImageBlob && initialImageUrl) {
      setSourceBlob(initialImageBlob);
      setSourceUrl(initialImageUrl);
    }
  }, [initialImageBlob, initialImageUrl]);

  // Current preset object
  const activePreset: PassportPreset =
    PASSPORT_PRESETS.find((p) => p.id === selectedPresetId) || {
      id: 'custom',
      name: 'Custom Dimensions',
      country: 'Custom',
      widthMm: customWidthMm,
      heightMm: customHeightMm,
      widthInches: customWidthMm / 25.4,
      heightInches: customHeightMm / 25.4,
      description: `${customWidthMm} x ${customHeightMm} mm`,
      suggestedBgColor: '#ffffff',
    };

  const passportSettings: PassportSettings = {
    presetId: selectedPresetId,
    customWidthMm,
    customHeightMm,
    dpi,
    backgroundColor: bgColor,
    zoom,
    offsetX,
    offsetY,
    rotation,
    showGuides,
    borderStroke,
    sheetSize,
    sheetCopies,
    sheetSpacingMm,
    sheetMarginMm,
    showCuttingMarks,
  };

  const { widthPx, heightPx } = calculatePassportPixels(
    activePreset.widthMm || customWidthMm,
    activePreset.heightMm || customHeightMm,
    dpi
  );

  // Render single preview
  const updateSinglePreview = useCallback(async () => {
    if (!sourceUrl || !previewCanvasRef.current) return;
    try {
      const renderedCanvas = await renderPassportPhoto(sourceUrl, passportSettings, activePreset);
      const targetCanvas = previewCanvasRef.current;
      targetCanvas.width = renderedCanvas.width;
      targetCanvas.height = renderedCanvas.height;
      const ctx = targetCanvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(renderedCanvas, 0, 0);

      // Draw guides if enabled
      if (showGuides) {
        drawBiometricGuides(ctx, targetCanvas.width, targetCanvas.height);
      }
    } catch (err) {
      console.error('Error rendering passport photo:', err);
    }
  }, [sourceUrl, passportSettings, activePreset, showGuides]);

  // Render sheet preview
  const updateSheetPreview = useCallback(async () => {
    if (!sourceUrl || !sheetCanvasRef.current) return;
    try {
      const singleCanvas = await renderPassportPhoto(sourceUrl, passportSettings, activePreset);
      const sheet = await renderPrintableSheet(singleCanvas, passportSettings, activePreset);
      const target = sheetCanvasRef.current;
      target.width = sheet.width;
      target.height = sheet.height;
      const ctx = target.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(sheet, 0, 0);
    } catch (err) {
      console.error('Error rendering printable sheet:', err);
    }
  }, [sourceUrl, passportSettings, activePreset]);

  // Trigger renders on settings changes
  useEffect(() => {
    if (activeMode === 'single') {
      updateSinglePreview();
    } else {
      updateSheetPreview();
    }
  }, [activeMode, updateSinglePreview, updateSheetPreview]);

  // Calculate maximum fit for sheet
  const calculateMaxFit = () => {
    const sWidthMm = sheetSize === 'A4' ? 210 : 101.6;
    const sHeightMm = sheetSize === 'A4' ? 297 : 152.4;
    const pWidthMm = activePreset.widthMm || customWidthMm;
    const pHeightMm = activePreset.heightMm || customHeightMm;

    const cols = Math.floor((sWidthMm - sheetMarginMm * 2 + sheetSpacingMm) / (pWidthMm + sheetSpacingMm));
    const rows = Math.floor((sHeightMm - sheetMarginMm * 2 + sheetSpacingMm) / (pHeightMm + sheetSpacingMm));
    return Math.max(1, cols * rows);
  };

  const maxFit = calculateMaxFit();

  // Mouse pan drag handler
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - offsetX, y: e.clientY - offsetY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setOffsetX(e.clientX - dragStart.x);
    setOffsetY(e.clientY - dragStart.y);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Upload custom file for passport
  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const url = URL.createObjectURL(file);
      setSourceBlob(file);
      setSourceUrl(url);
    }
  };

  // Download Single Photo
  const handleDownloadSingle = async (format: 'png' | 'jpeg') => {
    if (!sourceUrl) return;
    const canvas = await renderPassportPhoto(sourceUrl, passportSettings, activePreset);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `passport-${activePreset.id}-${dpi}dpi.${format === 'jpeg' ? 'jpg' : 'png'}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
      format === 'jpeg' ? 'image/jpeg' : 'image/png',
      0.98
    );
  };

  // Download Sheet (PNG or PDF)
  const handleDownloadSheetPng = async () => {
    if (!sourceUrl) return;
    const single = await renderPassportPhoto(sourceUrl, passportSettings, activePreset);
    const sheet = await renderPrintableSheet(single, passportSettings, activePreset);
    sheet.toBlob(
      (blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `passport-sheet-${sheetSize}-${dpi}dpi.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
      'image/png'
    );
  };

  const handleDownloadSheetPdf = async () => {
    if (!sourceUrl) return;
    setIsExportingPdf(true);
    try {
      const single = await renderPassportPhoto(sourceUrl, passportSettings, activePreset);
      const sheet = await renderPrintableSheet(single, passportSettings, activePreset);
      await exportSheetToPdf(sheet, sheetSize, `passport-print-sheet-${sheetSize}.pdf`);
    } catch (err) {
      console.error(err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Title & Introduction */}
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300 text-xs font-semibold">
          <UserCheck className="w-3.5 h-3.5" />
          <span>Biometric Standards & High-Res Print Sheets</span>
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-white">
          Passport & Visa Photo Maker.{' '}
          <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
            Ready to Print.
          </span>
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300">
          Create certified 35x45mm, 2x2" (51x51mm) and custom passport photos at 300 DPI.
          Position with head alignment guides and export individual photos or printable 4x6" and A4 sheets.
        </p>
      </div>

      {/* Official requirements warning notice */}
      <div className="max-w-4xl mx-auto p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 flex items-start gap-3 text-xs leading-relaxed shadow-sm">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Official Biometric Compliance Notice: </span>
          Requirements vary strictly between embassies and passport agencies (e.g. eye position, neutral expression,
          background tint, and head height percentages). While our visual guides follow international ICAO 9303 standards,
          always verify your specific government agency regulations prior to official submission.
        </div>
      </div>

      {/* Main Workspace Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-xl overflow-hidden">
        {!sourceUrl ? (
          /* Empty state: upload or instruct */
          <div className="p-12 text-center space-y-4">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-indigo-200 dark:border-slate-700 hover:border-indigo-500 rounded-2xl p-12 cursor-pointer bg-indigo-50/20 dark:bg-slate-800/40 hover:bg-indigo-50/50 transition-all max-w-xl mx-auto"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleUploadFile}
              />
              <div className="w-16 h-16 rounded-2xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-3 shadow-inner">
                <UploadCloud className="w-8 h-8" />
              </div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                Upload a Photo for your Passport
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Tip: You can also remove the background first in the Background Remover tab, then click &ldquo;Create Passport Photo&rdquo;!
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-800">
            {/* Left: Interactive Canvas Preview */}
            <div className="flex-1 p-6 flex flex-col justify-between space-y-4">
              {/* Top View Selector Tabs: Single vs Sheet */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex rounded-xl p-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold">
                  <button
                    onClick={() => setActiveMode('single')}
                    className={`px-4 py-1.5 rounded-lg transition-all ${
                      activeMode === 'single'
                        ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    Single Photo & Crop
                  </button>
                  <button
                    onClick={() => setActiveMode('sheet')}
                    className={`px-4 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                      activeMode === 'sheet'
                        ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Sheet Layout ({sheetSize})</span>
                  </button>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="font-mono bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">
                    {activePreset.widthMm || customWidthMm} × {activePreset.heightMm || customHeightMm} mm
                  </span>
                  <span className="font-mono bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 px-2 py-1 rounded-md">
                    {widthPx} × {heightPx} px @ {dpi} DPI
                  </span>
                </div>
              </div>

              {/* Canvas viewport container */}
              <div
                className="relative w-full aspect-[4/3] max-h-[520px] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 flex items-center justify-center p-4 shadow-inner"
                onMouseDown={activeMode === 'single' ? handleMouseDown : undefined}
                onMouseMove={activeMode === 'single' ? handleMouseMove : undefined}
                onMouseUp={activeMode === 'single' ? handleMouseUp : undefined}
                style={{ cursor: activeMode === 'single' ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
              >
                {activeMode === 'single' ? (
                  <div className="relative shadow-2xl rounded-sm overflow-hidden border border-slate-300 max-h-full">
                    <canvas
                      ref={previewCanvasRef}
                      className="max-h-[460px] max-w-full object-contain block"
                    />
                  </div>
                ) : (
                  <div className="relative shadow-2xl rounded-sm overflow-hidden border border-slate-300 max-h-full">
                    <canvas
                      ref={sheetCanvasRef}
                      className="max-h-[460px] max-w-full object-contain block"
                    />
                  </div>
                )}

                {/* Single mode overlay guide info */}
                {activeMode === 'single' && showGuides && (
                  <div className="absolute top-4 left-4 z-10 bg-black/75 backdrop-blur-md text-white px-3 py-2 rounded-xl text-[11px] space-y-1 pointer-events-none">
                    <div className="font-bold text-indigo-300 flex items-center gap-1">
                      <Info className="w-3.5 h-3.5" />
                      Biometric Positioning
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px]">
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                      <span>Green Line: Crown of head</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px]">
                      <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                      <span>Blue Line: Eye level</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px]">
                      <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                      <span>Red Line: Chin line</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Pan / Zoom helper note */}
              <div className="text-center text-xs text-slate-500 dark:text-slate-400">
                {activeMode === 'single'
                  ? 'Click & drag the photo inside the canvas to center the face within the guides.'
                  : `Previewing ${sheetCopies} copies on ${sheetSize === 'A4' ? 'A4 paper' : '4x6" photo card'}.`}
              </div>
            </div>

            {/* Right: Controls & Adjustments */}
            <div className="w-full lg:w-96 p-6 space-y-5 bg-slate-50/50 dark:bg-slate-900/50">
              {/* Preset Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Standard Dimension Preset
                </label>
                <select
                  value={selectedPresetId}
                  onChange={(e) => setSelectedPresetId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {PASSPORT_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.widthMm} × {p.heightMm} mm)
                    </option>
                  ))}
                  <option value="custom">Custom Dimensions (mm)...</option>
                </select>
                <p className="text-[11px] text-slate-500">{activePreset.description}</p>
              </div>

              {/* Custom mm inputs if custom preset */}
              {selectedPresetId === 'custom' && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="text-[11px] text-slate-500">Width (mm)</label>
                    <input
                      type="number"
                      min="20"
                      max="150"
                      value={customWidthMm}
                      onChange={(e) => setCustomWidthMm(parseInt(e.target.value, 10) || 35)}
                      className="w-full px-2.5 py-1.5 rounded-lg text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500">Height (mm)</label>
                    <input
                      type="number"
                      min="20"
                      max="150"
                      value={customHeightMm}
                      onChange={(e) => setCustomHeightMm(parseInt(e.target.value, 10) || 45)}
                      className="w-full px-2.5 py-1.5 rounded-lg text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>
                </div>
              )}

              {/* Resolution (DPI) */}
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Print Resolution
                </span>
                <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-100 dark:bg-slate-800 text-[11px]">
                  {[150, 300, 600].map((d) => (
                    <button
                      key={d}
                      onClick={() => setDpi(d as 300 | 600 | 150)}
                      className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                        dpi === d
                          ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                          : 'text-slate-500'
                      }`}
                    >
                      {d} DPI {d === 300 ? '(Std)' : d === 600 ? '(Ultra)' : ''}
                    </button>
                  ))}
                </div>
              </div>

              {/* Background Color */}
              <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Background Color
                  </span>
                  <span className="text-[11px] text-slate-500">{bgColor}</span>
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {[
                    { label: 'White', color: '#ffffff' },
                    { label: 'Passport Blue', color: '#2b6cb0' },
                    { label: 'Light Blue', color: '#60a5fa' },
                    { label: 'Red', color: '#dc2626' },
                    { label: 'Light Grey', color: '#f1f5f9' },
                  ].map((c) => (
                    <button
                      key={c.label}
                      onClick={() => setBgColor(c.color)}
                      title={c.label}
                      className={`h-8 rounded-lg border flex items-center justify-center transition-all ${
                        bgColor.toLowerCase() === c.color.toLowerCase()
                          ? 'ring-2 ring-indigo-600 border-indigo-600'
                          : 'border-slate-200 dark:border-slate-700 hover:scale-105'
                      }`}
                      style={{ backgroundColor: c.color }}
                    >
                      {bgColor.toLowerCase() === c.color.toLowerCase() && (
                        <Check className={`w-3.5 h-3.5 ${c.color === '#ffffff' ? 'text-black' : 'text-white'}`} />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Face Positioning & Guides */}
              <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Move className="w-3.5 h-3.5 text-indigo-500" />
                    Positioning & Scale
                  </span>
                  <button
                    onClick={() => {
                      setZoom(1.2);
                      setOffsetX(0);
                      setOffsetY(0);
                      setRotation(0);
                    }}
                    className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    Reset Center
                  </button>
                </div>

                {/* Zoom */}
                <div>
                  <div className="flex justify-between text-[11px] mb-1 text-slate-500">
                    <span>Face Zoom</span>
                    <span>{Math.round(zoom * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="2.5"
                    step="0.05"
                    value={zoom}
                    onChange={(e) => setZoom(parseFloat(e.target.value))}
                    className="w-full accent-indigo-600"
                  />
                </div>

                {/* Rotation */}
                <div>
                  <div className="flex justify-between text-[11px] mb-1 text-slate-500">
                    <span>Rotation Align</span>
                    <span>{rotation}°</span>
                  </div>
                  <input
                    type="range"
                    min="-15"
                    max="15"
                    step="0.5"
                    value={rotation}
                    onChange={(e) => setRotation(parseFloat(e.target.value))}
                    className="w-full accent-indigo-600"
                  />
                </div>

                {/* Toggles */}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-slate-600 dark:text-slate-400">Show Biometric Guides</span>
                  <input
                    type="checkbox"
                    checked={showGuides}
                    onChange={(e) => setShowGuides(e.target.checked)}
                    className="accent-indigo-600 h-4 w-4"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Thin Border Line (For Cutting)</span>
                  <input
                    type="checkbox"
                    checked={borderStroke}
                    onChange={(e) => setBorderStroke(e.target.checked)}
                    className="accent-indigo-600 h-4 w-4"
                  />
                </div>
              </div>

              {/* Sheet Controls if Sheet Mode is active */}
              {activeMode === 'sheet' && (
                <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800 text-xs">
                  <span className="font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Printer className="w-3.5 h-3.5 text-indigo-500" />
                    Print Sheet Settings
                  </span>

                  {/* Sheet Size */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setSheetSize('4x6')}
                      className={`p-2 rounded-xl border text-xs font-semibold text-center transition-all ${
                        sheetSize === '4x6'
                          ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400'
                          : 'border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      4 x 6 &rdquo; Photo Card
                    </button>
                    <button
                      onClick={() => setSheetSize('A4')}
                      className={`p-2 rounded-xl border text-xs font-semibold text-center transition-all ${
                        sheetSize === 'A4'
                          ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400'
                          : 'border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      A4 Standard Paper
                    </button>
                  </div>

                  {/* Copies on sheet */}
                  <div>
                    <div className="flex justify-between text-[11px] mb-1 text-slate-500">
                      <span>Copies to Print</span>
                      <span className="font-bold">{sheetCopies} (Max fit: {maxFit})</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max={maxFit}
                      value={sheetCopies}
                      onChange={(e) => setSheetCopies(parseInt(e.target.value, 10))}
                      className="w-full accent-indigo-600"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Dashed Cutting Lines</span>
                    <input
                      type="checkbox"
                      checked={showCuttingMarks}
                      onChange={(e) => setShowCuttingMarks(e.target.checked)}
                      className="accent-indigo-600 h-4 w-4"
                    />
                  </div>
                </div>
              )}

              {/* Downloads & Exports */}
              <div className="space-y-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                {activeMode === 'single' ? (
                  <div className="space-y-2">
                    <button
                      onClick={() => handleDownloadSingle('jpeg')}
                      className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-colors shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download Single Photo (JPG @ {dpi} DPI)</span>
                    </button>
                    <button
                      onClick={() => handleDownloadSingle('png')}
                      className="w-full py-2 px-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs transition-colors flex items-center justify-center gap-2"
                    >
                      <FileImage className="w-3.5 h-3.5" />
                      <span>Download as Lossless PNG</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <button
                      onClick={handleDownloadSheetPdf}
                      disabled={isExportingPdf}
                      className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-colors shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>
                        {isExportingPdf ? 'Generating PDF...' : `Download Print-Ready PDF (${sheetSize})`}
                      </span>
                    </button>
                    <button
                      onClick={handleDownloadSheetPng}
                      className="w-full py-2 px-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs transition-colors flex items-center justify-center gap-2"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download High-Res Sheet PNG</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
