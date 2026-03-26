"use client";

import {
  useState,
  useCallback,
  forwardRef,
  useImperativeHandle,
  useRef,
  useEffect,
  useMemo,
} from "react";
import { Undo2, Redo2, Copy } from "lucide-react";
import { DesignerHelpDialog } from "./DesignerHelpDialog";
import {
  type DecorationType,
  leatherPatchPreviewMaxFrac,
} from "@/lib/decoration";
import type { BaseImages, NormalizedPosition } from "./designer/overlayConstants";
import {
  CENTER_POSITION,
  DIE_CUT_SCALE_DEFAULT,
  FALLBACK_BASE_IMAGES,
  DESIGN_ONLY_MAX_PX,
  OVERLAY_SCALE_DEFAULT,
  type Slot,
} from "./designer/overlayConstants";
import { loadImage } from "./designer/overlayCanvas";
import { OverlaySlot } from "./designer/OverlaySlot";
import { toPng } from "html-to-image";
import {
  cloneSlot,
  useSlotTransformHistory,
} from "./designer/useSlotTransformHistory";

export type { BaseImages } from "./designer/overlayConstants";

export type ImageOverlaySectionHandle = {
  getCompositedImages: () => Promise<{
    front?: string;
    frontScalePreview?: string;
    side?: string;
    frontDesignOnly?: string;
    sideDesignOnly?: string;
    /** Full-resolution die-cut shape file (business email / production). */
    dieCutShapeHighResDataUrl?: string;
  }>;
};

function slotToolbarButtonClass(disabled?: boolean) {
  return (
    "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-white " +
    "text-zinc-700 shadow-sm hover:bg-sky-50/90 hover:border-sky-200 hover:text-zinc-900 active:bg-zinc-100 transition-colors " +
    (disabled ? "opacity-35 pointer-events-none shadow-none" : "")
  );
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function isVectorMimeType(mimeType: string): boolean {
  const type = mimeType.toLowerCase();
  return (
    type.includes("svg") ||
    type.includes("pdf") ||
    type.includes("postscript") ||
    type.includes("illustrator")
  );
}

async function objectUrlToEmailSafeDataUrl(url: string): Promise<string | undefined> {
  try {
    const blob = await fetch(url).then((r) => r.blob());
    if (isVectorMimeType(blob.type)) {
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("read"));
        reader.readAsDataURL(blob);
      });
    }

    const objectUrl = URL.createObjectURL(blob);
    try {
      const img = await loadImage(objectUrl);
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth || 1;
      canvas.height = img.naturalHeight || 1;
      const ctx = canvas.getContext("2d");
      if (!ctx) return undefined;
      ctx.drawImage(img, 0, 0);
      return canvas.toDataURL("image/png");
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch {
    return undefined;
  }
}

async function fileToPngDataUrl(file: File): Promise<string | null> {
  const sourceDataUrl = await new Promise<string>((resolve, reject) => {
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

const ImageOverlaySection = forwardRef<
  ImageOverlaySectionHandle,
  {
    baseImages?: BaseImages;
    onLocationsChange?: (count: number) => void;
    decorationType?: DecorationType;
    leatherPatchImageSrc?: string | null;
    leatherOutline?: string | null;
    leatherColor?: string | null;
    /** User-uploaded silhouette / shape for die-cut outline (data URL). */
    dieCutShapeUrl?: string | null;
  }
>(function ImageOverlaySection(
  {
    baseImages = null,
    onLocationsChange,
    decorationType = "embroidery",
    leatherPatchImageSrc = null,
    leatherOutline = null,
    leatherColor = null,
    dieCutShapeUrl = null,
  },
  ref
) {
  const patchMaxFrac = useMemo(
    () => leatherPatchPreviewMaxFrac(leatherOutline),
    [leatherOutline]
  );

  const frontHistory = useSlotTransformHistory();
  const sideHistory = useSlotTransformHistory();

  const prevDecorationRef = useRef(decorationType);

  const frontPresentRef = useRef(frontHistory.present);
  frontPresentRef.current = frontHistory.present;
  const sidePresentRef = useRef(sideHistory.present);
  sidePresentRef.current = sideHistory.present;

  const [overlayFront, setOverlayFront] = useState<string | null>(null);
  const [overlaySide, setOverlaySide] = useState<string | null>(null);
  const [dieCutScale, setDieCutScale] = useState(DIE_CUT_SCALE_DEFAULT);
  const [patchPosition, setPatchPosition] =
    useState<NormalizedPosition>(CENTER_POSITION);
  const patchPositionRef = useRef(patchPosition);
  useEffect(() => {
    patchPositionRef.current = patchPosition;
  }, [patchPosition]);

  const frontScaleStartRef = useRef<ReturnType<typeof cloneSlot> | null>(null);
  const sideScaleStartRef = useRef<ReturnType<typeof cloneSlot> | null>(null);
  const exportFrontStageRef = useRef<HTMLDivElement | null>(null);
  const exportFrontScaleStageRef = useRef<HTMLDivElement | null>(null);
  const exportSideStageRef = useRef<HTMLDivElement | null>(null);

  const baseSrcs: Record<Slot, string> = {
    front: baseImages?.front ?? FALLBACK_BASE_IMAGES.front,
    side: baseImages?.side ?? FALLBACK_BASE_IMAGES.side,
  };

  const patchFront = frontHistory.patchPresent;
  const clearFrontHist = frontHistory.clearHistory;
  const patchSide = sideHistory.patchPresent;
  const clearSideHist = sideHistory.clearHistory;

  const setOverlay = useCallback(
    (slot: Slot, file: File | null) => {
      const setter = slot === "front" ? setOverlayFront : setOverlaySide;
      if (!file) {
        setter(null);
      } else {
        void (async () => {
          const pngUrl = await fileToPngDataUrl(file);
          setter(pngUrl);
        })();
      }
      if (!file) {
        if (slot === "front") {
          patchFront({
            position: CENTER_POSITION,
            scale: OVERLAY_SCALE_DEFAULT,
          });
          clearFrontHist();
        } else {
          patchSide({
            position: CENTER_POSITION,
            scale: OVERLAY_SCALE_DEFAULT,
          });
          clearSideHist();
        }
      }
    },
    [patchFront, clearFrontHist, patchSide, clearSideHist]
  );

  useEffect(() => {
    const was = prevDecorationRef.current;
    prevDecorationRef.current = decorationType;
    if (decorationType !== "leather" || was === "leather") return;
    setOverlaySide(null);
    patchSide({
      position: CENTER_POSITION,
      scale: OVERLAY_SCALE_DEFAULT,
    });
    clearSideHist();
  }, [decorationType, patchSide, clearSideHist]);

  useEffect(() => {
    if (!onLocationsChange) return;
    if (decorationType === "leather") {
      onLocationsChange(overlayFront ? 1 : 0);
      return;
    }
    const count = (overlayFront ? 1 : 0) + (overlaySide ? 1 : 0);
    onLocationsChange(count);
  }, [overlayFront, overlaySide, onLocationsChange, decorationType]);

  useEffect(() => {
    if (!dieCutShapeUrl || leatherOutline !== "die cut") {
      setDieCutScale(DIE_CUT_SCALE_DEFAULT);
    }
  }, [dieCutShapeUrl, leatherOutline]);

  const handleFile = useCallback(
    (slot: Slot) => (file: File) => setOverlay(slot, file),
    [setOverlay]
  );

  const clearOverlay = useCallback(
    (slot: Slot) => () => setOverlay(slot, null),
    [setOverlay]
  );

  const exportDesignOnly = useCallback(async (objectUrl: string): Promise<string | undefined> => {
    try {
      const img = await loadImage(objectUrl);
      const iw = img.naturalWidth;
      const ih = img.naturalHeight;
      if (!iw || !ih) return undefined;
      const scale = Math.min(1, DESIGN_ONLY_MAX_PX / Math.max(iw, ih));
      const w = Math.round(iw * scale);
      const h = Math.round(ih * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, w, h);
      return canvas.toDataURL("image/png");
    } catch {
      return undefined;
    }
  }, []);

  const getCompositedImages = useCallback(async () => {
    const result: {
      front?: string;
      frontScalePreview?: string;
      side?: string;
      frontDesignOnly?: string;
      sideDesignOnly?: string;
      dieCutShapeHighResDataUrl?: string;
    } = {};
    /**
     * Export front composite when:
     * - customer artwork exists, or
     * - leather die-cut shape is submitted standalone (no artwork).
     */
    const shouldExportFront =
      Boolean(overlayFront) ||
      (decorationType === "leather" &&
        leatherOutline === "die cut" &&
        Boolean(dieCutShapeUrl));

    if (shouldExportFront) {
      if (exportFrontStageRef.current) {
        const frontPng = await toPng(exportFrontStageRef.current, {
          cacheBust: true,
          pixelRatio: 2,
          backgroundColor: "#ffffff",
        });
        result.front = frontPng;
      }
      if (exportFrontScaleStageRef.current) {
        result.frontScalePreview = await toPng(exportFrontScaleStageRef.current, {
          cacheBust: true,
          pixelRatio: 2,
          backgroundColor: "#ffffff",
        });
      }
      if (!result.frontScalePreview) result.frontScalePreview = result.front;
      if (overlayFront) {
        result.frontDesignOnly = await exportDesignOnly(overlayFront);
      }
    }

    if (
      decorationType === "leather" &&
      leatherOutline === "die cut" &&
      dieCutShapeUrl
    ) {
      const hi = await objectUrlToEmailSafeDataUrl(dieCutShapeUrl);
      if (hi) result.dieCutShapeHighResDataUrl = hi;
    }

    if (decorationType !== "leather" && overlaySide) {
      if (exportSideStageRef.current) {
        result.side = await toPng(exportSideStageRef.current, {
          cacheBust: true,
          pixelRatio: 2,
          backgroundColor: "#ffffff",
        });
      }
      result.sideDesignOnly = await exportDesignOnly(overlaySide);
    }

    return result;
  }, [
    overlayFront,
    overlaySide,
    exportDesignOnly,
    decorationType,
    leatherPatchImageSrc,
    leatherOutline,
    dieCutShapeUrl,
    dieCutScale,
    patchPosition,
    baseImages?.front ?? FALLBACK_BASE_IMAGES.front,
    baseImages?.side ?? FALLBACK_BASE_IMAGES.side,
  ]);

  useImperativeHandle(ref, () => ({ getCompositedImages }), [getCompositedImages]);

  const copyFrontToSide = useCallback(async () => {
    if (decorationType === "leather" || !overlayFront) return;
    setOverlaySide(overlayFront);
    const f = frontPresentRef.current;
    sideHistory.commit({
      position: { ...f.position },
      scale: f.scale,
    });
  }, [decorationType, overlayFront, sideHistory]);

  const copySideToFront = useCallback(async () => {
    if (decorationType === "leather" || !overlaySide) return;
    setOverlayFront(overlaySide);
    const s = sidePresentRef.current;
    frontHistory.commit({
      position: { ...s.position },
      scale: s.scale,
    });
  }, [decorationType, overlaySide, frontHistory]);

  const onFrontScalePointerDown = useCallback(() => {
    frontScaleStartRef.current = cloneSlot(frontPresentRef.current);
  }, []);

  const onFrontScalePointerUp = useCallback(() => {
    const start = frontScaleStartRef.current;
    frontScaleStartRef.current = null;
    if (start) frontHistory.recordCheckpoint(start);
  }, [frontHistory]);

  const onSideScalePointerDown = useCallback(() => {
    sideScaleStartRef.current = cloneSlot(sidePresentRef.current);
  }, []);

  const onSideScalePointerUp = useCallback(() => {
    const start = sideScaleStartRef.current;
    sideScaleStartRef.current = null;
    if (start) sideHistory.recordCheckpoint(start);
  }, [sideHistory]);

  const frontActions = useMemo(
    () => (
      <>
        <button
          type="button"
          onClick={frontHistory.undo}
          disabled={!frontHistory.canUndo}
          className={slotToolbarButtonClass(!frontHistory.canUndo)}
          title="Undo"
          aria-label="Undo front placement and size"
        >
          <Undo2 className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={frontHistory.redo}
          disabled={!frontHistory.canRedo}
          className={slotToolbarButtonClass(!frontHistory.canRedo)}
          title="Redo"
          aria-label="Redo front placement and size"
        >
          <Redo2 className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
        {decorationType !== "leather" && (
          <button
            type="button"
            onClick={() => void copyFrontToSide()}
            disabled={!overlayFront}
            className={slotToolbarButtonClass(!overlayFront)}
            title="Copy artwork and placement to side view"
            aria-label="Copy front to side"
          >
            <Copy className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        )}
      </>
    ),
    [
      frontHistory.undo,
      frontHistory.redo,
      frontHistory.canUndo,
      frontHistory.canRedo,
      decorationType,
      overlayFront,
      copyFrontToSide,
    ]
  );

  const sideActions = useMemo(
    () => (
      <>
        <button
          type="button"
          onClick={sideHistory.undo}
          disabled={!sideHistory.canUndo}
          className={slotToolbarButtonClass(!sideHistory.canUndo)}
          title="Undo"
          aria-label="Undo side placement and size"
        >
          <Undo2 className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={sideHistory.redo}
          disabled={!sideHistory.canRedo}
          className={slotToolbarButtonClass(!sideHistory.canRedo)}
          title="Redo"
          aria-label="Redo side placement and size"
        >
          <Redo2 className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => void copySideToFront()}
          disabled={!overlaySide}
          className={slotToolbarButtonClass(!overlaySide)}
          title="Copy artwork and placement to front view"
          aria-label="Copy side to front"
        >
          <Copy className="w-3 h-3" aria-hidden="true" />
        </button>
      </>
    ),
    [
      sideHistory.undo,
      sideHistory.redo,
      sideHistory.canUndo,
      sideHistory.canRedo,
      overlaySide,
      copySideToFront,
    ]
  );

  // Export-only visual correction to match live preview more closely.
  const exportFrontOverlayPosition = useMemo(
    () => ({
      x:
        decorationType === "leather"
          ? clamp01(frontHistory.present.position.x + 0.01)
          : clamp01(frontHistory.present.position.x - 0.02),
      y: frontHistory.present.position.y,
    }),
    [decorationType, frontHistory.present.position.x, frontHistory.present.position.y]
  );
  const exportFrontPatchMaxFrac =
    decorationType === "leather" ? patchMaxFrac * 0.85 : patchMaxFrac;
  const exportFrontScalePreviewPatchMaxFrac =
    decorationType === "leather" ? exportFrontPatchMaxFrac * 1.35 : exportFrontPatchMaxFrac;
  const exportFrontScalePreviewOverlayScale = frontHistory.present.scale * 1.12;

  return (
    <div className="min-w-0 w-full max-w-none">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4 sm:mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <DesignerHelpDialog />
          </div>
          <h2 className="mt-1 text-base sm:text-lg font-medium tracking-tight text-[#111827]">Preview</h2>
          <p className="text-xs sm:text-sm text-zinc-600 mt-1 max-w-3xl leading-snug">
            {decorationType === "leather"
              ? "Leatherette: front view only."
              : baseImages
                ? "Embroidery: front + side views."
                : "Select a product to start."}
          </p>
        </div>
      </div>

      <div
        className={
          decorationType === "leather"
            ? "grid grid-cols-1 gap-4 sm:gap-5 w-full min-w-0"
            : "grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 w-full"
        }
      >
        <OverlaySlot
          slot="front"
          baseSrc={baseSrcs.front}
          overlayUrl={overlayFront}
          patchUnderlayUrl={
            decorationType === "leather" ? leatherPatchImageSrc : null
          }
          patchPosition={
            decorationType === "leather" ? patchPosition : undefined
          }
          onPatchPositionCommit={
            decorationType === "leather"
              ? (pos) => setPatchPosition(pos)
              : undefined
          }
          patchDieCutShapeUrl={
            decorationType === "leather" && leatherOutline === "die cut"
              ? dieCutShapeUrl
              : null
          }
          dieCutScale={
            decorationType === "leather" &&
            leatherOutline === "die cut" &&
            dieCutShapeUrl
              ? dieCutScale
              : undefined
          }
          onDieCutScaleLive={
            decorationType === "leather" &&
            leatherOutline === "die cut" &&
            dieCutShapeUrl
              ? setDieCutScale
              : undefined
          }
          patchMaxFrac={patchMaxFrac}
          overlayPosition={frontHistory.present.position}
          overlayScale={frontHistory.present.scale}
          onPositionCommit={(pos) => frontHistory.commit({ position: pos })}
          onScaleLive={(v) => frontHistory.patchPresent({ scale: v })}
          onScalePointerDown={onFrontScalePointerDown}
          onScalePointerUp={onFrontScalePointerUp}
          onClear={clearOverlay("front")}
          onFile={handleFile("front")}
          onOverlayProcessed={setOverlayFront}
          decorationType={decorationType}
          leatherColor={leatherColor}
          slotActions={overlayFront ? frontActions : undefined}
          soloFullWidth={decorationType === "leather"}
          largerPreviewMobileOnly={decorationType === "leather"}
        />
        {decorationType !== "leather" && (
          <OverlaySlot
            slot="side"
            baseSrc={baseSrcs.side}
            overlayUrl={overlaySide}
            patchUnderlayUrl={null}
            patchMaxFrac={0.22}
            overlayPosition={sideHistory.present.position}
            overlayScale={sideHistory.present.scale}
            onPositionCommit={(pos) => sideHistory.commit({ position: pos })}
            onScaleLive={(v) => sideHistory.patchPresent({ scale: v })}
            onScalePointerDown={onSideScalePointerDown}
            onScalePointerUp={onSideScalePointerUp}
            onClear={clearOverlay("side")}
            onFile={handleFile("side")}
            onOverlayProcessed={setOverlaySide}
            decorationType={decorationType}
            leatherColor={leatherColor}
            slotActions={overlaySide ? sideActions : undefined}
          />
        )}
      </div>

      <div
        aria-hidden
        className="fixed -left-[200vw] -top-[200vh] opacity-0 pointer-events-none"
      >
        <OverlaySlot
          slot="front"
          baseSrc={baseSrcs.front}
          overlayUrl={overlayFront}
          patchUnderlayUrl={decorationType === "leather" ? leatherPatchImageSrc : null}
          patchPosition={decorationType === "leather" ? patchPosition : undefined}
          onPatchPositionCommit={undefined}
          patchDieCutShapeUrl={
            decorationType === "leather" && leatherOutline === "die cut"
              ? dieCutShapeUrl
              : null
          }
          dieCutScale={
            decorationType === "leather" &&
            leatherOutline === "die cut" &&
            dieCutShapeUrl
              ? dieCutScale
              : undefined
          }
          onDieCutScaleLive={
            decorationType === "leather" &&
            leatherOutline === "die cut" &&
            dieCutShapeUrl
              ? () => {}
              : undefined
          }
          onDieCutScalePointerDown={() => {}}
          onDieCutScalePointerUp={() => {}}
          patchMaxFrac={exportFrontPatchMaxFrac}
          overlayPosition={exportFrontOverlayPosition}
          overlayScale={frontHistory.present.scale}
          onPositionCommit={() => {}}
          onScaleLive={() => {}}
          onScalePointerDown={() => {}}
          onScalePointerUp={() => {}}
          onClear={() => {}}
          onFile={() => {}}
          decorationType={decorationType}
          leatherColor={leatherColor}
          exportCaptureMode
          exportCaptureRef={exportFrontStageRef}
        />
        <OverlaySlot
          slot="front"
          baseSrc={baseSrcs.front}
          overlayUrl={overlayFront}
          patchUnderlayUrl={decorationType === "leather" ? leatherPatchImageSrc : null}
          patchPosition={decorationType === "leather" ? patchPosition : undefined}
          onPatchPositionCommit={undefined}
          patchDieCutShapeUrl={
            decorationType === "leather" && leatherOutline === "die cut"
              ? dieCutShapeUrl
              : null
          }
          dieCutScale={
            decorationType === "leather" &&
            leatherOutline === "die cut" &&
            dieCutShapeUrl
              ? dieCutScale
              : undefined
          }
          onDieCutScaleLive={
            decorationType === "leather" &&
            leatherOutline === "die cut" &&
            dieCutShapeUrl
              ? () => {}
              : undefined
          }
          onDieCutScalePointerDown={() => {}}
          onDieCutScalePointerUp={() => {}}
          patchMaxFrac={exportFrontScalePreviewPatchMaxFrac}
          overlayPosition={exportFrontOverlayPosition}
          overlayScale={exportFrontScalePreviewOverlayScale}
          onPositionCommit={() => {}}
          onScaleLive={() => {}}
          onScalePointerDown={() => {}}
          onScalePointerUp={() => {}}
          onClear={() => {}}
          onFile={() => {}}
          decorationType={decorationType}
          leatherColor={leatherColor}
          exportCaptureMode
          exportCaptureRef={exportFrontScaleStageRef}
        />
        {decorationType !== "leather" && (
          <OverlaySlot
            slot="side"
            baseSrc={baseSrcs.side}
            overlayUrl={overlaySide}
            patchUnderlayUrl={null}
            patchMaxFrac={0.22}
            overlayPosition={sideHistory.present.position}
            overlayScale={sideHistory.present.scale}
            onPositionCommit={() => {}}
            onScaleLive={() => {}}
            onScalePointerDown={() => {}}
            onScalePointerUp={() => {}}
            onClear={() => {}}
            onFile={() => {}}
            decorationType={decorationType}
            leatherColor={leatherColor}
            exportCaptureMode
            exportCaptureRef={exportSideStageRef}
          />
        )}
      </div>
    </div>
  );
});

export default ImageOverlaySection;
