"use client";

import { useState, useCallback, forwardRef, useImperativeHandle, useRef } from "react";

type Slot = "front" | "side";

const BASE_IMAGES: Record<Slot, string> = {
  front: "/front.webp",
  side: "/side.webp",
};

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
        "mt-2 block border-2 border-dashed rounded-md p-4 text-center text-sm cursor-pointer transition-colors " +
        (drag ? "border-[#1a1a1a] bg-[#eee]" : "border-[#ccc] bg-white hover:border-[#999]")
      }
    >
      <input
        type="file"
        accept="image/*"
        onChange={onInputChange}
        className="sr-only"
      />
      {label}
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
      <div className="relative w-full aspect-[4/3] max-h-[240px] sm:max-h-[280px] bg-[#eee] rounded-md overflow-hidden">
        {/* Base image - fills container, overlay sits exactly on top */}
        <img
          src={baseSrc}
          alt={label}
          className="absolute inset-0 w-full h-full object-contain"
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
              className="absolute top-1 right-1 text-xs px-2 py-1 rounded bg-black/70 text-white hover:bg-black"
            >
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

const ImageOverlaySection = forwardRef<ImageOverlaySectionHandle, object>(
  function ImageOverlaySection(_, ref) {
    const [overlayFront, setOverlayFront] = useState<string | null>(null);
    const [overlaySide, setOverlaySide] = useState<string | null>(null);

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

      if (overlayFront) {
        try {
          const [baseImg, overlayImg] = await Promise.all([
            loadImage(BASE_IMAGES.front),
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
          // skip if composition fails
        }
      }

      if (overlaySide) {
        try {
          const [baseImg, overlayImg] = await Promise.all([
            loadImage(BASE_IMAGES.side),
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
    }, [overlayFront, overlaySide]);

    useImperativeHandle(ref, () => ({ getCompositedImages }), [getCompositedImages]);

    return (
      <div className="min-w-0 max-w-[560px]">
        <div className="flex items-end justify-between gap-3 mb-4">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-[#444]">Design preview</h2>
            <p className="text-xs text-[#666] mt-1">
              Drop an image on each view to preview placement.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          <Slot
            slot="front"
            baseSrc={BASE_IMAGES.front}
            overlayUrl={overlayFront}
            onClear={clearOverlay("front")}
            onFile={handleFile("front")}
          />
          <Slot
            slot="side"
            baseSrc={BASE_IMAGES.side}
            overlayUrl={overlaySide}
            onClear={clearOverlay("side")}
            onFile={handleFile("side")}
          />
        </div>
      </div>
    );
  }
);

export default ImageOverlaySection;
