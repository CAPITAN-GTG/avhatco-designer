export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Downscale a leatherette patch texture for export composites only (production uses source assets).
 */
export async function downscaleImageForPatchExport(
  img: HTMLImageElement,
  maxSide: number
): Promise<HTMLImageElement> {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (!w || !h) return img;
  const m = Math.max(w, h);
  if (m <= maxSide) return img;
  const scale = maxSide / m;
  const cw = Math.round(w * scale);
  const ch = Math.round(h * scale);
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  if (!ctx) return img;
  ctx.drawImage(img, 0, 0, cw, ch);
  return loadImage(canvas.toDataURL("image/png"));
}

/** Draw image scaled to fit in (w x h), centered. Returns the actual draw rect. */
export function drawImageContain(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  canvasW: number,
  canvasH: number
): { x: number; y: number; w: number; h: number } {
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const scale = Math.min(canvasW / iw, canvasH / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = (canvasW - dw) / 2;
  const dy = (canvasH - dh) / 2;
  ctx.drawImage(img, dx, dy, dw, dh);
  return { x: dx, y: dy, w: dw, h: dh };
}

export function drawOverlayContain(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const scale = Math.min(w / iw, h / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = x + (w - dw) / 2;
  const dy = y + (h - dh) / 2;
  ctx.drawImage(img, dx, dy, dw, dh);
}
