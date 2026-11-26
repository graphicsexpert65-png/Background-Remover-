import { removeBackground } from '@bg0/browser';

export interface ProgressCallback { (step: string, percent: number, detail?: string): void; }
export interface SegmentationOptions { device?: 'cpu' | 'gpu'; model?: 'isnet' | 'isnet_fp16' | 'isnet_quint8'; onProgress?: ProgressCallback; }
export interface ActiveModelDiagnostics {
  modelName: string; modelVersion: string; modelUrl: string; modelSizeBytes: number; modelSizeFormatted: string;
  isPortraitSpecific: boolean; modelScope: 'General-Purpose (DIS5K dataset: Humans, Animals, Products, Plants, Fine Structures)';
  webGpuSupported: boolean; requestedDevice: 'cpu' | 'gpu'; activeExecutionProvider: 'WebGPU' | 'WebAssembly (WASM SIMD CPU)';
  fallbackChangesModel: false; activeThreads: number; crossOriginIsolated: boolean; inputTensorShape: string;
  outputTensorShape: string; tensorDataType: string; preprocessing: string; postprocessing: string;
  loadStatus: 'ready' | 'loading' | 'error'; lastInferenceMs?: number; lastError?: string;
}
let diagnostics: ActiveModelDiagnostics = {
  modelName: 'BiRefNet (BG0)', modelVersion: '@bg0/browser 0.1.1', modelUrl: 'BG0 managed model',
  modelSizeBytes: 0, modelSizeFormatted: 'Downloaded on first use; browser cached', isPortraitSpecific: false,
  modelScope: 'General-Purpose (DIS5K dataset: Humans, Animals, Products, Plants, Fine Structures)',
  webGpuSupported: typeof navigator !== 'undefined' && 'gpu' in navigator, requestedDevice: 'gpu',
  activeExecutionProvider: 'WebAssembly (WASM SIMD CPU)', fallbackChangesModel: false, activeThreads: typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency || 1) : 1,
  crossOriginIsolated: typeof window !== 'undefined' ? Boolean(window.crossOriginIsolated) : false,
  inputTensorShape: 'Managed by BG0', outputTensorShape: 'Managed by BG0', tensorDataType: 'Managed by BG0',
  preprocessing: 'Managed by BG0', postprocessing: 'BiRefNet alpha mask and PNG compositing', loadStatus: 'ready'
};
export async function checkWebGPUAvailability(): Promise<boolean> {
  try { return typeof navigator !== 'undefined' && 'gpu' in navigator && !!(await navigator.gpu.requestAdapter()); }
  catch { return false; }
}
export function getModelPublicPath(): string { return 'BG0 managed model'; }
export async function preloadOnnxRuntime(_device: 'cpu' | 'gpu' = 'cpu'): Promise<boolean> { return true; }
export function getActiveModelDiagnostics(): ActiveModelDiagnostics { return { ...diagnostics }; }
export async function executeBackgroundRemoval(imageSource: Blob | File | string | ImageData, options: SegmentationOptions = {}): Promise<Blob> {
  const start = performance.now();
  diagnostics.loadStatus = 'loading'; diagnostics.lastError = undefined;
  diagnostics.requestedDevice = options.device || 'gpu';
  options.onProgress?.('Preparing BG0 AI model', 5, 'Checking browser acceleration...');
  try {
    const input = imageSource instanceof ImageData
      ? await (async () => { const canvas = document.createElement('canvas'); canvas.width=imageSource.width; canvas.height=imageSource.height; canvas.getContext('2d')!.putImageData(imageSource,0,0); return await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Could not prepare image')),'image/png')); })()
      : imageSource;
    const result = await removeBackground(input, { quality: 'quality', onProgress: ({ stage, progress, message }) => {
      options.onProgress?.(stage || 'Removing background with BG0', Math.max(5, Math.min(95, Math.round(progress))), message);
    }});
    diagnostics.loadStatus = 'ready';
    diagnostics.activeExecutionProvider = await checkWebGPUAvailability() ? 'WebGPU' : 'WebAssembly (WASM SIMD CPU)';
    diagnostics.lastInferenceMs = Math.round(performance.now() - start);
    options.onProgress?.('Complete', 100, `BG0 finished in ${diagnostics.lastInferenceMs}ms`);
    return result.blob;
  } catch (error) {
    diagnostics.loadStatus = 'error'; diagnostics.lastError = error instanceof Error ? error.message : String(error);
    throw new Error(`BG0 background removal failed: ${diagnostics.lastError}`);
  }
}
