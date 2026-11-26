import React, { useState, useRef } from 'react';
import JSZip from 'jszip';
import {
  FolderKanban,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Play,
  Trash2,
  Download,
  Archive,
  RefreshCw,
  Palette,
  Check,
  FileImage,
  Clock,
  Sparkles,
} from 'lucide-react';
import { executeBackgroundRemoval } from '../services/backgroundRemoval';
import { compositeImage, loadImage } from '../services/canvasProcessing';
import { BatchItem, BackgroundSettings } from '../types';

export const BatchRemover: React.FC = () => {
  const [items, setItems] = useState<BatchItem[]>([]);
  const [isProcessingQueue, setIsProcessingQueue] = useState<boolean>(false);
  const [commonBgColor, setCommonBgColor] = useState<string>('transparent');
  const [isZipping, setIsZipping] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MAX_BATCH = 5;

  // Add files to batch
  const handleFilesAdded = async (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter((f) => f.type.match(/^image\/(jpeg|png|webp|jpg)$/i));
    if (fileArray.length === 0) return;

    const remainingSlots = MAX_BATCH - items.length;
    if (remainingSlots <= 0) return;

    const filesToTake = fileArray.slice(0, remainingSlots);

    const newItems: BatchItem[] = await Promise.all(
      filesToTake.map(async (file) => {
        const id = Math.random().toString(36).substring(2, 9);
        const originalUrl = URL.createObjectURL(file);
        let dimensions: { width: number; height: number } | undefined;
        try {
          const img = await loadImage(originalUrl);
          dimensions = { width: img.naturalWidth, height: img.naturalHeight };
        } catch {
          // ignore
        }

        return {
          id,
          file,
          name: file.name,
          size: file.size,
          originalUrl,
          dimensions,
          status: 'pending',
          progress: 0,
          progressMessage: 'Queued',
        };
      })
    );

    setItems((prev) => [...prev, ...newItems]);
  };

  // Remove individual item
  const handleRemoveItem = (id: string) => {
    setItems((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item) {
        URL.revokeObjectURL(item.originalUrl);
        if (item.transparentPngUrl) URL.revokeObjectURL(item.transparentPngUrl);
        if (item.outputUrl) URL.revokeObjectURL(item.outputUrl);
      }
      return prev.filter((i) => i.id !== id);
    });
  };

  // Clear all items
  const handleClearAll = () => {
    items.forEach((item) => {
      URL.revokeObjectURL(item.originalUrl);
      if (item.transparentPngUrl) URL.revokeObjectURL(item.transparentPngUrl);
      if (item.outputUrl) URL.revokeObjectURL(item.outputUrl);
    });
    setItems([]);
  };

  // Run sequential memory-safe queue
  const processBatchQueue = async () => {
    if (isProcessingQueue) return;
    setIsProcessingQueue(true);

    // Process one by one sequentially to protect browser RAM from GPU/WASM memory spikes
    for (const item of items) {
      if (item.status === 'completed') continue;

      // Update state to processing
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? { ...i, status: 'processing', progress: 10, progressMessage: 'Starting AI segmentation...' }
            : i
        )
      );

      try {
        const resultBlob = await executeBackgroundRemoval(item.file, {
          model: 'isnet_quint8',
          device: 'cpu',
          onProgress: (stage, percent) => {
            setItems((prev) =>
              prev.map((i) => (i.id === item.id ? { ...i, progress: percent, progressMessage: stage } : i))
            );
          },
        });

        const transparentPngUrl = URL.createObjectURL(resultBlob);

        // Render composited output with current commonBgColor
        const bgSettings: BackgroundSettings = {
          type: commonBgColor === 'transparent' ? 'transparent' : 'color',
          color: commonBgColor === 'transparent' ? '#ffffff' : commonBgColor,
        };

        const composited = await compositeImage(
          resultBlob,
          bgSettings,
          undefined,
          'image/png',
          0.95,
          item.file
        );

        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? {
                  ...i,
                  status: 'completed',
                  progress: 100,
                  progressMessage: 'Ready',
                  transparentBlob: resultBlob,
                  transparentPngUrl,
                  outputBlob: composited.blob,
                  outputUrl: composited.url,
                }
              : i
          )
        );
      } catch (err: unknown) {
        console.error(`Batch error on ${item.name}:`, err);
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? {
                  ...i,
                  status: 'error',
                  progress: 0,
                  error: err instanceof Error ? err.message : 'Segmentation failed',
                }
              : i
          )
        );
      }
    }

    setIsProcessingQueue(false);
  };

  // Apply common color to all already-completed items
  const handleApplyCommonColor = async (color: string) => {
    setCommonBgColor(color);
    const bgSettings: BackgroundSettings = {
      type: color === 'transparent' ? 'transparent' : 'color',
      color: color === 'transparent' ? '#ffffff' : color,
    };

    setItems((prev) =>
      prev.map((item) => {
        if (item.status !== 'completed' || !item.transparentBlob) return item;

        // Async re-render compositing
        compositeImage(
          item.transparentBlob,
          bgSettings,
          undefined,
          'image/png',
          0.95,
          item.file
        ).then((res) => {
          if (item.outputUrl) URL.revokeObjectURL(item.outputUrl);
          setItems((innerPrev) =>
            innerPrev.map((inner) =>
              inner.id === item.id ? { ...inner, outputBlob: res.blob, outputUrl: res.url } : inner
            )
          );
        });

        return item;
      })
    );
  };

  // Download single item
  const handleDownloadSingle = (item: BatchItem) => {
    if (!item.outputBlob && !item.transparentBlob) return;
    const blob = item.outputBlob || item.transparentBlob!;
    const ext = commonBgColor === 'transparent' ? 'png' : 'jpg';
    const name = item.name.replace(/\.[^/.]+$/, '');

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}-no-bg.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // Download all as ZIP
  const handleDownloadAllZip = async () => {
    const completedItems = items.filter((i) => i.status === 'completed' && (i.outputBlob || i.transparentBlob));
    if (completedItems.length === 0) return;

    setIsZipping(true);
    try {
      const zip = new JSZip();
      const ext = commonBgColor === 'transparent' ? 'png' : 'jpg';

      for (const item of completedItems) {
        const blob = item.outputBlob || item.transparentBlob!;
        const name = item.name.replace(/\.[^/.]+$/, '');
        zip.file(`${name}-no-bg.${ext}`, blob);
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bg-remover-pro-batch-${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.error('Failed to create ZIP package:', err);
    } finally {
      setIsZipping(false);
    }
  };

  const completedCount = items.filter((i) => i.status === 'completed').length;

  return (
    <div className="space-y-8">
      {/* Title */}
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pink-100 text-pink-800 dark:bg-pink-950/80 dark:text-pink-300 text-xs font-semibold">
          <FolderKanban className="w-3.5 h-3.5" />
          <span>Sequential Safe Queue • Up to 5 Images</span>
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-white">
          Batch Background Remover.{' '}
          <span className="bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent">
            One-Click ZIP Export.
          </span>
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300">
          Process multiple portraits, product shots, or vehicle photos in a row without crashing your browser.
          Sequential WebAssembly memory management ensures reliable execution.
        </p>
      </div>

      {/* Main Batch Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-xl p-6 sm:p-8 space-y-6">
        {/* Upload Dropzone */}
        {items.length < MAX_BATCH && (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files) handleFilesAdded(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-purple-200 dark:border-slate-700 hover:border-purple-500 rounded-2xl p-8 text-center cursor-pointer bg-purple-50/20 dark:bg-slate-800/40 hover:bg-purple-50/50 transition-all group"
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                if (e.target.files) handleFilesAdded(e.target.files);
              }}
            />
            <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400 flex items-center justify-center mx-auto mb-3 shadow-inner group-hover:scale-105 transition-transform">
              <UploadCloud className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-sm text-slate-900 dark:text-white">
              Add images to batch ({items.length}/{MAX_BATCH} selected)
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Select up to {MAX_BATCH} JPG, PNG, or WebP files to segment in a single session
            </p>
          </div>
        )}

        {/* Global Toolbar */}
        {items.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 text-xs">
            {/* Common Color Selector */}
            <div className="flex items-center gap-3">
              <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-purple-600" />
                Batch Background:
              </span>
              <div className="flex items-center gap-1.5">
                {[
                  { name: 'Transparent', value: 'transparent' },
                  { name: 'White', value: '#ffffff' },
                  { name: 'Passport Blue', value: '#2b6cb0' },
                  { name: 'Grey', value: '#f1f5f9' },
                  { name: 'Black', value: '#1e293b' },
                ].map((c) => (
                  <button
                    key={c.name}
                    onClick={() => handleApplyCommonColor(c.value)}
                    title={c.name}
                    className={`h-7 px-2.5 rounded-lg border text-[11px] font-medium flex items-center gap-1.5 transition-all ${
                      commonBgColor === c.value
                        ? 'border-purple-600 bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300 font-bold'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <span
                      className={`w-3 h-3 rounded-full border ${c.value === 'transparent' ? 'bg-checkerboard' : ''}`}
                      style={c.value !== 'transparent' ? { backgroundColor: c.value } : {}}
                    ></span>
                    <span>{c.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Queue Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleClearAll}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 text-slate-600 dark:text-slate-400 font-semibold transition-colors flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All</span>
              </button>

              <button
                disabled={isProcessingQueue || completedCount === items.length}
                onClick={processBatchQueue}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold transition-all shadow-md shadow-purple-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isProcessingQueue ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Processing Queue...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Process All {items.length} Images</span>
                  </>
                )}
              </button>

              <button
                disabled={completedCount === 0 || isZipping}
                onClick={handleDownloadAllZip}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-all shadow-md shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Archive className="w-3.5 h-3.5" />
                <span>{isZipping ? 'Creating ZIP...' : `Download All (${completedCount}) ZIP`}</span>
              </button>
            </div>
          </div>
        )}

        {/* Batch Queue Items List */}
        <div className="space-y-3">
          {items.map((item, idx) => (
            <div
              key={item.id}
              className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-all hover:border-purple-300 dark:hover:border-purple-900 shadow-xs"
            >
              {/* Left: Thumbnail & Details */}
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <span className="text-xs font-mono font-bold text-slate-400 w-4">{idx + 1}</span>

                {/* Thumb preview (Output or Original) */}
                <div className="w-16 h-16 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-checkerboard shrink-0 flex items-center justify-center">
                  <img
                    src={item.outputUrl || item.originalUrl}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Filename & specs */}
                <div className="space-y-1 min-w-0">
                  <h5 className="font-bold text-xs text-slate-900 dark:text-white truncate max-w-xs">
                    {item.name}
                  </h5>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                    <span>{(item.size / 1024).toFixed(0)} KB</span>
                    {item.dimensions && (
                      <span>
                        • {item.dimensions.width}×{item.dimensions.height} px
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Middle: Status & Progress */}
              <div className="w-full sm:w-64 space-y-1.5">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    {item.status === 'completed' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                    {item.status === 'processing' && <RefreshCw className="w-3.5 h-3.5 text-purple-600 animate-spin" />}
                    {item.status === 'pending' && <Clock className="w-3.5 h-3.5 text-amber-500" />}
                    {item.status === 'error' && <AlertCircle className="w-3.5 h-3.5 text-rose-500" />}
                    <span className="capitalize">{item.progressMessage}</span>
                  </span>
                  <span className="font-mono text-slate-500">{item.progress}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      item.status === 'error'
                        ? 'bg-rose-500'
                        : item.status === 'completed'
                        ? 'bg-emerald-500'
                        : 'bg-gradient-to-r from-purple-600 to-indigo-600'
                    }`}
                    style={{ width: `${item.progress}%` }}
                  ></div>
                </div>
              </div>

              {/* Right: Actions */}
              <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
                {item.status === 'completed' && (
                  <button
                    onClick={() => handleDownloadSingle(item)}
                    className="p-2 rounded-xl text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950 border border-indigo-200 dark:border-indigo-900 transition-colors"
                    title="Download this image"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                )}

                <button
                  disabled={isProcessingQueue && item.status === 'processing'}
                  onClick={() => handleRemoveItem(item.id)}
                  className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-slate-200 dark:border-slate-800 transition-colors disabled:opacity-40"
                  title="Remove from batch"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
