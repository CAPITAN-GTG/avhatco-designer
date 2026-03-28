import { loadImage } from "@/app/components/designer/overlayCanvas";

/** Default matches previous in-editor removal behavior. */
export const DEFAULT_BG_REMOVE_TOLERANCE = 42;

/** Chroma removal defaults to white (common artwork backgrounds). */
export const DEFAULT_BG_REMOVE_HEX = "#ffffff";

export type PaletteSwatch = { hex: string; count: number };

function hexFromRgb(r: number, g: number, b: number): string {
  const h = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`.toUpperCase();
}

function parseHex(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "");
  const targetR = Number.parseInt(clean.slice(0, 2), 16) || 255;
  const targetG = Number.parseInt(clean.slice(2, 4), 16) || 255;
  const targetB = Number.parseInt(clean.slice(4, 6), 16) || 255;
  return { r: targetR, g: targetG, b: targetB };
}

/**
 * Dominant opaque colors after light quantization (for swatch picker).
 */
export async function extractPaletteFromDataUrl(
  dataUrl: string,
  maxSwatches = 10
): Promise<PaletteSwatch[]> {
  const img = await loadImage(dataUrl);
  const iw = img.naturalWidth || 1;
  const ih = img.naturalHeight || 1;
  const maxSide = 200;
  const scale = Math.min(1, maxSide / Math.max(iw, ih));
  const w = Math.max(1, Math.round(iw * scale));
  const h = Math.max(1, Math.round(ih * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return [];
  ctx.drawImage(img, 0, 0, w, h);
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  const STEP = 20;
  const counts = new Map<string, { r: number; g: number; b: number; n: number }>();
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 28) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const br = Math.round(r / STEP) * STEP;
    const bg = Math.round(g / STEP) * STEP;
    const bb = Math.round(b / STEP) * STEP;
    const key = `${br},${bg},${bb}`;
    const cur = counts.get(key);
    if (cur) cur.n += 1;
    else counts.set(key, { r: br, g: bg, b: bb, n: 1 });
  }
  const sorted = [...counts.values()].sort((a, b) => b.n - a.n).slice(0, maxSwatches);
  return sorted.map((x) => ({ hex: hexFromRgb(x.r, x.g, x.b), count: x.n }));
}

/**
 * Make pixels matching `hex` within `tolerance` (Euclidean RGB distance) transparent.
 */
export async function removeColorFromImageDataUrl(
  dataUrl: string,
  hex: string,
  tolerance: number
): Promise<string> {
  const img = await loadImage(dataUrl);
  const width = img.naturalWidth || 1;
  const height = img.naturalHeight || 1;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, width, height);
  const imageData = ctx.getImageData(0, 0, width, height);
  const d = imageData.data;
  const { r: targetR, g: targetG, b: targetB } = parseHex(hex);
  const feather = 16;
  const softStart = Math.max(0, tolerance - feather);

  for (let i = 0; i < d.length; i += 4) {
    const dr = d[i] - targetR;
    const dg = d[i + 1] - targetG;
    const db = d[i + 2] - targetB;
    const distance = Math.sqrt(dr * dr + dg * dg + db * db);
    if (distance <= softStart) {
      d[i + 3] = 0;
      continue;
    }
    if (distance >= tolerance) continue;
    const keep = (distance - softStart) / Math.max(1, tolerance - softStart);
    d[i + 3] = Math.round(d[i + 3] * keep);
  }

  ctx.putImageData(imageData, 0, 0);
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((result) => resolve(result), "image/png");
  });
  if (!blob) return dataUrl;
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("read"));
    reader.readAsDataURL(blob);
  });
}

/**
 * Normalize uploads to PNG data URLs for consistent removal + export.
 */
export async function imageFileToPngDataUrl(file: File): Promise<string | null> {
  const sourceDataUrl = await new Promise<string | null>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("read"));
    reader.readAsDataURL(file);
  }).catch(() => null);
  if (!sourceDataUrl) return null;
  try {
    const img = await loadImage(sourceDataUrl);
    const width = img.naturalWidth || 1;
    const height = img.naturalHeight || 1;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((result) => resolve(result), "image/png");
    });
    if (!blob) return null;
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("read"));
      reader.readAsDataURL(blob);
    });
  } catch {
    return sourceDataUrl;
  }
}
