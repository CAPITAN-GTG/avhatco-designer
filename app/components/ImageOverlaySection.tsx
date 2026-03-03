"use client";

import { useState, useCallback, forwardRef, useImperativeHandle, useRef } from "react";
import { Sparkles, Upload, X } from "lucide-react";

type Slot = "front" | "side";

const FALLBACK_BASE_IMAGES: Record<Slot, string> = {
  front: "/front.webp",
  side: "/side.webp",
};

export type BaseImages = { front: string; side: string } | null;

const EXPORT_WIDTH = 400;
const EXPORT_HEIGHT = 300;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function drawOverlayContain(
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

export type ImageOverlaySectionHandle = {
  getCompositedImages: () => Promise<{ front?: string; side?: string }>;
};

function DropZone({
  onFile,
  label,
}: {
  onFile: (file: File) => void;
  label: string;
}) {
  const [drag, setDrag] = useState(false);

  const handleFile = useCallback(
    (file: File | null) => {
      if (!file || !file.type.startsWith("image/")) return;
      onFile(file);
    },
    [onFile]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDrag(false);
      handleFile(e.dataTransfer.files[0] ?? null);
    },
    [handleFile]
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDrag(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDrag(false);
  }, []);

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFile(e.target.files?.[0] ?? null);
      e.target.value = "";
    },
    [handleFile]
  );

  return (
    <label
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      className={
        "mt-3 block border rounded-lg px-3 py-2.5 text-center text-xs sm:text-sm cursor-pointer transition-colors " +
        (drag
          ? "border-[#111827] bg-[#f3f4f6] text-[#111827]"
          : "border-[#d1d5db] bg-white text-[#4b5563] hover:border-[#9ca3af] hover:bg-[#f9fafb]")
      }
    >
      <input
        type="file"
        accept="image/*"
        onChange={onInputChange}
        className="sr-only"
      />
      <span className="inline-flex items-center justify-center gap-1.5 text-[11px] sm:text-xs text-[#374151]">
        <Upload className="w-3.5 h-3.5 text-[#6b7280]" aria-hidden="true" />
        {label}
      </span>
    </label>
  );
}

function Slot({
  slot,
  baseSrc,
  overlayUrl,
  onClear,
  onFile,
}: {
  slot: Slot;
  baseSrc: string;
  overlayUrl: string | null;
  onClear: () => void;
  onFile: (file: File) => void;
}) {
  const label = slot === "front" ? "Front" : "Side";

  return (
    <div className="flex flex-col min-w-0">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[11px] sm:text-xs font-medium uppercase tracking-[0.18em] text-[#6b7280]">
          {label} view
        </p>
      </div>
      <div className="relative w-full aspect-4/3 max-h-[240px] sm:max-h-[280px] bg-white rounded-xl border border-[#e5e7eb] overflow-hidden">
        {/* Base image - fills container, overlay sits exactly on top */}
        <img
          src={baseSrc}
          alt={label}
          className="absolute inset-0 w-full h-full object-contain p-2 sm:p-3"
        />
        {/* Overlay - smaller and padded to sit "on the hat"; side has more left padding to shift right */}
        {overlayUrl && (
          <>
            <div
              className={
                "absolute inset-0 flex items-center justify-center py-12 sm:py-16 pointer-events-none " +
                (slot === "side"
                  ? "pl-[calc(5rem-2px)] sm:pl-[calc(7rem-2px)] pr-[calc(2rem+2px)] sm:pr-[calc(3rem+2px)]"
                  : "px-12 sm:px-16")
              }
            >
              <img
                src={overlayUrl}
                alt="Overlay"
                className="max-w-[45%] max-h-[45%] w-auto h-auto object-contain"
              />
            </div>
            <button
              type="button"
              onClick={onClear}
              className="absolute top-2 right-2 inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-md border border-[#d1d5db] bg-white/95 text-[#374151] shadow-sm backdrop-blur-sm hover:bg-[#f9fafb]"
            >
              <X className="w-3 h-3" aria-hidden="true" />
              Clear
            </button>
          </>
        )}
      </div>
      <DropZone
        label={overlayUrl ? "Drop another image to replace" : `Drop image for ${label}`}
        onFile={onFile}
      />
    </div>
  );
}

const ImageOverlaySection = forwardRef<
  ImageOverlaySectionHandle,
  { baseImages?: BaseImages }
>(function ImageOverlaySection({ baseImages = null }, ref) {
  const [overlayFront, setOverlayFront] = useState<string | null>(null);
  const [overlaySide, setOverlaySide] = useState<string | null>(null);

  const baseSrcs: Record<Slot, string> = {
    front: baseImages?.front ?? FALLBACK_BASE_IMAGES.front,
    side: baseImages?.side ?? FALLBACK_BASE_IMAGES.side,
  };

  const setOverlay = useCallback((slot: Slot, file: File | null) => {
    const setter = slot === "front" ? setOverlayFront : setOverlaySide;
    setter((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return file ? URL.createObjectURL(file) : null;
    });
  }, []);

  const handleFile = useCallback(
    (slot: Slot) => (file: File) => setOverlay(slot, file),
    [setOverlay]
  );

  const clearOverlay = useCallback(
    (slot: Slot) => () => setOverlay(slot, null),
    [setOverlay]
  );

  const getCompositedImages = useCallback(async () => {
    const result: { front?: string; side?: string } = {};
    const paddingY = 64;
    const paddingFrontX = 64;
    const paddingSideLeft = 110;
    const paddingSideRight = 50;
    const overlayMaxW = Math.floor(EXPORT_WIDTH * 0.25);
    const overlayMaxH = Math.floor(EXPORT_HEIGHT * 0.25);
    const contentH = EXPORT_HEIGHT - paddingY * 2;
    const frontBase = baseSrcs.front;
    const sideBase = baseSrcs.side;

    if (overlayFront) {
      try {
        const [baseImg, overlayImg] = await Promise.all([
          loadImage(frontBase),
          loadImage(overlayFront),
        ]);
        const canvas = document.createElement("canvas");
        canvas.width = EXPORT_WIDTH;
        canvas.height = EXPORT_HEIGHT;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(baseImg, 0, 0, EXPORT_WIDTH, EXPORT_HEIGHT);
        const contentW = EXPORT_WIDTH - paddingFrontX * 2;
        const ox = paddingFrontX + (contentW - overlayMaxW) / 2;
        const oy = paddingY + (contentH - overlayMaxH) / 2;
        drawOverlayContain(ctx, overlayImg, ox, oy, overlayMaxW, overlayMaxH);
        result.front = canvas.toDataURL("image/png");
      } catch {
        // skip if composition fails (e.g. CORS on external image)
      }
    }

    if (overlaySide) {
      try {
        const [baseImg, overlayImg] = await Promise.all([
          loadImage(sideBase),
          loadImage(overlaySide),
        ]);
        const canvas = document.createElement("canvas");
        canvas.width = EXPORT_WIDTH;
        canvas.height = EXPORT_HEIGHT;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(baseImg, 0, 0, EXPORT_WIDTH, EXPORT_HEIGHT);
        const contentW = EXPORT_WIDTH - paddingSideLeft - paddingSideRight;
        const ox = paddingSideLeft + (contentW - overlayMaxW) / 2;
        const oy = paddingY + (contentH - overlayMaxH) / 2;
        drawOverlayContain(ctx, overlayImg, ox, oy, overlayMaxW, overlayMaxH);
        result.side = canvas.toDataURL("image/png");
      } catch {
        // skip if composition fails
      }
    }

    return result;
  }, [
    overlayFront,
    overlaySide,
    baseImages?.front ?? FALLBACK_BASE_IMAGES.front,
    baseImages?.side ?? FALLBACK_BASE_IMAGES.side,
  ]);

  useImperativeHandle(ref, () => ({ getCompositedImages }), [getCompositedImages]);

  return (
    <div className="min-w-0 max-w-[640px]">
      <div className="flex items-end justify-between gap-3 mb-5">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#e5e7eb] bg-white/80 px-3 py-1 shadow-sm backdrop-blur-sm">
            <Sparkles className="w-3.5 h-3.5 text-[#4b5563]" aria-hidden="true" />
            <span className="text-[11px] uppercase tracking-[0.18em] text-[#6b7280]">
              Live preview
            </span>
          </div>
          <h2 className="mt-3 text-base sm:text-lg font-medium tracking-tight text-[#111827]">
            Design preview
          </h2>
          <p className="text-xs sm:text-sm text-[#4b5563] mt-1">
            {baseImages
              ? "Preview uses the selected product. Drop an image on each view to preview placement."
              : "Select a product, then drop an image on each view to preview placement."}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
        <Slot
          slot="front"
          baseSrc={baseSrcs.front}
          overlayUrl={overlayFront}
          onClear={clearOverlay("front")}
          onFile={handleFile("front")}
        />
        <Slot
          slot="side"
          baseSrc={baseSrcs.side}
          overlayUrl={overlaySide}
          onClear={clearOverlay("side")}
          onFile={handleFile("side")}
        />
      </div>
    </div>
  );
});

export default ImageOverlaySection;
