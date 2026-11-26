export interface ProcessedImageResult {
  id: string;
  name: string;
  originalUrl: string;
  originalWidth: number;
  originalHeight: number;
  originalSize: number;
  originalType: string;
  // Raw transparent PNG from AI segmentation
  transparentPngUrl: string;
  transparentBlob: Blob;
  // Final composited output with current background & refinements
  outputUrl: string;
  outputBlob: Blob;
  status: 'idle' | 'loading-model' | 'processing' | 'ready' | 'error';
  progress: number;
  progressMessage: string;
  errorMessage?: string;
  processedAt?: number;
}

export type BackgroundType = 'transparent' | 'color' | 'gradient';

export interface BackgroundSettings {
  type: BackgroundType;
  color?: string; // Hex string e.g. '#ffffff'
  gradient?: {
    color1: string;
    color2: string;
    angle: number;
  };
}

export type SubjectMode = 'auto' | 'portrait' | 'pet' | 'animal' | 'product';

export interface RefinementSettings {
  feather: number; // 0 to 8px (soft edge)
  edgeShift: number; // -5 to 5px (shrink/grow mask to cut halo)
  antiHalo: boolean; // Color bleed cleanup
  decontaminateStrength: number; // 0 to 100%
  decontaminateBgColor?: string; // Hex color of original background e.g. '#543825' (brown)
  autoDetectBgColor?: boolean; // Automatically sample background color from low-alpha border pixels
  removeStrayFragments: boolean; // Clean disconnected grass, flowers & background objects
  fragmentThreshold: number; // Min component area threshold (1% - 15%)
  subjectMode?: SubjectMode; // 'auto' | 'portrait' | 'pet' | 'product'
  isolatePrimarySubject?: boolean; // Isolate main subject and eliminate disconnected trees/gardens
  furPreservation?: boolean; // Preserve fine fur contour details, paws, whiskers
  groundSuppression?: boolean; // Suppress sprawling lawn/ground spill under paws
  decontaminateEdges: boolean; // Decontaminate background color bleed on edge pixels
  preserveTranslucency: boolean; // Preserves soft alpha on bridal veils, lace & net dupattas
  veilBoost: number; // -50 to +50: adjusts translucency curve for sheer fabrics
  jewelleryGuard: boolean; // Protects fine metallic embroidery and jewellery from being eroded
  brightness: number; // -50 to 50
  contrast: number; // -50 to 50
  subjectFocalPoint?: { x: number; y: number } | null; // User clicked focal point
  subjectBoundingBox?: { minX: number; maxX: number; minY: number; maxY: number } | null; // User-guided bounding box
  confidenceThreshold?: number; // 10 to 90% (alpha probability threshold)
  mattingSensitivity?: number; // 0 to 100% (color-affinity matting in transition band)
}

export type BrushTool = 'none' | 'erase' | 'restore' | 'select-point' | 'select-box';

export interface BrushSettings {
  tool: BrushTool;
  size: number; // 3 to 150 px
  hardness: number; // 0 (soft) to 1 (hard)
  opacity: number; // 0.1 to 1.0 (allows restoring sheer veils at partial opacity)
}

export interface PassportPreset {
  id: string;
  name: string;
  country: string;
  widthMm: number;
  heightMm: number;
  widthInches: number;
  heightInches: number;
  description: string;
  suggestedBgColor: string;
}

export type SheetSize = '4x6' | 'A4' | 'custom';

export interface PassportSettings {
  presetId: string;
  customWidthMm: number;
  customHeightMm: number;
  dpi: 300 | 600 | 150;
  backgroundColor: string;
  zoom: number; // 0.5 to 3
  offsetX: number; // pixels pan
  offsetY: number;
  rotation: number; // -45 to 45 deg
  showGuides: boolean;
  borderStroke: boolean;
  sheetSize: SheetSize;
  sheetCopies: number;
  sheetSpacingMm: number;
  sheetMarginMm: number;
  showCuttingMarks: boolean;
}

export interface BatchItem {
  id: string;
  file: File;
  name: string;
  size: number;
  originalUrl: string;
  dimensions?: { width: number; height: number };
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number;
  progressMessage: string;
  transparentPngUrl?: string;
  transparentBlob?: Blob;
  outputUrl?: string;
  outputBlob?: Blob;
  error?: string;
}

export interface DiagnosticsInfo {
  modelName: string;
  license: string;
  backend: string;
  inputSize: string;
  inferenceTimeMs: number;
  postprocessTimeMs: number;
  rawMaskUrl?: string;
  resizedMaskUrl?: string;
  stage2MaskUrl?: string;
  stage3MaskUrl?: string;
  stage4CutoutUrl?: string;
  originalUrl?: string;
  imageDimensions?: { width: number; height: number };
  tensorInputDims?: string;
  tensorOutputDims?: string;
  activeProvider?: string;
  lowConfidenceWarning?: boolean;
}

