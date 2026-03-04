"use client";

import { useState, useCallback, forwardRef, useImperativeHandle, useRef, useEffect } from "react";
import { Sparkles, Upload, X, Maximize2 } from "lucide-react";

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

/** Draw image scaled to fit in (w x h), centered. Returns the actual draw rect. */
function drawImageContain(
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
  rightAction,
}: {
  onFile: (file: File) => void;
  label: string;
  rightAction?: React.ReactNode;
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

  const labelClass =
    "border rounded-l-lg px-3 py-2.5 text-center text-xs sm:text-sm cursor-pointer transition-colors " +
    (rightAction ? "flex-1 flex items-center justify-center gap-1.5 rounded-r-none border-r-0 " : "mt-3 block rounded-r-lg ") +
    (drag
      ? "border-[#111827] bg-[#f3f4f6] text-[#111827]"
      : "border-[#d1d5db] bg-white text-[#4b5563] hover:border-[#9ca3af] hover:bg-[#f9fafb]");

  const content = (
    <>
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
    </>
  );

  if (rightAction) {
    return (
      <div className="mt-3 flex items-stretch">
        <label
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          className={labelClass}
        >
          {content}
        </label>
        {rightAction}
      </div>
    );
  }

  return (
    <label
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      className={labelClass}
    >
      {content}
    </label>
  );
}

/** Position as fraction of content area (0–1). 0.5, 0.5 = center. */
export type NormalizedPosition = { x: number; y: number };

const CENTER_POSITION: NormalizedPosition = { x: 0.5, y: 0.5 };

const OVERLAY_SCALE_MIN = 0.4;
const OVERLAY_SCALE_MAX = 1.2;
const OVERLAY_SCALE_DEFAULT = 1;

function Slot({
  slot,
  baseSrc,
  overlayUrl,
  overlayPosition,
  overlayScale,
  onPositionChange,
  onScaleChange,
  onClear,
  onFile,
}: {
  slot: Slot;
  baseSrc: string;
  overlayUrl: string | null;
  overlayPosition: NormalizedPosition;
  overlayScale: number;
  onPositionChange: (pos: NormalizedPosition) => void;
  onScaleChange: (scale: number) => void;
  onClear: () => void;
  onFile: (file: File) => void;
}) {
  const label = slot === "front" ? "Front" : "Side";
  const [position, setPosition] = useState<NormalizedPosition>(() => overlayPosition);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ clientX: 0, clientY: 0, startX: 0, startY: 0 });
  const innerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setPosition(overlayPosition);
  }, [overlayPosition]);

  useEffect(() => {
    if (!overlayUrl) setPosition(CENTER_POSITION);
  }, [overlayUrl]);

  const innerPaddingClass =
    slot === "side"
      ? "pl-[calc(5rem-2px)] sm:pl-[calc(7rem-2px)] pr-[calc(2rem+2px)] sm:pr-[calc(3rem+2px)] py-12 sm:py-16"
      : "px-12 sm:px-16 py-12 sm:py-16";

  const clampToContent = useCallback(
    (centerX: number, centerY: number) => {
      const inner = innerRef.current;
      const overlay = overlayRef.current;
      if (!inner || !overlay) return { x: 0.5, y: 0.5 };
      const innerRect = inner.getBoundingClientRect();
      const overlayRect = overlay.getBoundingClientRect();
      const minX = innerRect.left + overlayRect.width / 2;
      const maxX = innerRect.right - overlayRect.width / 2;
      const minY = innerRect.top + overlayRect.height / 2;
      const maxY = innerRect.bottom - overlayRect.height / 2;
      const clampedX = Math.max(minX, Math.min(maxX, centerX));
      const clampedY = Math.max(minY, Math.min(maxY, centerY));
      return {
        x: (clampedX - innerRect.left) / innerRect.width,
        y: (clampedY - innerRect.top) / innerRect.height,
      };
    },
    []
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      setIsDragging(true);
      dragStart.current = {
        clientX: e.clientX,
        clientY: e.clientY,
        startX: position.x,
        startY: position.y,
      };
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    },
    [position]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return;
      const inner = innerRef.current;
      if (!inner) return;
      const innerRect = inner.getBoundingClientRect();
      const startCenterX = innerRect.left + dragStart.current.startX * innerRect.width;
      const startCenterY = innerRect.top + dragStart.current.startY * innerRect.height;
      const dx = e.clientX - dragStart.current.clientX;
      const dy = e.clientY - dragStart.current.clientY;
      const next = clampToContent(startCenterX + dx, startCenterY + dy);
      setPosition(next);
    },
    [isDragging, clampToContent]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return;
      setIsDragging(false);
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
      onPositionChange(position);
    },
    [isDragging, position, onPositionChange]
  );

  const [showFullScreen, setShowFullScreen] = useState(false);

  return (
    <div className="flex flex-col min-w-0">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[11px] sm:text-xs font-medium uppercase tracking-[0.18em] text-[#6b7280]">
          {label} view
        </p>
      </div>
      <div className="relative w-full aspect-4/3 max-h-[240px] sm:max-h-[280px] bg-white rounded-xl border border-[#e5e7eb] overflow-hidden">
        <img
          src={baseSrc}
          alt={label}
          className="absolute inset-0 w-full h-full object-contain p-2 sm:p-3"
        />
        {overlayUrl && (
          <>
            <div
              ref={innerRef}
              className={`absolute inset-0 flex items-center justify-center pointer-events-none ${innerPaddingClass}`}
            >
              <div
                className="absolute flex items-center justify-center pointer-events-auto cursor-grab active:cursor-grabbing w-full h-full"
                style={{
                  left: `${position.x * 100}%`,
                  top: `${position.y * 100}%`,
                  transform: "translate(-50%, -50%)",
                }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={(e) => {
                  if (isDragging) handlePointerUp(e);
                }}
              >
                <img
                  ref={overlayRef}
                  src={overlayUrl}
                  alt="Overlay"
                  className="max-w-[45%] max-h-[45%] w-auto h-auto object-contain select-none touch-none"
                  style={{ transform: `scale(${overlayScale})` }}
                  draggable={false}
                />
              </div>
            </div>
            <div
              className="absolute left-0 top-0 bottom-0 w-9 flex flex-col items-center justify-center z-10 bg-white/95 backdrop-blur-sm border-r border-[#e5e7eb] rounded-l-xl"
              style={{ paddingLeft: "2px" }}
            >
              <span className="text-[9px] font-medium uppercase tracking-wider text-[#6b7280] mb-1.5 mt-3 whitespace-nowrap">
                Size
              </span>
              <div className="flex-1 flex items-center justify-center min-h-0 overflow-visible">
                <input
                  type="range"
                  min={OVERLAY_SCALE_MIN}
                  max={OVERLAY_SCALE_MAX}
                  step={0.05}
                  value={overlayScale}
                  onChange={(e) => onScaleChange(parseFloat(e.target.value))}
                  className="appearance-none bg-transparent cursor-pointer touch-none [&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-[#e5e7eb] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#111827] [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:active:cursor-grabbing [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:mt-[calc(-0.5rem+4px)] [&::-moz-range-track]:h-2 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-[#e5e7eb] [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-[#111827] [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-grab"
                  style={{
                    transform: "rotate(-90deg)",
                    width: "120px",
                    height: "8px",
                  }}
                  aria-label="Overlay size"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={onClear}
              className="absolute top-2 right-2 inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-md border border-[#d1d5db] bg-white/95 text-[#374151] shadow-sm backdrop-blur-sm hover:bg-[#f9fafb] z-10"
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
        rightAction={
          <button
            type="button"
            onClick={() => setShowFullScreen(true)}
            className="inline-flex items-center justify-center gap-1 px-2.5 py-2 rounded-r-lg border border-[#d1d5db] border-l-0 bg-white text-[#4b5563] hover:bg-[#f9fafb] text-[11px] sm:text-xs"
            title="Preview full screen"
          >
            <Maximize2 className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        }
      />
      {showFullScreen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setShowFullScreen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Design preview full screen"
        >
          <button
            type="button"
            onClick={() => setShowFullScreen(false)}
            className="absolute top-3 right-3 p-2 rounded-lg bg-white/10 text-white hover:bg-white/20"
            aria-label="Close preview"
          >
            <X className="w-5 h-5" />
          </button>
          <div
            className="relative w-full max-w-4xl aspect-4/3 bg-white rounded-lg overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={baseSrc}
              alt={label}
              className="absolute inset-0 w-full h-full object-contain p-4 sm:p-8"
            />
            {overlayUrl && (
              <div
                className="absolute inset-0 flex items-center justify-center p-12 sm:p-20"
              >
                <div
                  className="absolute flex items-center justify-center w-full h-full"
                  style={{
                    left: `${position.x * 100}%`,
                    top: `${position.y * 100}%`,
                    transform: "translate(-50%, -50%)",
                  }}
                >
                  <img
                    src={overlayUrl}
                    alt="Overlay"
                    className="max-w-[45%] max-h-[45%] w-auto h-auto object-contain pointer-events-none"
                    style={{ transform: `scale(${overlayScale})` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const ImageOverlaySection = forwardRef<
  ImageOverlaySectionHandle,
  { baseImages?: BaseImages; onLocationsChange?: (count: number) => void }
>(function ImageOverlaySection({ baseImages = null, onLocationsChange }, ref) {
  const [overlayFront, setOverlayFront] = useState<string | null>(null);
  const [overlaySide, setOverlaySide] = useState<string | null>(null);
  const [positionFront, setPositionFront] = useState<NormalizedPosition>(CENTER_POSITION);
  const [positionSide, setPositionSide] = useState<NormalizedPosition>(CENTER_POSITION);
  const [scaleFront, setScaleFront] = useState(OVERLAY_SCALE_DEFAULT);
  const [scaleSide, setScaleSide] = useState(OVERLAY_SCALE_DEFAULT);

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
    if (!file) {
      if (slot === "front") {
        setPositionFront(CENTER_POSITION);
        setScaleFront(OVERLAY_SCALE_DEFAULT);
      } else {
        setPositionSide(CENTER_POSITION);
        setScaleSide(OVERLAY_SCALE_DEFAULT);
      }
    }
  }, []);

  useEffect(() => {
    if (!onLocationsChange) return;
    const count = (overlayFront ? 1 : 0) + (overlaySide ? 1 : 0);
    onLocationsChange(count);
  }, [overlayFront, overlaySide, onLocationsChange]);

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
    // Match UI: base image drawn with contain (fit, centered); content = inset within base rect; overlay = 45% of content * scale
    const INSET = 0.12;
    const SIDE_INSET_LEFT = 0.28;
    const SIDE_INSET_RIGHT = 0.12;
    const OVERLAY_FRACTION = 0.52;

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
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, EXPORT_WIDTH, EXPORT_HEIGHT);
        const base = drawImageContain(ctx, baseImg, EXPORT_WIDTH, EXPORT_HEIGHT);
        const contentLeft = base.x + base.w * INSET;
        const contentTop = base.y + base.h * INSET;
        const contentW = base.w * (1 - INSET * 2);
        const contentH = base.h * (1 - INSET * 2);
        const centerX = contentLeft + positionFront.x * contentW;
        const centerY = contentTop + positionFront.y * contentH;
        const overlayMaxW = Math.max(4, Math.floor(contentW * OVERLAY_FRACTION * scaleFront));
        const overlayMaxH = Math.max(4, Math.floor(contentH * OVERLAY_FRACTION * scaleFront));
        const ox = centerX - overlayMaxW / 2;
        const oy = centerY - overlayMaxH / 2;
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
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, EXPORT_WIDTH, EXPORT_HEIGHT);
        const base = drawImageContain(ctx, baseImg, EXPORT_WIDTH, EXPORT_HEIGHT);
        const contentLeft = base.x + base.w * SIDE_INSET_LEFT;
        const contentTop = base.y + base.h * INSET;
        const contentW = base.w * (1 - SIDE_INSET_LEFT - SIDE_INSET_RIGHT);
        const contentH = base.h * (1 - INSET * 2);
        const centerX = contentLeft + positionSide.x * contentW;
        const centerY = contentTop + positionSide.y * contentH;
        const overlayMaxW = Math.max(4, Math.floor(contentW * OVERLAY_FRACTION * scaleSide));
        const overlayMaxH = Math.max(4, Math.floor(contentH * OVERLAY_FRACTION * scaleSide));
        const ox = centerX - overlayMaxW / 2;
        const oy = centerY - overlayMaxH / 2;
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
    positionFront,
    positionSide,
    scaleFront,
    scaleSide,
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
          overlayPosition={positionFront}
          overlayScale={scaleFront}
          onPositionChange={setPositionFront}
          onScaleChange={setScaleFront}
          onClear={clearOverlay("front")}
          onFile={handleFile("front")}
        />
        <Slot
          slot="side"
          baseSrc={baseSrcs.side}
          overlayUrl={overlaySide}
          overlayPosition={positionSide}
          overlayScale={scaleSide}
          onPositionChange={setPositionSide}
          onScaleChange={setScaleSide}
          onClear={clearOverlay("side")}
          onFile={handleFile("side")}
        />
      </div>
    </div>
  );
});

export default ImageOverlaySection;
