import { jsPDF } from 'jspdf';
import { BackgroundSettings, RefinementSettings, PassportSettings, PassportPreset } from '../types';

export const PASSPORT_PRESETS: PassportPreset[] = [
  {
    id: 'us-passport',
    name: 'US Passport & Visa',
    country: 'United States',
    widthMm: 51,
    heightMm: 51,
    widthInches: 2,
    heightInches: 2,
    description: '2 x 2 inches (51 x 51 mm) - US State Dept standard',
    suggestedBgColor: '#ffffff',
  },
  {
    id: 'uk-eu-passport',
    name: 'UK / EU / Schengen / International',
    country: 'UK, EU, Schengen, Canada, Australia',
    widthMm: 35,
    heightMm: 45,
    widthInches: 1.38,
    heightInches: 1.77,
    description: '35 x 45 mm - ICAO 9303 international standard',
    suggestedBgColor: '#ffffff',
  },
  {
    id: 'india-passport',
    name: 'India Passport / OCI',
    country: 'India',
    widthMm: 51,
    heightMm: 51,
    widthInches: 2,
    heightInches: 2,
    description: '2 x 2 inches (51 x 51 mm) - White background',
    suggestedBgColor: '#ffffff',
  },
  {
    id: 'china-passport',
    name: 'China Passport / Visa',
    country: 'China',
    widthMm: 33,
    heightMm: 48,
    widthInches: 1.3,
    heightInches: 1.89,
    description: '33 x 48 mm - White or light blue background',
    suggestedBgColor: '#ffffff',
  },
  {
    id: 'japan-passport',
    name: 'Japan Passport',
    country: 'Japan',
    widthMm: 35,
    heightMm: 45,
    widthInches: 1.38,
    heightInches: 1.77,
    description: '35 x 45 mm - White background, strictly centered',
    suggestedBgColor: '#ffffff',
  },
  {
    id: 'id-photo-40x50',
    name: 'Universal ID (40 x 50 mm)',
    country: 'Universal ID / License',
    widthMm: 40,
    heightMm: 50,
    widthInches: 1.57,
    heightInches: 1.97,
    description: '40 x 50 mm - Common for corporate ID & driver licenses',
    suggestedBgColor: '#2b6cb0',
  },
  {
    id: 'id-photo-30x40',
    name: 'Universal ID (30 x 40 mm)',
    country: 'Universal Badge / Student ID',
    widthMm: 30,
    heightMm: 40,
    widthInches: 1.18,
    heightInches: 1.57,
    description: '30 x 40 mm - Compact ID badge format',
    suggestedBgColor: '#ffffff',
  },
];

// Helper to load HTMLImageElement from Blob or URL
export function loadImage(src: string | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error(`Failed to load image: ${e}`));
    if (typeof src === 'string') {
      img.src = src;
    } else {
      img.src = URL.createObjectURL(src);
    }
  });
}

import { SubjectMode } from '../types';

export function makeGrayscaleMaskData(imgData: ImageData): ImageData {
  const mask = new ImageData(imgData.width, imgData.height);
  const src = imgData.data;
  const dst = mask.data;
  const total = imgData.width * imgData.height * 4;
  for (let i = 0; i < total; i += 4) {
    const a = src[i + 3];
    dst[i] = a;
    dst[i + 1] = a;
    dst[i + 2] = a;
    dst[i + 3] = 255;
  }
  return mask;
}

export function imageDataToDataUrl(imgData: ImageData): string {
  if (typeof document === 'undefined') return '';
  const c = document.createElement('canvas');
  c.width = imgData.width;
  c.height = imgData.height;
  const ctx = c.getContext('2d');
  if (ctx) ctx.putImageData(imgData, 0, 0);
  return c.toDataURL('image/png');
}

/**
 * Primary Subject Isolation & Intelligent Component Filtering:
 * Robustly detects and isolates the primary subject (human, animal, or product)
 * and eliminates disconnected outdoor background fragments (trees, garden grass, sky, fences).
 *
 * CRITICAL SAFETY & QUALITY CRITERIA:
 * 1. Preserves legitimate disconnected foreground details (jewellery, hair strands, paws, ears, tail).
 * 2. Prunes large background trees and flower patches that naively score high area.
 * 3. Never globally wipes green colors (protects green clothes, gemstones, eyes).
 * 4. Preserves fine fur, paws, and soft alpha transitions without harsh erosion.
 */
export function isolatePrimarySubjectAndFilterFragments(
  imgData: ImageData,
  options: {
    mode?: SubjectMode;
    thresholdPct?: number;
    isolatePrimary?: boolean;
    furPreservation?: boolean;
    groundSuppression?: boolean;
    origImgData?: ImageData | null;
    subjectFocalPoint?: { x: number; y: number } | null;
    subjectBoundingBox?: { minX: number; maxX: number; minY: number; maxY: number } | null;
    confidenceThreshold?: number;
    mattingSensitivity?: number;
  } = {}
): {
  subjectBox: { minX: number; maxX: number; minY: number; maxY: number };
  detectedMode: SubjectMode;
  lowConfidenceWarning: boolean;
  islandCountRemoved: number;
  stage1MaskData: ImageData;
  stage2MaskData: ImageData;
  stage3MaskData: ImageData;
} {
  const width = imgData.width;
  const height = imgData.height;
  const data = imgData.data;
  const origData = options.origImgData ? options.origImgData.data : data;

  const mode = options.mode || 'auto';
  const isolatePrimary = options.isolatePrimary !== false;

  // 1. CAPTURE STAGE 1 (RAW MODEL MASK)
  // Store pristine grayscale snapshot of raw model probability values
  const stage1MaskData = makeGrayscaleMaskData(imgData);

  // Measure initial confidence distribution to identify low-confidence images
  let totalForegroundAlpha = 0;
  let foregroundPixelCount = 0;
  let intermediatePixelCount = 0; // uncertain pixels (alpha 50..180)
  for (let i = 3; i < data.length; i += 4) {
    const a = data[i];
    if (a > 30) {
      totalForegroundAlpha += a;
      foregroundPixelCount++;
      if (a < 185) intermediatePixelCount++;
    }
  }
  const avgConfidence = foregroundPixelCount > 0 ? totalForegroundAlpha / (foregroundPixelCount * 255) : 0;
  const lowConfidenceWarning = avgConfidence < 0.62 || (foregroundPixelCount > 0 && intermediatePixelCount / foregroundPixelCount > 0.45);

  // Downsample to a fast grid for sub-millisecond core component identification
  const scale = Math.max(1, Math.floor(Math.max(width, height) / 360));
  const gw = Math.ceil(width / scale);
  const gh = Math.ceil(height / scale);

  const highConfCutoff = options.confidenceThreshold
    ? Math.max(140, Math.min(220, Math.round(options.confidenceThreshold * 2.55)))
    : 180;
  const lowConfCutoff = 65;

  const coreGrid = new Uint8Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) {
    const py = Math.min(height - 1, gy * scale);
    for (let gx = 0; gx < gw; gx++) {
      const px = Math.min(width - 1, gx * scale);
      const alpha = data[(py * width + px) * 4 + 3];
      coreGrid[gy * gw + gx] = alpha >= highConfCutoff ? 1 : 0;
    }
  }

  // Connected Component Labeling on High-Confidence Core
  const coreLabels = new Int32Array(gw * gh).fill(-1);
  interface CoreComponentInfo {
    id: number;
    size: number;
    sumX: number;
    sumY: number;
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    touchesTop: boolean;
    touchesBottom: boolean;
    touchesLeft: boolean;
    touchesRight: boolean;
  }

  const coreComponents: CoreComponentInfo[] = [];
  let currentLabel = 0;

  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      const idx = y * gw + x;
      if (coreGrid[idx] === 1 && coreLabels[idx] === -1) {
        let size = 0;
        let sumX = 0;
        let sumY = 0;
        let minX = x;
        let maxX = x;
        let minY = y;
        let maxY = y;
        let touchesTop = false;
        let touchesBottom = false;
        let touchesLeft = false;
        let touchesRight = false;

        const queue: number[] = [idx];
        coreLabels[idx] = currentLabel;

        while (queue.length > 0) {
          const curr = queue.pop()!;
          const cx = curr % gw;
          const cy = Math.floor(curr / gw);
          size++;
          sumX += cx;
          sumY += cy;

          if (cx < minX) minX = cx;
          if (cx > maxX) maxX = cx;
          if (cy < minY) minY = cy;
          if (cy > maxY) maxY = cy;

          if (cy <= 1) touchesTop = true;
          if (cy >= gh - 2) touchesBottom = true;
          if (cx <= 1) touchesLeft = true;
          if (cx >= gw - 2) touchesRight = true;

          const neighbors = [
            cy > 0 ? (cy - 1) * gw + cx : -1,
            cy < gh - 1 ? (cy + 1) * gw + cx : -1,
            cx > 0 ? cy * gw + (cx - 1) : -1,
            cx < gw - 1 ? cy * gw + (cx + 1) : -1,
            cy > 0 && cx > 0 ? (cy - 1) * gw + (cx - 1) : -1,
            cy > 0 && cx < gw - 1 ? (cy - 1) * gw + (cx + 1) : -1,
            cy < gh - 1 && cx > 0 ? (cy + 1) * gw + (cx - 1) : -1,
            cy < gh - 1 && cx < gw - 1 ? (cy + 1) * gw + (cx + 1) : -1,
          ];

          for (const n of neighbors) {
            if (n !== -1 && coreGrid[n] === 1 && coreLabels[n] === -1) {
              coreLabels[n] = currentLabel;
              queue.push(n);
            }
          }
        }

        coreComponents.push({
          id: currentLabel,
          size,
          sumX,
          sumY,
          minX,
          maxX,
          minY,
          maxY,
          touchesTop,
          touchesBottom,
          touchesLeft,
          touchesRight,
        });
        currentLabel++;
      }
    }
  }

  // Fallback if core threshold was too strict
  if (coreComponents.length === 0) {
    for (let i = 0; i < gw * gh; i++) {
      coreGrid[i] = data[Math.min(height - 1, Math.floor(i / gw) * scale) * width * 4 + Math.min(width - 1, (i % gw) * scale) * 4 + 3] > 60 ? 1 : 0;
    }
  }

  // 2. PRIMARY SUBJECT SELECTION
  let primaryIndex = 0;
  if (options.subjectFocalPoint && coreComponents.length > 0) {
    const fx = Math.round(options.subjectFocalPoint.x / scale);
    const fy = Math.round(options.subjectFocalPoint.y / scale);
    let bestDist = Infinity;
    for (let i = 0; i < coreComponents.length; i++) {
      const c = coreComponents[i];
      const avgX = c.sumX / c.size;
      const avgY = c.sumY / c.size;
      const dist = Math.hypot(avgX - fx, avgY - fy);
      if (fx >= c.minX && fx <= c.maxX && fy >= c.minY && fy <= c.maxY) {
        primaryIndex = i;
        bestDist = 0;
        break;
      }
      if (dist < bestDist) {
        bestDist = dist;
        primaryIndex = i;
      }
    }
  } else if (options.subjectBoundingBox && coreComponents.length > 0) {
    const bMinX = options.subjectBoundingBox.minX / scale;
    const bMaxX = options.subjectBoundingBox.maxX / scale;
    const bMinY = options.subjectBoundingBox.minY / scale;
    const bMaxY = options.subjectBoundingBox.maxY / scale;
    let bestSize = -1;
    for (let i = 0; i < coreComponents.length; i++) {
      const c = coreComponents[i];
      const avgX = c.sumX / c.size;
      const avgY = c.sumY / c.size;
      if (avgX >= bMinX && avgX <= bMaxX && avgY >= bMinY && avgY <= bMaxY) {
        if (c.size > bestSize) {
          bestSize = c.size;
          primaryIndex = i;
        }
      }
    }
  } else if (coreComponents.length > 0) {
    const imgCenterX = gw / 2;
    const imgCenterY = gh / 2;
    const maxCenterDist = Math.hypot(imgCenterX, imgCenterY);
    let bestScore = -1;

    for (let i = 0; i < coreComponents.length; i++) {
      const comp = coreComponents[i];
      const avgX = comp.sumX / comp.size;
      const avgY = comp.sumY / comp.size;
      const distToCenter = Math.hypot(avgX - imgCenterX, avgY - imgCenterY);
      const centerFactor = 1 - (distToCenter / maxCenterDist) * 0.45;

      let borderPenalty = 1.0;
      if (comp.touchesTop && avgY < gh * 0.45) {
        borderPenalty = 0.05; // Trees / sky
      } else if (comp.touchesTop && comp.touchesLeft && comp.touchesRight) {
        borderPenalty = 0.02; // Sprawling upper background
      }

      const score = comp.size * centerFactor * borderPenalty;
      if (score > bestScore) {
        bestScore = score;
        primaryIndex = i;
      }
    }
  }

  const primaryComp = coreComponents[primaryIndex] || {
    id: 0,
    size: gw * gh,
    sumX: (gw * gw * gh) / 2,
    sumY: (gw * gh * gh) / 2,
    minX: Math.round(gw * 0.15),
    maxX: Math.round(gw * 0.85),
    minY: Math.round(gh * 0.15),
    maxY: Math.round(gh * 0.85),
    touchesTop: false,
    touchesBottom: false,
    touchesLeft: false,
    touchesRight: false,
  };

  const primaryBox = {
    minX: primaryComp.minX * scale,
    maxX: Math.min(width, (primaryComp.maxX + 1) * scale),
    minY: primaryComp.minY * scale,
    maxY: Math.min(height, (primaryComp.maxY + 1) * scale),
  };

  // 3. AUTO-DETECT MODE
  let detectedMode: SubjectMode = mode;
  if (mode === 'auto') {
    const boxW = primaryBox.maxX - primaryBox.minX;
    const boxH = primaryBox.maxY - primaryBox.minY;
    const aspect = boxW / Math.max(1, boxH);

    let skinLikePixels = 0;
    let furLikePixels = 0;
    let totalSamples = 0;

    for (let sy = primaryBox.minY; sy < primaryBox.maxY; sy += 12) {
      for (let sx = primaryBox.minX; sx < primaryBox.maxX; sx += 12) {
        const idx = (sy * width + sx) * 4;
        if (data[idx + 3] > 100) {
          totalSamples++;
          const r = origData[idx];
          const g = origData[idx + 1];
          const b = origData[idx + 2];
          if (r > 120 && g > 80 && b > 60 && r > g && g > b && r - g > 15 && r - b > 25) {
            skinLikePixels++;
          }
          if ((r > 150 && g > 100 && b < 100 && r > g && g > b) || (r > 120 && g > 85 && b < 70)) {
            furLikePixels++;
          }
        }
      }
    }

    if (skinLikePixels > totalSamples * 0.22 && aspect < 0.88) {
      detectedMode = 'portrait';
    } else if (furLikePixels > totalSamples * 0.22 || aspect >= 0.72) {
      detectedMode = 'pet';
    } else {
      detectedMode = 'portrait';
    }
  }

  const isAnimal = detectedMode === 'pet' || detectedMode === 'animal';

  // 4. CLEAN ISLAND PRUNING (Safely removes isolated exterior noise without destroying any subject parts)
  let islandCountRemoved = 0;

  if (isolatePrimary && coreComponents.length > 1) {
    // Collect all components that are part of or immediately adjacent to the primary subject
    const subjectComponents = new Set<number>();
    subjectComponents.add(primaryComp.id);

    // Expand subject bounding box by a generous safety margin (at least 28px or 4% of image)
    const safetyPad = Math.max(28, Math.round(Math.max(width, height) * 0.04));
    const safeMinX = Math.max(0, primaryBox.minX - safetyPad);
    const safeMaxX = Math.min(width, primaryBox.maxX + safetyPad);
    const safeMinY = Math.max(0, primaryBox.minY - safetyPad);
    const safeMaxY = Math.min(height, primaryBox.maxY + safetyPad);

    // Any component whose bounding box touches or intersects the safe subject box is kept
    for (const comp of coreComponents) {
      if (comp.id === primaryComp.id) continue;
      const cMinX = comp.minX * scale;
      const cMaxX = (comp.maxX + 1) * scale;
      const cMinY = comp.minY * scale;
      const cMaxY = (comp.maxY + 1) * scale;

      const intersects =
        cMinX <= safeMaxX && cMaxX >= safeMinX &&
        cMinY <= safeMaxY && cMaxY >= safeMinY;

      // Keep components that intersect or are large (>= 2.5% of grid area)
      if (intersects || comp.size >= gw * gh * 0.025) {
        subjectComponents.add(comp.id);
      }
    }

    // Only zero out small islands that are completely isolated outside the subject region
    for (const comp of coreComponents) {
      if (!subjectComponents.has(comp.id)) {
        // Zero out this isolated exterior island
        for (let gy = comp.minY; gy <= comp.maxY; gy++) {
          for (let gx = comp.minX; gx <= comp.maxX; gx++) {
            if (coreLabels[gy * gw + gx] === comp.id) {
              const startY = gy * scale;
              const endY = Math.min(height, (gy + 1) * scale);
              const startX = gx * scale;
              const endX = Math.min(width, (gx + 1) * scale);
              for (let py = startY; py < endY; py++) {
                const row = py * width;
                for (let px = startX; px < endX; px++) {
                  data[(row + px) * 4 + 3] = 0;
                }
              }
            }
          }
        }
        islandCountRemoved++;
      }
    }
  }

  // 5. CAPTURE STAGE 2 (ISLAND PRUNED MASK)
  const stage2MaskData = makeGrayscaleMaskData(imgData);

  // 6. NARROW-BAND FUR & MATTING REFINEMENT
  // Applied strictly within boundary pixels to preserve soft hair/fur fringes without harsh erosion
  if (options.furPreservation !== false && (isAnimal || detectedMode === 'portrait')) {
    for (let y = 1; y < height - 1; y++) {
      const rowOffset = y * width;
      for (let x = 1; x < width - 1; x++) {
        const idx = rowOffset + x;
        const a = data[idx * 4 + 3];
        if (a > 15 && a < 200) {
          const isBoundary =
            data[(idx - 1) * 4 + 3] === 0 ||
            data[(idx + 1) * 4 + 3] === 0 ||
            data[(idx - width) * 4 + 3] === 0 ||
            data[(idx + width) * 4 + 3] === 0;

          if (isBoundary) {
            // Soft gamma curve to retain fine fur strands
            const boost = Math.min(255, Math.round(Math.pow(a / 255, 0.92) * 255));
            data[idx * 4 + 3] = boost;
          }
        }
      }
    }
  }

  // 7. CAPTURE STAGE 3 (NARROW-BAND MATTED MASK)
  const stage3MaskData = makeGrayscaleMaskData(imgData);

  return {
    subjectBox: primaryBox,
    detectedMode,
    lowConfidenceWarning,
    islandCountRemoved,
    stage1MaskData,
    stage2MaskData,
    stage3MaskData,
  };
}

/**
 * Backwards-compatible alias for filterStrayFragments
 */
export function filterStrayFragments(imgData: ImageData, thresholdPct: number = 0.05): void {
  isolatePrimarySubjectAndFilterFragments(imgData, { thresholdPct, isolatePrimary: true });
}

/**
 * Helper to parse hex string into RGB values
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return isNaN(r) || isNaN(g) || isNaN(b) ? null : { r, g, b };
  }
  if (clean.length === 6) {
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    return isNaN(r) || isNaN(g) || isNaN(b) ? null : { r, g, b };
  }
  return null;
}

/**
 * Automatically detects the dominant background color of the original image
 * by sampling pixels where alpha < 25 (the removed background area) along image borders.
 */
export function detectBackgroundColor(
  origImgData: ImageData,
  alphaData: Uint8ClampedArray | Uint8Array
): { r: number; g: number; b: number; hex: string } {
  const width = origImgData.width;
  const height = origImgData.height;
  const data = origImgData.data;

  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let count = 0;

  // Outer border margins (top, bottom, left, right 12% margins)
  const borderMarginX = Math.max(1, Math.floor(width * 0.12));
  const borderMarginY = Math.max(1, Math.floor(height * 0.12));

  for (let y = 0; y < height; y += 3) {
    for (let x = 0; x < width; x += 3) {
      const isBorder =
        x < borderMarginX || x >= width - borderMarginX ||
        y < borderMarginY || y >= height - borderMarginY;

      const idx = (y * width + x) * 4;
      const a = alphaData[idx + 3];

      // Sample pixels that were segmented as background
      if (a < 30 && isBorder) {
        sumR += data[idx];
        sumG += data[idx + 1];
        sumB += data[idx + 2];
        count++;
      }
    }
  }

  // Fallback to any low-alpha pixel if border had too few samples
  if (count < 25) {
    for (let i = 0; i < data.length; i += 16) {
      if (alphaData[i + 3] < 30) {
        sumR += data[i];
        sumG += data[i + 1];
        sumB += data[i + 2];
        count++;
      }
    }
  }

  if (count === 0) {
    // Default studio brown fallback
    return { r: 85, g: 55, b: 40, hex: '#553728' };
  }

  const avgR = Math.round(sumR / count);
  const avgG = Math.round(sumG / count);
  const avgB = Math.round(sumB / count);
  const hex = `#${((1 << 24) + (avgR << 16) + (avgG << 8) + avgB).toString(16).slice(1)}`;

  return { r: avgR, g: avgG, b: avgB, hex };
}

/**
 * Translucent Fabric & Sheer Veil Color Decontamination:
 * Removes contaminated background colors (e.g. brown studio backdrops, dark rooms, green spill)
 * from semi-transparent pixels (bridal veils, net dupattas, lace, flyaway hair)
 * by applying true alpha unblending: C_foreground = (C_captured - (1 - alpha) * C_bg) / alpha.
 *
 * CRITICAL SAFETY RULES:
 * 1. Opaque pixels (alpha >= 245) are 100% UNTOUCHED to strictly preserve natural skin tones,
 *    face makeup, velvet lehenga colors, and embroidery textures.
 * 2. Jewellery Guard preserves gold zari embroidery, kundan necklace stones, diamonds, and pearls.
 */
export function decontaminateTranslucentFabrics(
  imgData: ImageData,
  origImgData: ImageData | null,
  bgColor: { r: number; g: number; b: number },
  strength: number = 0.65,
  protectJewellery: boolean = true
): void {
  const data = imgData.data;
  const origData = origImgData ? origImgData.data : data;
  const len = data.length;
  const factor = Math.max(0, Math.min(1, strength));

  for (let i = 0; i < len; i += 4) {
    const a = data[i + 3];

    // Only apply to semi-transparent pixels: veils, lace, sheer fabrics, hair strands
    // Pixels with a >= 245 are solid subject (skin, dress, face) and remain 100% unmodified!
    if (a > 8 && a < 245) {
      const origR = origData[i];
      const origG = origData[i + 1];
      const origB = origData[i + 2];

      // Protect gold, gemstones, diamonds, and sequins from color shifts
      if (protectJewellery) {
        const maxC = Math.max(origR, origG, origB);
        const minC = Math.min(origR, origG, origB);
        const isGoldOrJewellery =
          (origR > 140 && origG > 110 && origB < 110) || // Gold zari / necklace
          (maxC - minC > 65 && maxC > 135) ||             // Saturated gems / rubies / emeralds
          (origR > 215 && origG > 215 && origB > 215);   // Diamond sparkles
        if (isGoldOrJewellery) continue;
      }

      const alphaNorm = a / 255;
      const bgWeight = (1 - alphaNorm) * factor;

      // Color unblending formula with safe denominator scaling
      const safeScale = Math.max(0.18, 1 - bgWeight * 0.85);
      const targetR = Math.max(0, Math.min(255, (origR - bgWeight * bgColor.r) / safeScale));
      const targetG = Math.max(0, Math.min(255, (origG - bgWeight * bgColor.g) / safeScale));
      const targetB = Math.max(0, Math.min(255, (origB - bgWeight * bgColor.b) / safeScale));

      // Smooth blend based on strength
      data[i] = Math.round(data[i] * (1 - factor) + targetR * factor);
      data[i + 1] = Math.round(data[i + 1] * (1 - factor) + targetG * factor);
      data[i + 2] = Math.round(data[i + 2] * (1 - factor) + targetB * factor);
    }
  }
}

/**
 * Color Decontamination & Edge Anti-Halo:
 * Eliminates background color bleed (e.g. green grass, white halos, dark background bleed)
 * along edge silhouettes while strictly preserving original RGB colors.
 */
export function decontaminateEdges(
  imgData: ImageData,
  strength: number = 0.6,
  protectJewellery: boolean = true
): void {
  const width = imgData.width;
  const height = imgData.height;
  const data = imgData.data;

  // Identify semi-transparent fringe pixels (alpha between 15 and 220)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const alpha = data[idx + 3];

      if (alpha > 15 && alpha < 220) {
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        // If jewellery protection is enabled, do not distort gold zari, gems, or embroidery
        if (protectJewellery) {
          const maxC = Math.max(r, g, b);
          const minC = Math.min(r, g, b);
          const isGoldOrJewellery =
            (r > 150 && g > 120 && b < 110) || // Gold metallic
            (maxC - minC > 60 && maxC > 140) || // Vibrant sequins/gems
            (r > 215 && g > 215 && b > 215);   // Crystal/diamond sparkles
          if (isGoldOrJewellery) continue;
        }

        // Search in a 3-pixel neighborhood for a nearby solid foreground pixel (alpha >= 245)
        let foundSolid = false;
        let sumR = 0;
        let sumG = 0;
        let sumB = 0;
        let count = 0;

        for (let dy = -3; dy <= 3; dy++) {
          const ny = y + dy;
          if (ny < 0 || ny >= height) continue;
          for (let dx = -3; dx <= 3; dx++) {
            const nx = x + dx;
            if (nx < 0 || nx >= width) continue;
            const nIdx = (ny * width + nx) * 4;
            if (data[nIdx + 3] >= 245) {
              sumR += data[nIdx];
              sumG += data[nIdx + 1];
              sumB += data[nIdx + 2];
              count++;
              foundSolid = true;
            }
          }
        }

        if (foundSolid && count > 0) {
          const fgR = Math.round(sumR / count);
          const fgG = Math.round(sumG / count);
          const fgB = Math.round(sumB / count);

          // Scaled by decontamination strength
          const blendFactor = (1 - (alpha / 255) * 0.7) * Math.max(0, Math.min(1, strength));
          data[idx] = Math.round(data[idx] * (1 - blendFactor) + fgR * blendFactor);
          data[idx + 1] = Math.round(data[idx + 1] * (1 - blendFactor) + fgG * blendFactor);
          data[idx + 2] = Math.round(data[idx + 2] * (1 - blendFactor) + fgB * blendFactor);
        }
      }
    }
  }
}

/**
 * Translucency & Jewellery Guard:
 * Preserves soft, genuine partial alpha for sheer fabrics (bridal veils, lace, net dupattas)
 * and guards delicate gold embroidery, maang tikka, and jewelry from erosion.
 */
export function adjustTranslucencyAndJewellery(
  imgData: ImageData,
  veilBoost: number = 0,
  jewelleryGuard: boolean = true
): void {
  const data = imgData.data;
  const len = data.length;

  for (let i = 0; i < len; i += 4) {
    const a = data[i + 3];
    if (a > 0 && a < 255) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Protect gold, diamonds, gems, and metallic embroidery
      if (jewelleryGuard) {
        const maxC = Math.max(r, g, b);
        const minC = Math.min(r, g, b);
        const isMetallicOrSparkle =
          (r > 150 && g > 120 && b < 110) || // Gold zari / necklace
          (maxC - minC > 60 && maxC > 140) || // Vibrant sequins
          (r > 215 && g > 215 && b > 215);   // Diamonds

        if (isMetallicOrSparkle && a > 35) {
          // Keep fine jewelry solid and crisp
          data[i + 3] = Math.min(255, Math.round(a * 1.35 + 25));
          continue;
        }
      }

      // Smooth non-linear gamma curve for sheer fabric translucency
      if (veilBoost !== 0 && a > 15 && a < 240) {
        const aNorm = a / 255;
        // Non-linear gamma lift: lifts midtones and sheer fabrics without clipping to solid
        const gamma = Math.pow(2, -veilBoost / 38);
        const boosted = Math.pow(aNorm, gamma) * 255;
        data[i + 3] = Math.max(0, Math.min(255, Math.round(boosted)));
      }
    }
  }
}

/**
 * Fast Alpha Feathering / Edge Smoothing:
 * Softens stair-stepped jagged edges ONLY on the alpha channel.
 * RGB colors are strictly untouched so the image stays 100% sharp.
 */
export function featherAlphaChannel(imgData: ImageData, radius: number): void {
  if (radius <= 0) return;
  const width = imgData.width;
  const height = imgData.height;
  const data = imgData.data;

  // Extract alpha channel
  const alpha = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    alpha[i] = data[i * 4 + 3];
  }

  const r = Math.min(6, Math.round(radius));
  const temp = new Uint8Array(width * height);

  // Horizontal blur pass
  for (let y = 0; y < height; y++) {
    const rowOffset = y * width;
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let count = 0;
      for (let dx = -r; dx <= r; dx++) {
        const nx = x + dx;
        if (nx >= 0 && nx < width) {
          sum += alpha[rowOffset + nx];
          count++;
        }
      }
      temp[rowOffset + x] = Math.round(sum / count);
    }
  }

  // Vertical blur pass
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      let sum = 0;
      let count = 0;
      for (let dy = -r; dy <= r; dy++) {
        const ny = y + dy;
        if (ny >= 0 && ny < height) {
          sum += temp[ny * width + x];
          count++;
        }
      }
      data[(y * width + x) * 4 + 3] = Math.round(sum / count);
    }
  }
}

/**
 * Composites a transparent image onto a canvas with background color and edge refinements.
 * Accepts optional originalImage to allow true color unblending and automatic background color detection.
 */
export async function compositeImage(
  transparentImage: HTMLCanvasElement | HTMLImageElement | Blob | string,
  background: BackgroundSettings,
  refinements: RefinementSettings = {
    feather: 0,
    edgeShift: 0,
    antiHalo: true,
    decontaminateStrength: 60,
    removeStrayFragments: true,
    fragmentThreshold: 5,
    subjectMode: 'auto',
    isolatePrimarySubject: true,
    furPreservation: true,
    groundSuppression: true,
    decontaminateEdges: true,
    preserveTranslucency: true,
    veilBoost: 15,
    jewelleryGuard: true,
    brightness: 0,
    contrast: 0,
  },
  exportFormat: 'image/png' | 'image/jpeg' | 'image/webp' = 'image/png',
  quality: number = 0.95,
  originalImage?: HTMLCanvasElement | HTMLImageElement | Blob | File | string | null,
): Promise<{
  blob: Blob;
  url: string;
  width: number;
  height: number;
  detectedBgColor?: string;
  detectedMode?: SubjectMode;
  detectedBox?: { minX: number; maxX: number; minY: number; maxY: number };
  diagnostics?: {
    rawMaskUrl?: string;
    stage2MaskUrl?: string;
    stage3MaskUrl?: string;
    stage4CutoutUrl?: string;
    lowConfidenceWarning?: boolean;
    islandCountRemoved?: number;
  };
}> {
  const img =
    transparentImage instanceof HTMLCanvasElement || transparentImage instanceof HTMLImageElement
      ? transparentImage
      : await loadImage(transparentImage);
  const width = img instanceof HTMLImageElement ? img.naturalWidth || img.width : img.width;
  const height = img instanceof HTMLImageElement ? img.naturalHeight || img.height : img.height;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not get 2D canvas context');

  // 1. Draw Background
  if (background.type === 'color' && background.color) {
    ctx.fillStyle = background.color;
    ctx.fillRect(0, 0, width, height);
  } else if (background.type === 'gradient' && background.gradient) {
    const rad = ((background.gradient.angle || 0) * Math.PI) / 180;
    const x2 = width * Math.cos(rad);
    const y2 = height * Math.sin(rad);
    const grad = ctx.createLinearGradient(0, 0, Math.abs(x2), Math.abs(y2));
    grad.addColorStop(0, background.gradient.color1);
    grad.addColorStop(1, background.gradient.color2);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  } else {
    // Transparent: clear canvas
    ctx.clearRect(0, 0, width, height);
  }

  // 2. Prepare Foreground Image with Refinements
  const fgCanvas = document.createElement('canvas');
  fgCanvas.width = width;
  fgCanvas.height = height;
  const fgCtx = fgCanvas.getContext('2d', { willReadFrequently: true });

  let detectedColorHex: string | undefined;
  let detectedSubjectMode: SubjectMode | undefined;
  let detectedSubjectBox: { minX: number; maxX: number; minY: number; maxY: number } | undefined;
  let rawMaskDataUrl: string | undefined;
  let stage2MaskDataUrl: string | undefined;
  let stage3MaskDataUrl: string | undefined;
  let isLowConfidence: boolean | undefined;
  let islandsRemovedCount: number | undefined;

  if (fgCtx) {
    // Apply brightness / contrast filters
    let filterStr = '';
    if (refinements.brightness !== 0) {
      filterStr += `brightness(${100 + refinements.brightness}%) `;
    }
    if (refinements.contrast !== 0) {
      filterStr += `contrast(${100 + refinements.contrast}%) `;
    }
    if (filterStr) {
      fgCtx.filter = filterStr.trim();
    }

    fgCtx.drawImage(img, 0, 0);

    // Pixel-level refinement pipeline
    const imgData = fgCtx.getImageData(0, 0, width, height);

    // Get original image data if available for pristine unblending & bg color detection
    let origImgData: ImageData | null = null;
    if (originalImage) {
      try {
        const origLoaded =
          originalImage instanceof HTMLImageElement || originalImage instanceof HTMLCanvasElement
            ? originalImage
            : await loadImage(originalImage);
        const origCanvas = document.createElement('canvas');
        origCanvas.width = width;
        origCanvas.height = height;
        const oCtx = origCanvas.getContext('2d', { willReadFrequently: true });
        if (oCtx) {
          oCtx.drawImage(origLoaded, 0, 0, width, height);
          origImgData = oCtx.getImageData(0, 0, width, height);
        }
      } catch (e) {
        console.warn('Could not load original image for decontamination:', e);
      }
    }

    // Determine contaminated background color
    let decontamBgColor: { r: number; g: number; b: number } = { r: 85, g: 55, b: 40 }; // Warm brown
    if (origImgData) {
      const detected = detectBackgroundColor(origImgData, imgData.data);
      detectedColorHex = detected.hex;
      if (refinements.autoDetectBgColor !== false || !refinements.decontaminateBgColor) {
        decontamBgColor = detected;
      }
    }
    if (refinements.decontaminateBgColor) {
      const parsed = hexToRgb(refinements.decontaminateBgColor);
      if (parsed) decontamBgColor = parsed;
    }

    // 1. Primary Subject Isolation & Stray Background Filtering (animals, garden trees, flowers, lawn)
    if (refinements.removeStrayFragments || refinements.isolatePrimarySubject) {
      const thresholdPct = (refinements.fragmentThreshold || 5) / 100;
      const isolationRes = isolatePrimarySubjectAndFilterFragments(imgData, {
        mode: refinements.subjectMode || 'auto',
        thresholdPct,
        isolatePrimary: refinements.isolatePrimarySubject !== false,
        groundSuppression: refinements.groundSuppression !== false,
        furPreservation: refinements.furPreservation !== false,
        origImgData,
        subjectFocalPoint: refinements.subjectFocalPoint,
        subjectBoundingBox: refinements.subjectBoundingBox,
        confidenceThreshold: refinements.confidenceThreshold,
        mattingSensitivity: refinements.mattingSensitivity,
      });
      detectedSubjectMode = isolationRes.detectedMode;
      detectedSubjectBox = isolationRes.subjectBox;
      rawMaskDataUrl = imageDataToDataUrl(isolationRes.stage1MaskData);
      stage2MaskDataUrl = imageDataToDataUrl(isolationRes.stage2MaskData);
      stage3MaskDataUrl = imageDataToDataUrl(isolationRes.stage3MaskData);
      isLowConfidence = isolationRes.lowConfidenceWarning;
      islandsRemovedCount = isolationRes.islandCountRemoved;
    }

    // 2. Translucent veil boost & jewellery guard
    if (refinements.preserveTranslucency || refinements.jewelleryGuard) {
      adjustTranslucencyAndJewellery(
        imgData,
        refinements.veilBoost || 0,
        refinements.jewelleryGuard ?? true
      );
    }

    // 3. Edge shift (choke or expand boundary)
    if (refinements.edgeShift !== 0) {
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        const a = data[i + 3];
        if (a > 0 && a < 255) {
          if (refinements.edgeShift > 0) {
            // Erode
            const factor = Math.max(0, 1 - refinements.edgeShift * 0.16);
            data[i + 3] = Math.round(a * factor);
          } else if (refinements.edgeShift < 0) {
            // Dilate
            const factor = Math.min(255, a * (1 + Math.abs(refinements.edgeShift) * 0.18));
            data[i + 3] = Math.round(factor);
          }
        }
      }
    }

    // 4. Decontaminate translucent fabrics (Bridal veil, lace, net dupattas)
    if (refinements.decontaminateEdges || refinements.antiHalo) {
      const strength = (refinements.decontaminateStrength ?? 60) / 100;
      decontaminateTranslucentFabrics(
        imgData,
        origImgData,
        decontamBgColor,
        strength,
        refinements.jewelleryGuard ?? true
      );
      // Also apply silhouette anti-halo for hard edge boundaries
      decontaminateEdges(imgData, strength * 0.7, refinements.jewelleryGuard ?? true);
    }

    // 5. Feather edges to remove stair-stepping on alpha channel only
    if (refinements.feather > 0) {
      featherAlphaChannel(imgData, refinements.feather);
    }

    fgCtx.putImageData(imgData, 0, 0);
    ctx.drawImage(fgCanvas, 0, 0);
  } else {
    ctx.drawImage(img, 0, 0);
  }

  // Export to Blob
  return new Promise((resolve, reject) => {
    const finalFormat = background.type === 'transparent' && exportFormat === 'image/jpeg' ? 'image/png' : exportFormat;

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to create composited image blob'));
          return;
        }
        const url = URL.createObjectURL(blob);
        resolve({
          blob,
          url,
          width,
          height,
          detectedBgColor: detectedColorHex,
          detectedMode: detectedSubjectMode,
          detectedBox: detectedSubjectBox,
          diagnostics: {
            rawMaskUrl: rawMaskDataUrl,
            stage2MaskUrl: stage2MaskDataUrl,
            stage3MaskUrl: stage3MaskDataUrl,
            stage4CutoutUrl: url,
            lowConfidenceWarning: isLowConfidence,
            islandCountRemoved: islandsRemovedCount,
          },
        });
      },
      finalFormat,
      quality
    );
  });
}

/**
 * Applies a manual Erase or Restore brush stroke directly onto a canvas mask with opacity support.
 * Erase: clears pixels to transparent.
 * Restore: copies pixels from the original unsegmented image at specified opacity (e.g. for sheer veils).
 */
export function paintBrushStroke(
  targetCtx: CanvasRenderingContext2D,
  originalImage: CanvasImageSource,
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  tool: 'erase' | 'restore',
  size: number,
  hardness: number = 0.8,
  opacity: number = 1.0
): void {
  const distance = Math.hypot(p2.x - p1.x, p2.y - p1.y);
  const step = Math.max(1, size * 0.25);
  const steps = Math.max(1, Math.ceil(distance / step));

  targetCtx.save();

  if (tool === 'erase') {
    targetCtx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = p1.x + (p2.x - p1.x) * t;
      const y = p1.y + (p2.y - p1.y) * t;

      const grad = targetCtx.createRadialGradient(x, y, 0, x, y, size / 2);
      grad.addColorStop(0, `rgba(0,0,0,${opacity})`);
      grad.addColorStop(Math.max(0.1, hardness), `rgba(0,0,0,${opacity})`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');

      targetCtx.fillStyle = grad;
      targetCtx.beginPath();
      targetCtx.arc(x, y, size / 2, 0, Math.PI * 2);
      targetCtx.fill();
    }
  } else if (tool === 'restore') {
    // For restore, create a clipping stamp along the path and draw originalImage through it
    const brushCanvas = document.createElement('canvas');
    brushCanvas.width = targetCtx.canvas.width;
    brushCanvas.height = targetCtx.canvas.height;
    const bCtx = brushCanvas.getContext('2d');

    if (bCtx) {
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = p1.x + (p2.x - p1.x) * t;
        const y = p1.y + (p2.y - p1.y) * t;

        const grad = bCtx.createRadialGradient(x, y, 0, x, y, size / 2);
        grad.addColorStop(0, `rgba(255,255,255,${opacity})`);
        grad.addColorStop(Math.max(0.1, hardness), `rgba(255,255,255,${opacity})`);
        grad.addColorStop(1, 'rgba(255,255,255,0)');

        bCtx.fillStyle = grad;
        bCtx.beginPath();
        bCtx.arc(x, y, size / 2, 0, Math.PI * 2);
        bCtx.fill();
      }

      // Intersect stamp with original image
      bCtx.globalCompositeOperation = 'source-in';
      bCtx.drawImage(originalImage, 0, 0);

      // Blend onto target canvas with user opacity
      targetCtx.globalAlpha = 1;
      targetCtx.globalCompositeOperation = 'source-over';
      targetCtx.drawImage(brushCanvas, 0, 0);
    }
  }

  targetCtx.restore();
}

/**
 * Calculates passport pixel dimensions from mm and DPI
 */
export function calculatePassportPixels(widthMm: number, heightMm: number, dpi: number = 300) {
  const widthPx = Math.round((widthMm / 25.4) * dpi);
  const heightPx = Math.round((heightMm / 25.4) * dpi);
  return { widthPx, heightPx, widthMm, heightMm, dpi };
}

/**
 * Generates an individual passport photo canvas
 */
export async function renderPassportPhoto(
  sourceImage: HTMLImageElement | Blob | string,
  settings: PassportSettings,
  preset: PassportPreset
): Promise<HTMLCanvasElement> {
  const img = sourceImage instanceof HTMLImageElement ? sourceImage : await loadImage(sourceImage);
  const { widthPx, heightPx } = calculatePassportPixels(
    preset.widthMm || settings.customWidthMm,
    preset.heightMm || settings.customHeightMm,
    settings.dpi
  );

  const canvas = document.createElement('canvas');
  canvas.width = widthPx;
  canvas.height = heightPx;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  // Fill background
  ctx.fillStyle = settings.backgroundColor || '#ffffff';
  ctx.fillRect(0, 0, widthPx, heightPx);

  // Calculate image placement with zoom, pan & rotation
  ctx.save();
  ctx.translate(widthPx / 2 + settings.offsetX, heightPx / 2 + settings.offsetY);
  if (settings.rotation) {
    ctx.rotate((settings.rotation * Math.PI) / 180);
  }

  // Cover scale
  const imgAspect = img.width / img.height;
  const canvasAspect = widthPx / heightPx;
  let drawW = widthPx;
  let drawH = heightPx;

  if (imgAspect > canvasAspect) {
    drawH = heightPx * settings.zoom;
    drawW = drawH * imgAspect;
  } else {
    drawW = widthPx * settings.zoom;
    drawH = drawW / imgAspect;
  }

  ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
  ctx.restore();

  // Optional subtle border stroke for cutting clarity
  if (settings.borderStroke) {
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = Math.max(1, Math.round(widthPx / 300));
    ctx.strokeRect(0, 0, widthPx, heightPx);
  }

  return canvas;
}

/**
 * Draws safe biometric positioning guidelines on top of preview
 */
export function drawBiometricGuides(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
) {
  ctx.save();
  // Safe margins
  ctx.strokeStyle = 'rgba(124, 58, 237, 0.4)'; // Soft purple
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);

  // Center vertical line
  ctx.beginPath();
  ctx.moveTo(width / 2, 0);
  ctx.lineTo(width / 2, height);
  ctx.stroke();

  // Eye-level guideline (~56% to 60% from bottom / ~42% from top)
  const eyeLineY = height * 0.42;
  ctx.strokeStyle = 'rgba(59, 130, 246, 0.7)'; // Blue
  ctx.beginPath();
  ctx.moveTo(0, eyeLineY);
  ctx.lineTo(width, eyeLineY);
  ctx.stroke();

  // Crown of head guideline (~10-15% from top)
  const crownLineY = height * 0.12;
  ctx.strokeStyle = 'rgba(16, 185, 129, 0.7)'; // Emerald
  ctx.beginPath();
  ctx.moveTo(0, crownLineY);
  ctx.lineTo(width, crownLineY);
  ctx.stroke();

  // Chin guideline (~75-80% from top)
  const chinLineY = height * 0.78;
  ctx.strokeStyle = 'rgba(239, 68, 68, 0.7)'; // Red
  ctx.beginPath();
  ctx.moveTo(0, chinLineY);
  ctx.lineTo(width, chinLineY);
  ctx.stroke();

  // Head oval guide (approx 70-80% of photo height according to passport rules)
  ctx.strokeStyle = 'rgba(124, 58, 237, 0.6)';
  ctx.beginPath();
  const ovalCenterX = width / 2;
  const ovalCenterY = (crownLineY + chinLineY) / 2;
  const ovalRadiusY = (chinLineY - crownLineY) / 2;
  const ovalRadiusX = ovalRadiusY * 0.75;
  ctx.ellipse(ovalCenterX, ovalCenterY, ovalRadiusX, ovalRadiusY, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

/**
 * Generates a full printable sheet (4x6" or A4) with multiple passport photos,
 * spacing, margins, and cutting guides.
 */
export async function renderPrintableSheet(
  passportCanvas: HTMLCanvasElement,
  settings: PassportSettings,
  preset: PassportPreset
): Promise<HTMLCanvasElement> {
  const dpi = settings.dpi || 300;
  let sheetWidthMm = 101.6; // 4 inches
  let sheetHeightMm = 152.4; // 6 inches

  if (settings.sheetSize === 'A4') {
    sheetWidthMm = 210;
    sheetHeightMm = 297;
  }

  const sheetWidthPx = Math.round((sheetWidthMm / 25.4) * dpi);
  const sheetHeightPx = Math.round((sheetHeightMm / 25.4) * dpi);

  const photoWidthMm = preset.widthMm || settings.customWidthMm;
  const photoHeightMm = preset.heightMm || settings.customHeightMm;

  const photoWidthPx = Math.round((photoWidthMm / 25.4) * dpi);
  const photoHeightPx = Math.round((photoHeightMm / 25.4) * dpi);

  const marginMm = settings.sheetMarginMm ?? 5;
  const spacingMm = settings.sheetSpacingMm ?? 3;

  const marginPx = Math.round((marginMm / 25.4) * dpi);
  const spacingPx = Math.round((spacingMm / 25.4) * dpi);

  // Calculate layout fit
  const availableWPx = sheetWidthPx - marginPx * 2;
  const availableHPx = sheetHeightPx - marginPx * 2;

  const cols = Math.max(1, Math.floor((availableWPx + spacingPx) / (photoWidthPx + spacingPx)));
  const rows = Math.max(1, Math.floor((availableHPx + spacingPx) / (photoHeightPx + spacingPx)));
  const maxFit = cols * rows;

  const requestedCopies = settings.sheetCopies || maxFit;
  const actualCopies = Math.min(requestedCopies, maxFit);

  const sheetCanvas = document.createElement('canvas');
  sheetCanvas.width = sheetWidthPx;
  sheetCanvas.height = sheetHeightPx;
  const ctx = sheetCanvas.getContext('2d');
  if (!ctx) throw new Error('Could not get sheet canvas context');

  // Fill sheet background with pure white
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, sheetWidthPx, sheetHeightPx);

  // Center the grid on the sheet
  const gridTotalWPx = cols * photoWidthPx + (cols - 1) * spacingPx;
  const gridTotalHPx = rows * photoHeightPx + (rows - 1) * spacingPx;
  const startXPx = Math.round((sheetWidthPx - gridTotalWPx) / 2);
  const startYPx = Math.round((sheetHeightPx - gridTotalHPx) / 2);

  let placed = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (placed >= actualCopies) break;

      const x = startXPx + c * (photoWidthPx + spacingPx);
      const y = startYPx + r * (photoHeightPx + spacingPx);

      // Draw photo
      ctx.drawImage(passportCanvas, x, y, photoWidthPx, photoHeightPx);

      // Draw cutting border marks
      if (settings.showCuttingMarks) {
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(x, y, photoWidthPx, photoHeightPx);
        ctx.setLineDash([]);
      }

      placed++;
    }
  }

  // Draw header footer sheet label with metadata
  ctx.fillStyle = '#64748b';
  ctx.font = `${Math.round(10 * (dpi / 300))}px system-ui, sans-serif`;
  ctx.fillText(
    `BG Remover Pro Print Sheet • ${preset.name} (${photoWidthMm}x${photoHeightMm}mm) • ${dpi} DPI • ${settings.sheetSize === 'A4' ? 'A4' : '4x6" Photo Paper'}`,
    startXPx,
    startYPx - 10
  );

  return sheetCanvas;
}

/**
 * Exports a printable canvas to a true physical PDF (4x6" or A4)
 */
export async function exportSheetToPdf(
  sheetCanvas: HTMLCanvasElement,
  sheetSize: '4x6' | 'A4',
  fileName: string = 'passport-print-sheet.pdf'
) {
  const isA4 = sheetSize === 'A4';
  const doc = new jsPDF({
    orientation: isA4 ? 'portrait' : 'portrait',
    unit: 'mm',
    format: isA4 ? 'a4' : [101.6, 152.4],
  });

  const imgData = sheetCanvas.toDataURL('image/jpeg', 0.98);
  const pdfWidth = isA4 ? 210 : 101.6;
  const pdfHeight = isA4 ? 297 : 152.4;

  doc.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
  doc.save(fileName);
}
