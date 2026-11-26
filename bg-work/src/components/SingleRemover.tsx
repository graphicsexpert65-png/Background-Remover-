import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  UploadCloud,
  Download,
  Sliders,
  Sparkles,
  RefreshCw,
  Eye,
  ZoomIn,
  ZoomOut,
  Maximize2,
  FileCheck,
  ShieldCheck,
  AlertCircle,
  ArrowRight,
  Palette,
  Image as ImageIcon,
  Check,
  RotateCcw,
  Eraser,
  Paintbrush,
  Undo2,
  Redo2,
  Filter,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Hand,
  Pipette,
  Dog,
  User,
  Package,
  Activity,
  Info,
  Layers,
  Cpu,
  X,
  AlertTriangle,
} from 'lucide-react';
import { executeBackgroundRemoval, preloadOnnxRuntime } from '../services/backgroundRemoval';
import { compositeImage, loadImage, paintBrushStroke } from '../services/canvasProcessing';
import { createSyntheticSample } from '../services/sampleImages';
import {
  BackgroundSettings,
  RefinementSettings,
  BrushSettings,
  BrushTool,
  SubjectMode,
  DiagnosticsInfo,
} from '../types';
import { DiagnosticsModal } from './DiagnosticsModal';

interface SingleRemoverProps {
  onOpenInPassport: (imageBlob: Blob, imageUrl: string) => void;
}

const PRESET_COLORS = [
  { name: 'Transparent', value: 'transparent', isTransparent: true },
  { name: 'Pure White', value: '#ffffff' },
  { name: 'Passport Blue', value: '#2b6cb0' },
  { name: 'Light Blue', value: '#60a5fa' },
  { name: 'Crimson Red', value: '#dc2626' },
  { name: 'Studio Grey', value: '#f1f5f9' },
  { name: 'Dark Slate', value: '#1e293b' },
  { name: 'Emerald', value: '#059669' },
  { name: 'Amber Gold', value: '#d97706' },
];

export const SingleRemover: React.FC<SingleRemoverProps> = ({ onOpenInPassport }) => {
  // Image state
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [originalImgElement, setOriginalImgElement] = useState<HTMLImageElement | null>(null);
  const [originalDimensions, setOriginalDimensions] = useState<{ width: number; height: number } | null>(null);

  // Segmentation state
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressStage, setProgressStage] = useState<string>('');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [progressDetail, setProgressDetail] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Raw AI transparent cutout
  const [rawAiBlob, setRawAiBlob] = useState<Blob | null>(null);

  // Active working cutout (includes AI segmentation + user brush edits)
  const [workingCanvas, setWorkingCanvas] = useState<HTMLCanvasElement | null>(null);
  const [workingUrl, setWorkingUrl] = useState<string | null>(null);

  // Final composited result (with background color + refinements applied)
  const [compositedUrl, setCompositedUrl] = useState<string | null>(null);
  const [compositedBlob, setCompositedBlob] = useState<Blob | null>(null);

  // Background settings
  const [bgSettings, setBgSettings] = useState<BackgroundSettings>({
    type: 'transparent',
    color: '#ffffff',
  });
  const [customHex, setCustomHex] = useState<string>('#ffffff');

  // Refinement settings
  const [refinements, setRefinements] = useState<RefinementSettings>({
    feather: 0,
    edgeShift: 0,
    antiHalo: true,
    decontaminateStrength: 65,
    decontaminateBgColor: '',
    autoDetectBgColor: true,
    removeStrayFragments: false,
    fragmentThreshold: 5,
    subjectMode: 'auto',
    isolatePrimarySubject: false,
    furPreservation: true,
    groundSuppression: true,
    decontaminateEdges: true,
    preserveTranslucency: true,
    veilBoost: 15,
    jewelleryGuard: true,
    brightness: 0,
    contrast: 0,
  });
  const [detectedBgColor, setDetectedBgColor] = useState<string>('#553728');
  const [detectedSubjectMode, setDetectedSubjectMode] = useState<SubjectMode>('portrait');
  const [showRefinements, setShowRefinements] = useState<boolean>(false);
  const [showDiagnostics, setShowDiagnostics] = useState<boolean>(false);
  const [diagnosticsInfo, setDiagnosticsInfo] = useState<DiagnosticsInfo | null>(null);
  const [activeStageViewer, setActiveStageViewer] = useState<'raw' | 'stage2' | 'stage3' | 'stage4'>('stage4');

  // Viewer vs Brush Mode
  const [activeMode, setActiveMode] = useState<'compare' | 'brush'>('compare');
  const [sliderPos, setSliderPos] = useState<number>(50); // 0 to 100%
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [isPanMode, setIsPanMode] = useState<boolean>(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDraggingSlider, setIsDraggingSlider] = useState<boolean>(false);

  // Brush settings
  const [brushSettings, setBrushSettings] = useState<BrushSettings>({
    tool: 'erase',
    size: 25,
    hardness: 0.8,
    opacity: 1.0,
  });
  const [isBrushing, setIsBrushing] = useState<boolean>(false);
  const [lastBrushPos, setLastBrushPos] = useState<{ x: number; y: number } | null>(null);
  const [brushCursorPos, setBrushCursorPos] = useState<{ x: number; y: number } | null>(null);

  // History stack for undo / redo
  const [undoStack, setUndoStack] = useState<ImageData[]>([]);
  const [redoStack, setRedoStack] = useState<ImageData[]>([]);

  // Export settings
  const [exportFormat, setExportFormat] = useState<'png' | 'jpeg' | 'webp'>('png');
  const [exportQuality, setExportQuality] = useState<number>(95);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const viewerContainerRef = useRef<HTMLDivElement>(null);
  const brushCanvasRef = useRef<HTMLCanvasElement>(null);
  const comparisonFrameRef = useRef<HTMLDivElement>(null);

  // Keep track of active blob URLs for clean unmount revocation ONLY
  const activeUrlsRef = useRef<{
    originalUrl: string | null;
    workingUrl: string | null;
    compositedUrl: string | null;
  }>({
    originalUrl: null,
    workingUrl: null,
    compositedUrl: null,
  });

  useEffect(() => {
    activeUrlsRef.current = { originalUrl, workingUrl, compositedUrl };
  }, [originalUrl, workingUrl, compositedUrl]);

  // Warm up ONNX Runtime Web engine in background on mount
  useEffect(() => {
    preloadOnnxRuntime('cpu');
  }, []);

  // Clean up object URLs on component unmount ONLY
  useEffect(() => {
    return () => {
      if (activeUrlsRef.current.originalUrl) URL.revokeObjectURL(activeUrlsRef.current.originalUrl);
      if (activeUrlsRef.current.workingUrl) URL.revokeObjectURL(activeUrlsRef.current.workingUrl);
      if (activeUrlsRef.current.compositedUrl) URL.revokeObjectURL(activeUrlsRef.current.compositedUrl);
    };
  }, []);

  // Handle file selection
  const handleFileSelect = async (file: File) => {
    if (!file.type.match(/^image\/(jpeg|png|webp|jpg)$/i)) {
      setErrorMessage('Please upload a valid image file (JPG, PNG, or WebP).');
      return;
    }

    setErrorMessage(null);
    setOriginalFile(file);

    // Revoke previous URLs before setting new ones
    if (originalUrl) URL.revokeObjectURL(originalUrl);
    if (workingUrl) URL.revokeObjectURL(workingUrl);
    if (compositedUrl) URL.revokeObjectURL(compositedUrl);

    const url = URL.createObjectURL(file);
    setOriginalUrl(url);

    try {
      const img = await loadImage(url);
      setOriginalImgElement(img);
      setOriginalDimensions({ width: img.naturalWidth, height: img.naturalHeight });
    } catch {
      // ignore
    }

    setRawAiBlob(null);
    setWorkingCanvas(null);
    setWorkingUrl(null);
    setCompositedBlob(null);
    setCompositedUrl(null);
    setUndoStack([]);
    setRedoStack([]);

    startBackgroundRemoval(file);
  };

  // Run AI segmentation
  const startBackgroundRemoval = async (source: File | Blob) => {
    setIsProcessing(true);
    setErrorMessage(null);
    setProgressPercent(5);
    setProgressStage('Initializing AI segmentation model...');
    setProgressDetail('Loading WebAssembly & ISNet neural weights');

    const t0 = performance.now();

    try {
      const resultBlob = await executeBackgroundRemoval(source, {
        model: 'isnet_quint8',
        device: 'cpu',
        onProgress: (stage, percent, detail) => {
          setProgressStage(stage);
          setProgressPercent(percent);
          if (detail) setProgressDetail(detail);
        },
      });

      const tInference = performance.now();

      setRawAiBlob(resultBlob);

      // 1. Generate composited result with refinements and original image color unblending
      const composited = await compositeImage(
        resultBlob,
        bgSettings,
        refinements,
        exportFormat === 'jpeg' ? 'image/jpeg' : 'image/png',
        exportQuality / 100,
        originalImgElement || source
      );

      const tPost = performance.now();

      if (composited.detectedBgColor) {
        setDetectedBgColor(composited.detectedBgColor);
      }
      if (composited.detectedMode) {
        setDetectedSubjectMode(composited.detectedMode);
      }

      setCompositedBlob(composited.blob);
      setCompositedUrl(composited.url);

      if (composited.diagnostics) {
        setDiagnosticsInfo({
          modelName: 'IS-Net (DIS / Highly Accurate Dichotomous Image Segmentation)',
          license: 'MIT License (Permissive commercial use compliant)',
          backend: 'ONNX Runtime Web (WASM SIMD with WebGPU fallback)',
          inputSize: '1 × 3 × 1024 × 1024 (BCHW format)',
          tensorInputDims: '1 × 3 × 1024 × 1024 (BCHW Float32)',
          tensorOutputDims: '1 × 1 × 1024 × 1024 (BCHW Float32 Sigmoid)',
          imageDimensions: { width: composited.width, height: composited.height },
          originalUrl: originalUrl || undefined,
          inferenceTimeMs: Math.round(tInference - t0),
          postprocessTimeMs: Math.round(tPost - tInference),
          rawMaskUrl: composited.diagnostics.rawMaskUrl,
          resizedMaskUrl: composited.diagnostics.rawMaskUrl,
          stage2MaskUrl: composited.diagnostics.stage2MaskUrl,
          stage3MaskUrl: composited.diagnostics.stage3MaskUrl,
          stage4CutoutUrl: composited.diagnostics.stage4CutoutUrl,
          lowConfidenceWarning: composited.diagnostics.lowConfidenceWarning,
        });
      }

      // 2. Extract transparent clean cutout for workingCanvas (touch-up brush & undo base)
      // This ensures the working canvas starts with the isolated subject, free of outdoor lawn/trees/flowers
      const transparentCutout =
        bgSettings.type === 'transparent'
          ? composited
          : await compositeImage(
              resultBlob,
              { type: 'transparent' },
              refinements,
              'image/png',
              1.0,
              originalImgElement || source
            );

      const cleanImg = await loadImage(transparentCutout.blob);
      const canvas = document.createElement('canvas');
      canvas.width = cleanImg.naturalWidth || cleanImg.width;
      canvas.height = cleanImg.naturalHeight || cleanImg.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(cleanImg, 0, 0);
        const initImgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        setUndoStack([initImgData]);
      }
      setWorkingCanvas(canvas);
      setWorkingUrl(transparentCutout.url);
      setIsProcessing(false);
    } catch (err: unknown) {
      console.error(err);
      setIsProcessing(false);
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Failed to process image. Please try again or test with one of the sample images.'
      );
    }
  };

  // Update composite result instantly whenever settings or working canvas changes
  const updateCompositing = useCallback(
    async (
      sourceCanvasOrBlob: HTMLCanvasElement | Blob | null,
      bg: BackgroundSettings,
      ref: RefinementSettings,
      fmt: 'png' | 'jpeg' | 'webp'
    ) => {
      // If user hasn't made manual brush edits, prioritize rawAiBlob so tweaking sliders
      // immediately re-filters from the pristine neural output.
      // If user has made manual brush edits (undoStack.length > 1), use workingCanvas.
      const hasBrushEdits = undoStack.length > 1;
      const source = (hasBrushEdits ? workingCanvas : rawAiBlob) || sourceCanvasOrBlob || workingCanvas || rawAiBlob;
      if (!source) return;
      const tStart = performance.now();
      try {
        const mimeType = fmt === 'jpeg' ? 'image/jpeg' : fmt === 'webp' ? 'image/webp' : 'image/png';
        const composited = await compositeImage(
          source,
          bg,
          ref,
          mimeType,
          exportQuality / 100,
          originalImgElement
        );
        if (composited.detectedBgColor) {
          setDetectedBgColor(composited.detectedBgColor);
        }
        if (composited.detectedMode) {
          setDetectedSubjectMode(composited.detectedMode);
        }
        if (compositedUrl) URL.revokeObjectURL(compositedUrl);
        setCompositedBlob(composited.blob);
        setCompositedUrl(composited.url);

        if (composited.diagnostics) {
          setDiagnosticsInfo((prev) =>
            prev
              ? {
                  ...prev,
                  postprocessTimeMs: Math.round(performance.now() - tStart),
                  rawMaskUrl: composited.diagnostics?.rawMaskUrl ?? prev.rawMaskUrl,
                  resizedMaskUrl: composited.diagnostics?.rawMaskUrl ?? prev.resizedMaskUrl,
                  stage2MaskUrl: composited.diagnostics?.stage2MaskUrl ?? prev.stage2MaskUrl,
                  stage3MaskUrl: composited.diagnostics?.stage3MaskUrl ?? prev.stage3MaskUrl,
                  stage4CutoutUrl: composited.diagnostics?.stage4CutoutUrl ?? prev.stage4CutoutUrl,
                  originalUrl: originalUrl || prev.originalUrl,
                  imageDimensions: { width: composited.width, height: composited.height },
                  lowConfidenceWarning: composited.diagnostics?.lowConfidenceWarning,
                }
              : null
          );
        }
      } catch (err) {
        console.error('Failed to update composite canvas:', err);
      }
    },
    [workingCanvas, rawAiBlob, originalImgElement, compositedUrl, exportQuality, undoStack.length]
  );

  const handleColorChange = (colorValue: string, isTrans: boolean = false) => {
    const newSettings: BackgroundSettings = {
      type: isTrans ? 'transparent' : 'color',
      color: isTrans ? '#ffffff' : colorValue,
    };
    setBgSettings(newSettings);
    if (!isTrans) {
      setCustomHex(colorValue);
    }
    updateCompositing(workingCanvas, newSettings, refinements, exportFormat);
  };

  const handleRefinementChange = <K extends keyof RefinementSettings>(key: K, value: RefinementSettings[K]) => {
    const updated = { ...refinements, [key]: value };
    setRefinements(updated);
    updateCompositing(workingCanvas, bgSettings, updated, exportFormat);
  };

  // Sample image triggers
  const loadSample = async (type: 'bridal' | 'portrait' | 'sneaker' | 'pet') => {
    setErrorMessage(null);
    setProgressStage(`Generating high-res ${type} test image...`);
    setIsProcessing(true);
    setProgressPercent(10);

    const sampleBlob = await createSyntheticSample(type);
    const fileName = `sample-${type}.png`;
    const sampleFile = new File([sampleBlob], fileName, { type: 'image/png' });
    handleFileSelect(sampleFile);
  };

  // Slider interaction for Before/After
  const updateSliderPosition = (clientX: number) => {
    const frame = comparisonFrameRef.current || viewerContainerRef.current;
    if (!frame) return;
    const rect = frame.getBoundingClientRect();
    if (rect.width <= 0) return;
    const x = clientX - rect.left;
    const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPos(Math.round(pct * 10) / 10);
  };

  const handleSliderPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingSlider(true);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    updateSliderPosition(e.clientX);
  };

  const handleSliderPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingSlider) return;
    updateSliderPosition(e.clientX);
  };

  const handleSliderPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDraggingSlider) {
      setIsDraggingSlider(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
  };

  // Ensure dragging is released if user releases pointer anywhere
  useEffect(() => {
    const onWindowPointerUp = () => setIsDraggingSlider(false);
    window.addEventListener('pointerup', onWindowPointerUp);
    return () => window.removeEventListener('pointerup', onWindowPointerUp);
  }, []);

  // Map mouse coordinates inside container to image pixel coordinates
  const getCanvasCoords = (clientX: number, clientY: number): { x: number; y: number } | null => {
    if (!brushCanvasRef.current || !viewerContainerRef.current) return null;
    const canvas = brushCanvasRef.current;
    const rect = canvas.getBoundingClientRect();

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    if (x < 0 || y < 0 || x > canvas.width || y > canvas.height) return null;
    return { x, y };
  };

  // Keyboard shortcuts (Ctrl+Z / Cmd+Z, [ and ] for brush size)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if (e.key === '[') {
        e.preventDefault();
        setBrushSettings((s) => ({ ...s, size: Math.max(5, s.size - 5) }));
      } else if (e.key === ']') {
        e.preventDefault();
        setBrushSettings((s) => ({ ...s, size: Math.min(150, s.size + 5) }));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undoStack, redoStack, workingCanvas]);

  // Unified Mouse & Brush event handlers
  const handleContainerMouseDown = (e: React.MouseEvent) => {
    // If middle click, alt key, or pan mode is on, handle pan
    if (e.button === 1 || e.altKey || isPanMode) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
      return;
    }

    if (activeMode === 'brush') {
      handleBrushMouseDown(e);
    }
  };

  const handleContainerMouseMove = (e: React.MouseEvent) => {
    if (viewerContainerRef.current) {
      const containerRect = viewerContainerRef.current.getBoundingClientRect();
      setBrushCursorPos({
        x: e.clientX - containerRect.left,
        y: e.clientY - containerRect.top,
      });
    }

    if (isPanning) {
      setPanOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
      return;
    }

    if (activeMode === 'brush') {
      handleBrushMouseMove(e);
    }
  };

  const handleContainerMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
    }
    if (activeMode === 'brush') {
      handleBrushMouseUp();
    }
  };

  // Manual Brush event handlers
  const handleBrushMouseDown = (e: React.MouseEvent) => {
    if (activeMode !== 'brush' || !workingCanvas || !originalImgElement) return;

    const coords = getCanvasCoords(e.clientX, e.clientY);
    if (!coords) return;

    if (brushSettings.tool === 'select-point') {
      handleRefinementChange('subjectFocalPoint', coords);
      return;
    }

    const ctx = workingCanvas.getContext('2d');
    if (!ctx) return;

    // Push snapshot to undo stack before starting stroke
    const snapshot = ctx.getImageData(0, 0, workingCanvas.width, workingCanvas.height);
    setUndoStack((prev) => [...prev.slice(-15), snapshot]);
    setRedoStack([]);

    setIsBrushing(true);
    setLastBrushPos(coords);

    paintBrushStroke(
      ctx,
      originalImgElement,
      coords,
      coords,
      brushSettings.tool === 'restore' ? 'restore' : 'erase',
      brushSettings.size,
      brushSettings.hardness,
      brushSettings.opacity
    );

    // Sync preview canvas
    if (brushCanvasRef.current) {
      const bCtx = brushCanvasRef.current.getContext('2d');
      if (bCtx) {
        bCtx.clearRect(0, 0, brushCanvasRef.current.width, brushCanvasRef.current.height);
        bCtx.drawImage(workingCanvas, 0, 0);
      }
    }
  };

  const handleBrushMouseMove = (e: React.MouseEvent) => {
    if (activeMode !== 'brush' || !isBrushing || !workingCanvas || !originalImgElement || !lastBrushPos) return;

    const coords = getCanvasCoords(e.clientX, e.clientY);
    if (!coords) return;

    const ctx = workingCanvas.getContext('2d');
    if (!ctx) return;

    paintBrushStroke(
      ctx,
      originalImgElement,
      lastBrushPos,
      coords,
      brushSettings.tool === 'restore' ? 'restore' : 'erase',
      brushSettings.size,
      brushSettings.hardness,
      brushSettings.opacity
    );

    setLastBrushPos(coords);

    if (brushCanvasRef.current) {
      const bCtx = brushCanvasRef.current.getContext('2d');
      if (bCtx) {
        bCtx.clearRect(0, 0, brushCanvasRef.current.width, brushCanvasRef.current.height);
        bCtx.drawImage(workingCanvas, 0, 0);
      }
    }
  };

  const handleBrushMouseUp = () => {
    if (isBrushing && workingCanvas) {
      setIsBrushing(false);
      setLastBrushPos(null);
      // Re-composite with updated brush canvas
      updateCompositing(workingCanvas, bgSettings, refinements, exportFormat);
    }
    setIsPanning(false);
  };

  // Undo / Redo for brush
  const handleUndo = () => {
    if (undoStack.length <= 1 || !workingCanvas) return;
    const ctx = workingCanvas.getContext('2d');
    if (!ctx) return;

    const currentImgData = ctx.getImageData(0, 0, workingCanvas.width, workingCanvas.height);
    const prevImgData = undoStack[undoStack.length - 1];
    const newUndo = undoStack.slice(0, -1);

    setUndoStack(newUndo);
    setRedoStack((prev) => [...prev, currentImgData]);

    ctx.putImageData(prevImgData, 0, 0);
    if (brushCanvasRef.current) {
      const bCtx = brushCanvasRef.current.getContext('2d');
      bCtx?.putImageData(prevImgData, 0, 0);
    }
    updateCompositing(workingCanvas, bgSettings, refinements, exportFormat);
  };

  const handleRedo = () => {
    if (redoStack.length === 0 || !workingCanvas) return;
    const ctx = workingCanvas.getContext('2d');
    if (!ctx) return;

    const nextImgData = redoStack[redoStack.length - 1];
    const newRedo = redoStack.slice(0, -1);
    const currentImgData = ctx.getImageData(0, 0, workingCanvas.width, workingCanvas.height);

    setUndoStack((prev) => [...prev, currentImgData]);
    setRedoStack(newRedo);

    ctx.putImageData(nextImgData, 0, 0);
    if (brushCanvasRef.current) {
      const bCtx = brushCanvasRef.current.getContext('2d');
      bCtx?.putImageData(nextImgData, 0, 0);
    }
    updateCompositing(workingCanvas, bgSettings, refinements, exportFormat);
  };

  // Reset brush edits to clean AI cutout
  const handleResetToAi = async () => {
    if (!rawAiBlob || !workingCanvas) return;
    const cleanRefinements = { ...refinements, subjectFocalPoint: null, subjectBoundingBox: null };
    const transparentCutout = await compositeImage(
      rawAiBlob,
      { type: 'transparent' },
      cleanRefinements,
      'image/png',
      1.0,
      originalImgElement
    );
    const img = await loadImage(transparentCutout.blob);
    const ctx = workingCanvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, workingCanvas.width, workingCanvas.height);
      ctx.drawImage(img, 0, 0);
      const snapshot = ctx.getImageData(0, 0, workingCanvas.width, workingCanvas.height);
      setUndoStack([snapshot]);
      setRedoStack([]);
      if (brushCanvasRef.current) {
        const bCtx = brushCanvasRef.current.getContext('2d');
        bCtx?.clearRect(0, 0, brushCanvasRef.current.width, brushCanvasRef.current.height);
        bCtx?.drawImage(img, 0, 0);
      }
    }
    setRefinements(cleanRefinements);
    updateCompositing(workingCanvas, bgSettings, cleanRefinements, exportFormat);
  };

  // Keep brushCanvasRef in sync when entering brush mode
  useEffect(() => {
    if (activeMode === 'brush' && workingCanvas && brushCanvasRef.current) {
      const canvas = brushCanvasRef.current;
      canvas.width = workingCanvas.width;
      canvas.height = workingCanvas.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(workingCanvas, 0, 0);
      }
    }
  }, [activeMode, workingCanvas]);

  // Global Keyboard Shortcuts for Interactive Brush (E: Erase, R: Restore, [: Smaller, ]: Larger, Ctrl+Z: Undo)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.key === 'e' || e.key === 'E') {
        setBrushSettings((s) => ({ ...s, tool: 'erase' }));
      } else if (e.key === 'r' || e.key === 'R') {
        setBrushSettings((s) => ({ ...s, tool: 'restore' }));
      } else if (e.key === 't' || e.key === 'T') {
        setBrushSettings((s) => ({ ...s, tool: 'select-point' }));
      } else if (e.key === '[') {
        setBrushSettings((s) => ({ ...s, size: Math.max(5, s.size - 5) }));
      } else if (e.key === ']') {
        setBrushSettings((s) => ({ ...s, size: Math.min(120, s.size + 5) }));
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        e.preventDefault();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
        handleRedo();
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undoStack.length, redoStack.length]);

  // Download export
  const handleDownload = () => {
    if (!compositedBlob && !rawAiBlob && !workingCanvas) return;
    const baseName = originalFile ? originalFile.name.replace(/\.[^/.]+$/, '') : 'bg-remover-pro';
    const extension = bgSettings.type === 'transparent' ? 'png' : exportFormat;
    const finalFileName = `${baseName}-no-bg.${extension}`;

    const blobToDownload = compositedBlob || rawAiBlob!;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blobToDownload);
    link.download = finalFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  };

  return (
    <div className="space-y-8">
      {/* Hero Header */}
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5" />
          <span>ISNet Salient Matting • Island Filter & Magic Brush</span>
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-white">
          Remove Backgrounds in Seconds.{' '}
          <span className="bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 bg-clip-text text-transparent">
            100% Free & Private.
          </span>
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300">
          State-of-the-art salient object extraction with disconnected island cleanup, anti-halo edge decontaminate,
          and a manual Erase/Restore brush for pixel-perfect cuts.
        </p>
      </div>

      {/* Main Upload / Editor Panel */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-xl shadow-purple-500/5 overflow-hidden transition-all">
        {!originalUrl ? (
          /* Empty / Upload State */
          <div className="p-8 sm:p-12">
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleFileSelect(e.dataTransfer.files[0]);
                }
              }}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-purple-200 dark:border-slate-700 hover:border-purple-500 dark:hover:border-purple-500 rounded-2xl p-10 sm:p-14 text-center cursor-pointer transition-all bg-purple-50/30 dark:bg-slate-800/40 hover:bg-purple-50/70 dark:hover:bg-slate-800/80 group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileSelect(e.target.files[0]);
                  }
                }}
              />
              <div className="w-16 h-16 rounded-2xl bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform shadow-inner">
                <UploadCloud className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
                Drop your photo here, or <span className="text-purple-600 dark:text-purple-400 underline underline-offset-4">browse</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-4">
                Supports JPG, PNG, and WebP. Original resolution preserved.
              </p>

              <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  100% Private (Zero server uploads)
                </span>
                <span className="flex items-center gap-1.5">
                  <FileCheck className="w-4 h-4 text-indigo-500" />
                  Original Resolution Export
                </span>
              </div>
            </div>

            {/* Quick Sample Selector */}
            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 text-center">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
                Or try with a sample photo instantly:
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={() => loadSample('portrait')}
                  className="px-4 py-2 rounded-xl text-xs font-medium border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-purple-50 hover:border-purple-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-all flex items-center gap-2 shadow-sm"
                >
                  <span className="w-2 h-2 rounded-full bg-pink-500"></span>
                  Portrait with Fine Hair
                </button>
                <button
                  onClick={() => loadSample('bridal')}
                  className="px-4 py-2 rounded-xl text-xs font-medium border border-rose-200 dark:border-rose-800/60 bg-rose-50/70 dark:bg-rose-950/30 hover:bg-rose-100 hover:border-rose-400 text-rose-800 dark:text-rose-200 transition-all flex items-center gap-2 shadow-sm"
                >
                  <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse"></span>
                  Bridal Veil & Jewellery
                </button>
                <button
                  onClick={() => loadSample('sneaker')}
                  className="px-4 py-2 rounded-xl text-xs font-medium border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-purple-50 hover:border-purple-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-all flex items-center gap-2 shadow-sm"
                >
                  <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                  E-Commerce Product
                </button>
                <button
                  onClick={() => loadSample('pet')}
                  className="px-4 py-2 rounded-xl text-xs font-medium border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-purple-50 hover:border-purple-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-all flex items-center gap-2 shadow-sm"
                >
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  Pet with Fur Edges
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Active Editing / Processing Workspace */
          <div className="flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-800">
            {/* Left / Center: Interactive Preview Canvas */}
            <div className="flex-1 p-6 flex flex-col justify-between space-y-4">
              {/* Header Info Bar & Mode Switcher */}
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                {/* Mode Selector & Quick Presets */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex rounded-xl p-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold">
                    <button
                      onClick={() => setActiveMode('compare')}
                      className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                        activeMode === 'compare'
                          ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-sm'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Before / After View</span>
                    </button>
                    <button
                      onClick={() => setActiveMode('brush')}
                      className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                        activeMode === 'brush'
                          ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-sm'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      <Paintbrush className="w-3.5 h-3.5" />
                      <span>Magic Touch-Up Brush</span>
                    </button>
                  </div>

                  {/* Preset slider percentages for instant testing & inspection (0%, 25%, 50%, 75%, 100%) */}
                  {activeMode === 'compare' && (
                    <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/90 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                      <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase px-1">Slider:</span>
                      {[
                        { label: '0%', val: 0, title: '0% (AI Cutout Only)' },
                        { label: '25%', val: 25, title: '25% Before / 75% After' },
                        { label: '50%', val: 50, title: '50% Split View' },
                        { label: '75%', val: 75, title: '75% Before / 25% After' },
                        { label: '100%', val: 100, title: '100% (Original Photo Only)' },
                      ].map((preset) => (
                        <button
                          key={preset.val}
                          onClick={() => setSliderPos(preset.val)}
                          title={preset.title}
                          className={`px-2 py-0.5 rounded-lg text-[11px] font-mono font-medium transition-all ${
                            Math.round(sliderPos) === preset.val
                              ? 'bg-purple-600 text-white shadow-xs'
                              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  {originalDimensions && (
                    <span className="text-slate-500 px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-[11px] font-mono">
                      {originalDimensions.width} × {originalDimensions.height} px
                    </span>
                  )}

                  {/* Developer Debug Panel Button */}
                  <button
                    onClick={() => setShowDiagnostics(true)}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/30 transition-all shadow-xs cursor-pointer"
                    title="Open Developer Debug Panel: Inspect Original, Raw Model Mask, Resized Mask, Refined Mask, and Final Transparent Cutout"
                  >
                    <Activity className="w-3.5 h-3.5" />
                    <span>🔬 Developer Debug Panel</span>
                  </button>

                  {/* Reset / Choose Another */}
                  <button
                    onClick={() => {
                      if (originalUrl) URL.revokeObjectURL(originalUrl);
                      if (workingUrl) URL.revokeObjectURL(workingUrl);
                      if (compositedUrl) URL.revokeObjectURL(compositedUrl);
                      setOriginalUrl(null);
                      setOriginalFile(null);
                      setOriginalImgElement(null);
                      setOriginalDimensions(null);
                      setRawAiBlob(null);
                      setWorkingCanvas(null);
                      setWorkingUrl(null);
                      setCompositedBlob(null);
                      setCompositedUrl(null);
                      setUndoStack([]);
                      setRedoStack([]);
                    }}
                    className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>New Photo</span>
                  </button>
                </div>
              </div>

              {/* Viewer Window */}
              <div
                ref={viewerContainerRef}
                onMouseMove={handleContainerMouseMove}
                onMouseDown={handleContainerMouseDown}
                onMouseUp={handleContainerMouseUp}
                onMouseLeave={() => {
                  setBrushCursorPos(null);
                  if (isBrushing) handleBrushMouseUp();
                  if (isPanning) setIsPanning(false);
                }}
                className={`relative w-full aspect-[4/3] max-h-[540px] rounded-2xl overflow-hidden select-none border border-slate-200 dark:border-slate-800 shadow-inner flex items-center justify-center ${
                  isPanMode
                    ? isPanning
                      ? 'cursor-grabbing bg-slate-900/90'
                      : 'cursor-grab bg-slate-900/90'
                    : activeMode === 'brush'
                    ? 'bg-checkerboard cursor-crosshair'
                    : 'bg-slate-900/90'
                }`}
              >
                {/* Floating Screen-Accurate Brush Cursor Outline */}
                {activeMode === 'brush' && brushCursorPos && !isProcessing && !isPanning && !isPanMode && (
                  <div
                    className="pointer-events-none absolute rounded-full border-2 border-purple-500/90 bg-purple-500/15 -translate-x-1/2 -translate-y-1/2 z-40 transition-none shadow-sm"
                    style={{
                      left: brushCursorPos.x,
                      top: brushCursorPos.y,
                      width: Math.max(
                        6,
                        brushCanvasRef.current && brushCanvasRef.current.width > 0
                          ? (brushSettings.size / brushCanvasRef.current.width) *
                              brushCanvasRef.current.getBoundingClientRect().width
                          : brushSettings.size * zoomLevel
                      ),
                      height: Math.max(
                        6,
                        brushCanvasRef.current && brushCanvasRef.current.width > 0
                          ? (brushSettings.size / brushCanvasRef.current.width) *
                              brushCanvasRef.current.getBoundingClientRect().width
                          : brushSettings.size * zoomLevel
                      ),
                    }}
                  />
                )}

                {isProcessing ? (
                  /* Loading Progress Screen */
                  <div className="absolute inset-0 bg-white/95 dark:bg-slate-900/95 flex flex-col items-center justify-center p-6 text-center z-30 backdrop-blur-sm">
                    <div className="relative w-16 h-16 mb-4">
                      <div className="absolute inset-0 rounded-full border-4 border-purple-200 dark:border-purple-950 animate-pulse"></div>
                      <div className="absolute inset-0 rounded-full border-4 border-purple-600 border-t-transparent animate-spin"></div>
                      <Sparkles className="w-6 h-6 text-purple-600 absolute inset-0 m-auto" />
                    </div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-base mb-1">
                      {progressStage || 'Processing Neural Mask...'}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 max-w-sm">
                      {progressDetail || 'Running in-browser AI segmentation model'}
                    </p>

                    {/* Progress Bar */}
                    <div className="w-64 max-w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden border border-slate-200 dark:border-slate-700">
                      <div
                        className="bg-gradient-to-r from-purple-600 to-indigo-600 h-full rounded-full transition-all duration-300"
                        style={{ width: `${progressPercent}%` }}
                      ></div>
                    </div>
                    <span className="text-[11px] font-mono text-purple-600 dark:text-purple-400 mt-2 font-semibold">
                      {progressPercent}% Complete
                    </span>
                  </div>
                ) : null}

                {/* Error Banner */}
                {errorMessage && (
                  <div className="absolute inset-0 bg-white/95 dark:bg-slate-900/95 flex flex-col items-center justify-center p-6 text-center z-30">
                    <AlertCircle className="w-10 h-10 text-rose-500 mb-3" />
                    <h4 className="font-bold text-slate-900 dark:text-white text-base mb-1">
                      Processing Issue
                    </h4>
                    <p className="text-xs text-rose-600 dark:text-rose-400 max-w-md mb-4">
                      {errorMessage}
                    </p>
                    <button
                      onClick={() => originalFile && startBackgroundRemoval(originalFile)}
                      className="px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 text-white hover:bg-purple-700 transition-colors shadow-sm flex items-center gap-2"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Retry Background Removal
                    </button>
                  </div>
                )}

                {/* Compare Mode (Before / After Slider) */}
                {activeMode === 'compare' && compositedUrl && originalUrl && (
                  <div
                    className="relative w-full h-full flex items-center justify-center overflow-hidden p-3"
                    style={{
                      transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
                      transformOrigin: 'center center',
                    }}
                  >
                    <div
                      ref={comparisonFrameRef}
                      className="relative inline-block max-w-full max-h-full select-none shadow-2xl rounded-xl overflow-hidden cursor-ew-resize border border-slate-700/60"
                      onPointerDown={handleSliderPointerDown}
                      onPointerMove={handleSliderPointerMove}
                      onPointerUp={handleSliderPointerUp}
                      onPointerCancel={handleSliderPointerUp}
                    >
                      {/* Sizing Anchor Image - establishes exact natural bounds */}
                      <img
                        src={compositedUrl}
                        alt=""
                        aria-hidden="true"
                        className="max-w-full max-h-[500px] w-auto h-auto block opacity-0 pointer-events-none"
                        draggable={false}
                      />

                      {/* Processed (After) Layer - RIGHT side */}
                      {/* Checkerboard background exists ONLY on this layer and reveals through cut-out transparency */}
                      <div
                        className="absolute inset-0 bg-checkerboard overflow-hidden pointer-events-none"
                        style={{
                          clipPath: `polygon(${sliderPos}% 0, 100% 0, 100% 100%, ${sliderPos}% 100%)`,
                        }}
                      >
                        <img
                          src={compositedUrl}
                          alt="After (AI Cutout)"
                          className="w-full h-full object-contain block pointer-events-none"
                          draggable={false}
                        />
                      </div>

                      {/* Original (Before) Layer - LEFT side */}
                      {/* Displays the unedited original image with original background intact - ZERO checkerboard! */}
                      <div
                        className="absolute inset-0 bg-slate-950 overflow-hidden pointer-events-none"
                        style={{
                          clipPath: `polygon(0 0, ${sliderPos}% 0, ${sliderPos}% 100%, 0 100%)`,
                        }}
                      >
                        <img
                          src={originalUrl}
                          alt="Before (Original Photo)"
                          className="w-full h-full object-contain block pointer-events-none"
                          draggable={false}
                        />
                      </div>

                      {/* Divider Line & Interactive Handle */}
                      <div
                        className="absolute top-0 bottom-0 pointer-events-none z-20 flex items-center justify-center"
                        style={{
                          left: `${sliderPos}%`,
                          transform: 'translateX(-50%)',
                        }}
                      >
                        {/* Divider Bar */}
                        <div className="w-[2px] h-full bg-white shadow-[0_0_8px_rgba(0,0,0,0.8)]" />

                        {/* Interactive Handle */}
                        <div
                          className="absolute w-9 h-9 rounded-full bg-white text-slate-900 shadow-xl border-2 border-purple-600 flex items-center justify-center cursor-ew-resize hover:scale-110 active:scale-95 transition-transform"
                          title={`Slider position: ${Math.round(sliderPos)}%`}
                        >
                          <div className="flex items-center gap-0.5 text-purple-600">
                            <ChevronLeft className="w-3.5 h-3.5 -mr-1 stroke-[3]" />
                            <ChevronRight className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Brush Mode Canvas */}
                {activeMode === 'brush' && (
                  <div
                    className="relative w-full h-full flex items-center justify-center overflow-hidden"
                    style={{
                      transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
                      transformOrigin: 'center center',
                    }}
                  >
                    <canvas
                      ref={brushCanvasRef}
                      className="max-w-full max-h-full object-contain block shadow-sm"
                    />
                  </div>
                )}

                {/* Zoom Controls Overlay */}
                <div className="absolute bottom-3 right-3 z-20 flex items-center gap-1 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-2 py-1 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm text-xs">
                  <button
                    onClick={() => setIsPanMode(!isPanMode)}
                    className={`p-1.5 rounded-lg transition-colors flex items-center gap-1 ${
                      isPanMode
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-purple-600'
                    }`}
                    title={isPanMode ? 'Pan Mode Active (Drag to Pan)' : 'Pan Tool (Drag to inspect zoomed areas)'}
                  >
                    <Hand className="w-3.5 h-3.5" />
                    <span className="text-[11px] font-medium hidden sm:inline">Pan</span>
                  </button>
                  <div className="h-4 w-px bg-slate-200 dark:border-slate-700 mx-0.5" />
                  <button
                    onClick={() => setZoomLevel((z) => Math.max(0.5, Math.round((z - 0.25) * 100) / 100))}
                    className="p-1 hover:text-purple-600 dark:hover:text-purple-400"
                    title="Zoom Out"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="font-mono px-1 min-w-[38px] text-center">{Math.round(zoomLevel * 100)}%</span>
                  <button
                    onClick={() => setZoomLevel((z) => Math.min(3, Math.round((z + 0.25) * 100) / 100))}
                    className="p-1 hover:text-purple-600 dark:hover:text-purple-400"
                    title="Zoom In"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      setZoomLevel(1);
                      setPanOffset({ x: 0, y: 0 });
                      setIsPanMode(false);
                    }}
                    className="p-1 hover:text-purple-600 dark:hover:text-purple-400 ml-1 border-l pl-2 border-slate-200 dark:border-slate-700"
                    title="Reset Zoom & Pan"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Top Labels */}
                {activeMode === 'compare' ? (
                  <>
                    <div className="absolute top-3 left-3 z-20 px-2 py-1 rounded-md bg-black/60 text-white text-[10px] font-bold tracking-wide uppercase pointer-events-none backdrop-blur-xs">
                      Before (Original)
                    </div>
                    <div className="absolute top-3 right-3 z-20 px-2 py-1 rounded-md bg-purple-600/90 text-white text-[10px] font-bold tracking-wide uppercase pointer-events-none backdrop-blur-xs">
                      After (AI Cutout)
                    </div>
                  </>
                ) : (
                  <div className="absolute top-3 left-3 z-20 px-2.5 py-1 rounded-md bg-purple-600 text-white text-[10px] font-bold tracking-wide flex items-center gap-1.5 shadow-sm">
                    <Paintbrush className="w-3 h-3" />
                    <span>Touch-Up Brush Active • {brushSettings.tool === 'erase' ? 'Erase Mode' : 'Restore Mode'}</span>
                  </div>
                )}
              </div>

              {/* Instructions Bar */}
              <div className="text-center text-xs text-slate-500 dark:text-slate-400 flex items-center justify-center gap-2">
                {activeMode === 'compare' ? (
                  <span>Drag the slider handle left & right to inspect edges and fine details.</span>
                ) : (
                  <span>
                    Click and paint over the image to {brushSettings.tool === 'erase' ? 'erase unwanted grass/flowers' : 'restore cut parts'}.
                  </span>
                )}
              </div>
            </div>

            {/* Right: Controls & Export Sidebar */}
            <div className="w-full lg:w-96 p-6 space-y-6 bg-slate-50/50 dark:bg-slate-900/50">
              {/* Brush Toolbar if active */}
              {activeMode === 'brush' && (
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-purple-200 dark:border-purple-900 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300 flex items-center gap-1.5">
                      <Paintbrush className="w-3.5 h-3.5 text-purple-600" />
                      Manual Correction Brush
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={handleUndo}
                        disabled={undoStack.length <= 1}
                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40"
                        title="Undo stroke"
                      >
                        <Undo2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={handleRedo}
                        disabled={redoStack.length === 0}
                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40"
                        title="Redo stroke"
                      >
                        <Redo2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Tool Switcher: Erase vs Restore vs Target */}
                  <div className="grid grid-cols-3 gap-1.5 text-xs font-semibold">
                    <button
                      onClick={() => setBrushSettings((s) => ({ ...s, tool: 'erase' }))}
                      title="Erase unwanted background fragments, trees, flowers (Shortcut: E)"
                      className={`py-2 px-2 rounded-xl border flex items-center justify-center gap-1 transition-all ${
                        brushSettings.tool === 'erase'
                          ? 'border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300 font-bold ring-2 ring-rose-500/20'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                      }`}
                    >
                      <Eraser className="w-3.5 h-3.5 text-rose-500" />
                      <span>Erase [E]</span>
                    </button>
                    <button
                      onClick={() => setBrushSettings((s) => ({ ...s, tool: 'restore' }))}
                      title="Restore subject parts, fur, or jewellery (Shortcut: R)"
                      className={`py-2 px-2 rounded-xl border flex items-center justify-center gap-1 transition-all ${
                        brushSettings.tool === 'restore'
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 font-bold ring-2 ring-emerald-500/20'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                      }`}
                    >
                      <Paintbrush className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Keep [R]</span>
                    </button>
                    <button
                      onClick={() => setBrushSettings((s) => ({ ...s, tool: 'select-point' }))}
                      title="Click on the main subject (dog, bride, person) to set focal seed (Shortcut: T)"
                      className={`py-2 px-2 rounded-xl border flex items-center justify-center gap-1 transition-all ${
                        brushSettings.tool === 'select-point'
                          ? 'border-purple-500 bg-purple-50 text-purple-700 dark:bg-purple-950/70 dark:text-purple-300 font-bold ring-2 ring-purple-500/20'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                      <span>Target [T]</span>
                    </button>
                  </div>

                  {(undoStack.length > 1 || refinements.subjectFocalPoint) && (
                    <button
                      onClick={handleResetToAi}
                      className="w-full py-1.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-[11px] font-medium text-slate-600 dark:text-slate-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset Brush Edits to Clean AI</span>
                    </button>
                  )}

                  {/* Brush Size */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-slate-600 dark:text-slate-400">
                      <span>Brush Size</span>
                      <span className="font-mono">{brushSettings.size}px</span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="120"
                      value={brushSettings.size}
                      onChange={(e) => setBrushSettings((s) => ({ ...s, size: parseInt(e.target.value, 10) }))}
                      className="w-full accent-purple-600"
                    />
                  </div>

                  {/* Brush Hardness */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-slate-600 dark:text-slate-400">
                      <span>Edge Softness / Hardness</span>
                      <span className="font-mono">{Math.round(brushSettings.hardness * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="1.0"
                      step="0.05"
                      value={brushSettings.hardness}
                      onChange={(e) => setBrushSettings((s) => ({ ...s, hardness: parseFloat(e.target.value) }))}
                      className="w-full accent-purple-600"
                    />
                  </div>

                  {/* Brush Opacity (for translucent fabrics/veils) */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-slate-600 dark:text-slate-400">
                      <span>Brush Opacity (Translucency)</span>
                      <span className="font-mono">{Math.round(brushSettings.opacity * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="1.0"
                      step="0.05"
                      value={brushSettings.opacity}
                      onChange={(e) => setBrushSettings((s) => ({ ...s, opacity: parseFloat(e.target.value) }))}
                      className="w-full accent-purple-600"
                    />
                    <p className="text-[10px] text-slate-400">Use 30%-60% opacity to restore sheer veils and lace with authentic translucency.</p>
                  </div>

                  <button
                    onClick={handleResetToAi}
                    className="w-full py-1.5 text-[11px] font-semibold text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 flex items-center justify-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset to AI Cutout</span>
                  </button>
                </div>
              )}

              {/* Subject Segmentation Mode Selector */}
              <div className="space-y-2.5 p-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                    <span>Segmentation Mode</span>
                  </label>
                  <span className="text-[10px] font-semibold text-purple-700 dark:text-purple-300 bg-purple-100/70 dark:bg-purple-950/80 px-2 py-0.5 rounded-full border border-purple-200 dark:border-purple-800 capitalize">
                    {refinements.subjectMode === 'auto' ? `Auto: ${detectedSubjectMode}` : refinements.subjectMode}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    { id: 'auto' as SubjectMode, label: 'Auto Detect', icon: Sparkles, desc: 'Smart AI routing' },
                    { id: 'portrait' as SubjectMode, label: 'People / Portrait', icon: User, desc: 'Hair, veil & skin' },
                    { id: 'pet' as SubjectMode, label: 'Animals & Pets', icon: Dog, desc: 'Fur, paws & lawn prune' },
                    { id: 'product' as SubjectMode, label: 'Products & Objects', icon: Package, desc: 'Sharp edges & items' },
                  ].map((modeItem) => {
                    const isSelected = (refinements.subjectMode || 'auto') === modeItem.id;
                    const Icon = modeItem.icon;
                    return (
                      <button
                        key={modeItem.id}
                        type="button"
                        onClick={() => handleRefinementChange('subjectMode', modeItem.id)}
                        className={`p-2 rounded-xl border text-left flex flex-col transition-all ${
                          isSelected
                            ? 'border-purple-600 bg-purple-50/90 dark:bg-purple-950/70 ring-2 ring-purple-600/30'
                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-slate-50/50 dark:bg-slate-900/40'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-100">
                          <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-purple-600 dark:text-purple-400' : 'text-slate-400'}`} />
                          <span className="text-[11px] leading-tight">{modeItem.label}</span>
                        </div>
                        <span className="text-[9px] text-slate-500 mt-0.5">{modeItem.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Background Color Switcher */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                    <span>Background Replacement</span>
                  </label>
                  <span className="text-[11px] text-slate-500">Instant Canvas</span>
                </div>

                {/* Color Swatches Grid */}
                <div className="grid grid-cols-5 gap-2">
                  {PRESET_COLORS.map((preset) => {
                    const isSelected =
                      preset.isTransparent
                        ? bgSettings.type === 'transparent'
                        : bgSettings.type === 'color' && bgSettings.color?.toLowerCase() === preset.value.toLowerCase();

                    return (
                      <button
                        key={preset.name}
                        onClick={() => handleColorChange(preset.value, preset.isTransparent)}
                        title={preset.name}
                        className={`h-9 rounded-xl border flex items-center justify-center transition-all relative ${
                          preset.isTransparent ? 'bg-checkerboard' : ''
                        } ${
                          isSelected
                            ? 'ring-2 ring-purple-600 ring-offset-2 dark:ring-offset-slate-900 border-purple-600 scale-105'
                            : 'border-slate-200 dark:border-slate-700 hover:scale-102'
                        }`}
                        style={!preset.isTransparent ? { backgroundColor: preset.value } : {}}
                      >
                        {isSelected && (
                          <Check
                            className={`w-4 h-4 ${
                              preset.value === '#ffffff' || preset.value === '#f1f5f9'
                                ? 'text-slate-900'
                                : 'text-white'
                            }`}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Custom Hex Input */}
                <div className="flex items-center gap-2 pt-1">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">#</span>
                    <input
                      type="text"
                      value={customHex.replace('#', '')}
                      onChange={(e) => {
                        const hex = `#${e.target.value.replace(/[^0-9A-Fa-f]/g, '').slice(0, 6)}`;
                        setCustomHex(hex);
                        if (hex.length === 7) {
                          handleColorChange(hex, false);
                        }
                      }}
                      placeholder="ffffff"
                      className="w-full pl-7 pr-3 py-1.5 rounded-lg text-xs font-mono border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
                    />
                  </div>
                  <input
                    type="color"
                    value={customHex.startsWith('#') && customHex.length === 7 ? customHex : '#ffffff'}
                    onChange={(e) => handleColorChange(e.target.value, false)}
                    className="w-9 h-8 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer bg-white dark:bg-slate-800"
                    title="Choose custom color"
                  />
                </div>
              </div>

              {/* Edge Refinements & Island Filter Drawer */}
              <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  onClick={() => setShowRefinements(!showRefinements)}
                  className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 hover:text-purple-600 dark:hover:text-purple-400"
                >
                  <span className="flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-indigo-500" />
                    Accuracy & Edge Refinements
                  </span>
                  <span className="text-[11px] font-normal lowercase text-purple-600 dark:text-purple-400">
                    {showRefinements ? 'Hide' : 'Tune'}
                  </span>
                </button>

                {showRefinements && (
                  <div className="space-y-4 pt-2 text-xs">
                    {/* Disconnected Island Filter */}
                    <div className="p-3 rounded-xl bg-purple-50/50 dark:bg-slate-800/80 border border-purple-100 dark:border-slate-700 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                          <Filter className="w-3.5 h-3.5 text-purple-600" />
                          Prune Stray Objects (Flowers/Grass)
                        </span>
                        <input
                          type="checkbox"
                          checked={refinements.removeStrayFragments}
                          onChange={(e) => handleRefinementChange('removeStrayFragments', e.target.checked)}
                          className="accent-purple-600 h-4 w-4"
                        />
                      </div>
                      {refinements.removeStrayFragments && (
                        <div>
                          <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                            <span>Pruning Sensitivity</span>
                            <span className="font-mono">{refinements.fragmentThreshold}%</span>
                          </div>
                          <input
                            type="range"
                            min="1"
                            max="15"
                            value={refinements.fragmentThreshold}
                            onChange={(e) => handleRefinementChange('fragmentThreshold', parseInt(e.target.value, 10))}
                            className="w-full accent-purple-600"
                          />
                        </div>
                      )}
                    </div>

                    {/* Primary Subject Isolation (Outdoor Animals & Complex Scenes) */}
                    <div className="p-3 rounded-xl bg-purple-50/50 dark:bg-slate-800/80 border border-purple-100 dark:border-slate-700 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                            <Dog className="w-3.5 h-3.5 text-purple-600" />
                            Primary Subject Isolation
                          </span>
                          <p className="text-[10px] text-slate-500">Separates foreground subject from garden trees, flowers, grass & fences</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={refinements.isolatePrimarySubject ?? true}
                          onChange={(e) => handleRefinementChange('isolatePrimarySubject', e.target.checked)}
                          className="accent-purple-600 h-4 w-4"
                        />
                      </div>

                      {refinements.isolatePrimarySubject !== false && (
                        <div className="space-y-2.5 pt-1 border-t border-purple-100 dark:border-slate-700">
                          {/* Subject Mode Selector */}
                          <div>
                            <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300 block mb-1">
                              Target Subject Mode
                            </span>
                            <div className="grid grid-cols-2 gap-1 font-medium text-[11px]">
                              {[
                                { id: 'auto', label: refinements.subjectMode === 'auto' ? `Auto (${detectedSubjectMode})` : 'Auto Detect', icon: Sparkles },
                                { id: 'animal', label: 'Animal / Pet', icon: Dog },
                                { id: 'portrait', label: 'Person / Portrait', icon: User },
                                { id: 'product', label: 'Product / Object', icon: Package },
                              ].map((m) => {
                                const IconComponent = m.icon;
                                const isSelected = (refinements.subjectMode || 'auto') === m.id;
                                return (
                                  <button
                                    key={m.id}
                                    type="button"
                                    onClick={() => handleRefinementChange('subjectMode', m.id as SubjectMode)}
                                    className={`py-1.5 px-2 rounded-lg border flex items-center justify-center gap-1.5 transition-all ${
                                      isSelected
                                        ? 'bg-purple-600 text-white border-purple-600 shadow-xs font-semibold'
                                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
                                    }`}
                                  >
                                    <IconComponent className="w-3 h-3" />
                                    <span className="truncate">{m.label}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Confidence Threshold */}
                          <div>
                            <div className="flex justify-between text-[11px] text-slate-600 dark:text-slate-300 mb-1">
                              <span>Subject Core Confidence</span>
                              <span className="font-mono font-bold text-purple-600 dark:text-purple-400">
                                {refinements.confidenceThreshold ?? 70}%
                              </span>
                            </div>
                            <input
                              type="range"
                              min="50"
                              max="90"
                              step="5"
                              value={refinements.confidenceThreshold ?? 70}
                              onChange={(e) => handleRefinementChange('confidenceThreshold', parseInt(e.target.value, 10))}
                              className="w-full accent-purple-600"
                            />
                            <p className="text-[9px] text-slate-400 font-mono mt-0.5">
                              Higher = strictly isolates animal/person, breaks lawn connectivity
                            </p>
                          </div>

                          {/* Matting Sensitivity */}
                          <div>
                            <div className="flex justify-between text-[11px] text-slate-600 dark:text-slate-300 mb-1">
                              <span>Boundary Fur / Edge Sensitivity</span>
                              <span className="font-mono font-bold text-purple-600 dark:text-purple-400">
                                {refinements.mattingSensitivity ?? 50}%
                              </span>
                            </div>
                            <input
                              type="range"
                              min="10"
                              max="90"
                              step="5"
                              value={refinements.mattingSensitivity ?? 50}
                              onChange={(e) => handleRefinementChange('mattingSensitivity', parseInt(e.target.value, 10))}
                              className="w-full accent-purple-600"
                            />
                          </div>

                          {/* Active Focal Point status if selected */}
                          {refinements.subjectFocalPoint && (
                            <div className="flex items-center justify-between p-2 rounded-lg bg-purple-100/70 dark:bg-purple-950/40 text-[11px] text-purple-800 dark:text-purple-300">
                              <span className="flex items-center gap-1 font-mono">
                                🎯 Focal Target: ({Math.round(refinements.subjectFocalPoint.x)}, {Math.round(refinements.subjectFocalPoint.y)})
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRefinementChange('subjectFocalPoint', null)}
                                className="text-[10px] font-bold text-purple-600 dark:text-purple-400 underline hover:no-underline"
                              >
                                Clear
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Animal Fur & Whiskers Preservation */}
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-purple-50/40 dark:bg-slate-800/60 border border-purple-100 dark:border-slate-700">
                      <div>
                        <span className="text-slate-800 dark:text-slate-200 font-medium flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                          Preserve Fine Fur & Whiskers
                        </span>
                        <p className="text-[10px] text-slate-500">Soft alpha contour for animal coats, paws, tails, and flyaway hair</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={refinements.furPreservation ?? true}
                        onChange={(e) => handleRefinementChange('furPreservation', e.target.checked)}
                        className="accent-purple-600 h-4 w-4"
                      />
                    </div>

                    {/* Ground & Lawn Spill Suppression */}
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-purple-50/40 dark:bg-slate-800/60 border border-purple-100 dark:border-slate-700">
                      <div>
                        <span className="text-slate-800 dark:text-slate-200 font-medium">Ground & Lawn Spill Suppression</span>
                        <p className="text-[10px] text-slate-500">Eliminates lateral grass carpet outside animal paws</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={refinements.groundSuppression ?? true}
                        onChange={(e) => handleRefinementChange('groundSuppression', e.target.checked)}
                        className="accent-purple-600 h-4 w-4"
                      />
                    </div>

                    {/* Translucent Fabrics / Veil Boost */}
                    <div className="p-3 rounded-xl bg-purple-50/50 dark:bg-slate-800/80 border border-purple-100 dark:border-slate-700 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                            Preserve Translucent Veil & Lace
                          </span>
                          <p className="text-[10px] text-slate-500">Maintains genuine soft alpha transparency instead of binary clipping</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={refinements.preserveTranslucency}
                          onChange={(e) => handleRefinementChange('preserveTranslucency', e.target.checked)}
                          className="accent-purple-600 h-4 w-4"
                        />
                      </div>
                      {refinements.preserveTranslucency && (
                        <div>
                          <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                            <span>Veil & Netting Recovery Lift</span>
                            <span className="font-mono">{refinements.veilBoost > 0 ? `+${refinements.veilBoost}` : refinements.veilBoost}%</span>
                          </div>
                          <input
                            type="range"
                            min="-30"
                            max="50"
                            value={refinements.veilBoost}
                            onChange={(e) => handleRefinementChange('veilBoost', parseInt(e.target.value, 10))}
                            className="w-full accent-purple-600"
                          />
                        </div>
                      )}
                    </div>

                    {/* Protect Jewellery & Zari Embroidery */}
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/40">
                      <div>
                        <span className="text-slate-800 dark:text-slate-200 font-medium">Protect Jewellery & Zari Details</span>
                        <p className="text-[10px] text-slate-500">Locks gold necklace, maang tikka, earrings, and metallic embroidery from erosion</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={refinements.jewelleryGuard}
                        onChange={(e) => handleRefinementChange('jewelleryGuard', e.target.checked)}
                        className="accent-amber-600 h-4 w-4"
                      />
                    </div>

                    {/* Color Decontamination (Anti-Halo & Brown Studio Bleed) */}
                    <div className="p-3.5 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/50 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                            Background Color Decontamination
                          </span>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400">
                            Neutralizes brown/dark background color bleeding into semi-transparent veils & hair without touching skin tones
                          </p>
                        </div>
                        <input
                          type="checkbox"
                          checked={refinements.decontaminateEdges}
                          onChange={(e) => handleRefinementChange('decontaminateEdges', e.target.checked)}
                          className="accent-amber-600 h-4 w-4"
                        />
                      </div>

                      {refinements.decontaminateEdges && (
                        <div className="space-y-3 pt-1 border-t border-amber-200/40 dark:border-amber-800/30">
                          {/* Decontamination Strength Slider */}
                          <div>
                            <div className="flex justify-between text-[11px] text-slate-600 dark:text-slate-300 mb-1">
                              <span>Decontamination Strength</span>
                              <span className="font-mono font-bold text-amber-700 dark:text-amber-300">
                                {refinements.decontaminateStrength}%
                              </span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="100"
                              value={refinements.decontaminateStrength}
                              onChange={(e) => handleRefinementChange('decontaminateStrength', parseInt(e.target.value, 10))}
                              className="w-full accent-amber-600"
                            />
                            <div className="flex justify-between text-[9px] text-slate-400 font-mono mt-0.5">
                              <span>0% (Raw)</span>
                              <span>50% (Subtle)</span>
                              <span>100% (Full Neutralization)</span>
                            </div>
                          </div>

                          {/* Contaminated Background Color Swatch & Selection */}
                          <div className="space-y-1.5 pt-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-slate-700 dark:text-slate-300 font-medium flex items-center gap-1">
                                <Pipette className="w-3 h-3 text-amber-600" />
                                Contaminated Color to Neutralize:
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  handleRefinementChange('decontaminateBgColor', detectedBgColor);
                                  handleRefinementChange('autoDetectBgColor', true);
                                }}
                                className="text-[10px] text-amber-700 dark:text-amber-300 underline hover:no-underline font-medium"
                              >
                                Auto-Detect ({detectedBgColor})
                              </button>
                            </div>

                            <div className="flex items-center gap-2">
                              <div
                                className="w-7 h-7 rounded-lg border border-slate-300 dark:border-slate-600 shadow-xs flex-shrink-0"
                                style={{ backgroundColor: refinements.decontaminateBgColor || detectedBgColor }}
                                title={`Target backdrop color: ${refinements.decontaminateBgColor || detectedBgColor}`}
                              />
                              <input
                                type="text"
                                value={(refinements.decontaminateBgColor || detectedBgColor).toUpperCase()}
                                onChange={(e) => {
                                  const hex = e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`;
                                  handleRefinementChange('decontaminateBgColor', hex);
                                  handleRefinementChange('autoDetectBgColor', false);
                                }}
                                className="flex-1 px-2.5 py-1 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                                placeholder="#553728"
                              />
                              <input
                                type="color"
                                value={
                                  refinements.decontaminateBgColor && refinements.decontaminateBgColor.length === 7
                                    ? refinements.decontaminateBgColor
                                    : detectedBgColor
                                }
                                onChange={(e) => {
                                  handleRefinementChange('decontaminateBgColor', e.target.value);
                                  handleRefinementChange('autoDetectBgColor', false);
                                }}
                                className="w-8 h-7 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer bg-white dark:bg-slate-800"
                                title="Pick background color"
                              />
                            </div>

                            {/* Quick backdrop presets */}
                            <div className="flex flex-wrap items-center gap-1.5 pt-1">
                              <span className="text-[10px] text-slate-400">Backdrop:</span>
                              {[
                                { name: 'Studio Brown', color: '#553728' },
                                { name: 'Dark Studio', color: '#1f1a18' },
                                { name: 'Outdoor Green', color: '#2b472e' },
                                { name: 'Studio Grey', color: '#888888' },
                              ].map((bPreset) => (
                                <button
                                  key={bPreset.name}
                                  type="button"
                                  onClick={() => {
                                    handleRefinementChange('decontaminateBgColor', bPreset.color);
                                    handleRefinementChange('autoDetectBgColor', false);
                                  }}
                                  className={`px-2 py-0.5 rounded-md text-[10px] font-medium border flex items-center gap-1 transition-all ${
                                    (refinements.decontaminateBgColor || detectedBgColor).toLowerCase() ===
                                    bPreset.color.toLowerCase()
                                      ? 'border-amber-500 bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-200 font-bold'
                                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                                  }`}
                                >
                                  <span
                                    className="w-2 h-2 rounded-full border border-black/20"
                                    style={{ backgroundColor: bPreset.color }}
                                  />
                                  <span>{bPreset.name}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Edge shift (Choke / Expand) */}
                    <div>
                      <div className="flex justify-between text-[11px] mb-1 text-slate-600 dark:text-slate-400">
                        <span>Edge Shift (Boundary Choke)</span>
                        <span className="font-mono">
                          {refinements.edgeShift > 0 ? `+${refinements.edgeShift}` : refinements.edgeShift}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="-3"
                        max="5"
                        step="1"
                        value={refinements.edgeShift}
                        onChange={(e) => handleRefinementChange('edgeShift', parseInt(e.target.value, 10))}
                        className="w-full accent-purple-600"
                      />
                    </div>

                    {/* Feather / Edge Softness */}
                    <div>
                      <div className="flex justify-between text-[11px] mb-1 text-slate-600 dark:text-slate-400">
                        <span>Edge Feathering (Smooth Jaggies)</span>
                        <span className="font-mono">{refinements.feather}px</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="6"
                        step="1"
                        value={refinements.feather}
                        onChange={(e) => handleRefinementChange('feather', parseInt(e.target.value, 10))}
                        className="w-full accent-purple-600"
                      />
                    </div>

                    {/* Subject Brightness */}
                    <div>
                      <div className="flex justify-between text-[11px] mb-1 text-slate-600 dark:text-slate-400">
                        <span>Subject Brightness</span>
                        <span className="font-mono">{refinements.brightness}%</span>
                      </div>
                      <input
                        type="range"
                        min="-30"
                        max="30"
                        value={refinements.brightness}
                        onChange={(e) => handleRefinementChange('brightness', parseInt(e.target.value, 10))}
                        className="w-full accent-purple-600"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Hand-off to Passport Maker */}
              {(workingCanvas || rawAiBlob) && (
                <div className="p-3.5 rounded-2xl bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-pink-500/10 border border-purple-200 dark:border-purple-800/60 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-purple-900 dark:text-purple-200">
                    <ImageIcon className="w-4 h-4 text-purple-600" />
                    <span>Need a Passport or Visa Photo?</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    Transfer this cutout to the 35x45mm / 2x2" Passport Studio with printable photo sheets.
                  </p>
                  <button
                    onClick={() => {
                      if (compositedBlob && compositedUrl) {
                        onOpenInPassport(compositedBlob, compositedUrl);
                      } else if (rawAiBlob && workingUrl) {
                        onOpenInPassport(rawAiBlob, workingUrl);
                      }
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs transition-all shadow-sm flex items-center justify-center gap-2 group"
                  >
                    <span>Create Passport Photo</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              )}

              {/* Export Options & Download */}
              <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Export Format
                  </span>
                  <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-100 dark:bg-slate-800 text-[11px]">
                    <button
                      onClick={() => {
                        setExportFormat('png');
                        updateCompositing(workingCanvas, bgSettings, refinements, 'png');
                      }}
                      className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                        exportFormat === 'png'
                          ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-xs'
                          : 'text-slate-500'
                      }`}
                    >
                      PNG
                    </button>
                    <button
                      onClick={() => {
                        setExportFormat('jpeg');
                        updateCompositing(workingCanvas, bgSettings, refinements, 'jpeg');
                      }}
                      className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                        exportFormat === 'jpeg'
                          ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-xs'
                          : 'text-slate-500'
                      }`}
                    >
                      JPG
                    </button>
                    <button
                      onClick={() => {
                        setExportFormat('webp');
                        updateCompositing(workingCanvas, bgSettings, refinements, 'webp');
                      }}
                      className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                        exportFormat === 'webp'
                          ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-xs'
                          : 'text-slate-500'
                      }`}
                    >
                      WebP
                    </button>
                  </div>
                </div>

                {exportFormat !== 'png' && (
                  <div>
                    <div className="flex justify-between text-[11px] mb-1 text-slate-500">
                      <span>Quality</span>
                      <span>{exportQuality}%</span>
                    </div>
                    <input
                      type="range"
                      min="70"
                      max="100"
                      value={exportQuality}
                      onChange={(e) => {
                        setExportQuality(parseInt(e.target.value, 10));
                        updateCompositing(workingCanvas, bgSettings, refinements, exportFormat);
                      }}
                      className="w-full accent-purple-600"
                    />
                  </div>
                )}

                <button
                  disabled={!compositedBlob && !rawAiBlob && !workingCanvas}
                  onClick={handleDownload}
                  className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-700 hover:to-indigo-700 text-white font-bold text-sm shadow-md shadow-purple-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Transparent Cutout</span>
                </button>

                <p className="text-[11px] text-center text-slate-500 flex items-center justify-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Preview matches 100% of exported image pixels</span>
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Feature highlights bar below */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-2">
          <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 flex items-center justify-center">
            <Filter className="w-4 h-4" />
          </div>
          <h4 className="font-bold text-sm text-slate-900 dark:text-white">Stray Island Pruning</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Automated connected-component analysis eliminates stray grass, background flowers, and detached artifacts.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <h4 className="font-bold text-sm text-slate-900 dark:text-white">Anti-Halo & Decontamination</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Samples edge colors to neutralize green or white color bleeding on hair strands and delicate borders.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Paintbrush className="w-4 h-4" />
          </div>
          <h4 className="font-bold text-sm text-slate-900 dark:text-white">Manual Touch-Up Brush</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Erase stubborn background fragments or restore trimmed clothing/hair with undo and custom brush sizing.
          </p>
        </div>
      </div>

      {/* Diagnostics Modal for 4-Stage Mask and Latency Inspection */}
      <DiagnosticsModal
        isOpen={showDiagnostics}
        onClose={() => setShowDiagnostics(false)}
        diagnostics={diagnosticsInfo}
        originalUrl={originalUrl}
      />
    </div>
  );
};
