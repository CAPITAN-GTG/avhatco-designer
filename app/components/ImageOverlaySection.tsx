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
import type { BaseImages } from "./designer/overlayConstants";
import {
  CENTER_POSITION,
  DIE_CUT_SCALE_DEFAULT,
  EXPORT_HEIGHT,
  EXPORT_WIDTH,
  FALLBACK_BASE_IMAGES,
  DESIGN_ONLY_JPEG_QUALITY,
  DESIGN_ONLY_MAX_PX,
  LEATHER_PATCH_PREVIEW_NUDGE_PX,
  OVERLAY_SCALE_DEFAULT,
  type Slot,
} from "./designer/overlayConstants";
import {
  loadImage,
  drawImageContain,
  drawOverlayContain,
  downscaleImageForPatchExport,
} from "./designer/overlayCanvas";
import { OverlaySlot } from "./designer/OverlaySlot";
import {
  cloneSlot,
  useSlotTransformHistory,
} from "./designer/useSlotTransformHistory";

export type { BaseImages } from "./designer/overlayConstants";

export type ImageOverlaySectionHandle = {
  getCompositedImages: () => Promise<{
    front?: string;
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

async function objectUrlToFullDataUrl(url: string): Promise<string | undefined> {
  try {
    const blob = await fetch(url).then((r) => r.blob());
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("read"));
      reader.readAsDataURL(blob);
    });
  } catch {
    return undefined;
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
    /** User-uploaded silhouette / shape for die-cut outline (object URL). */
    dieCutShapeUrl?: string | null;
  }
>(function ImageOverlaySection(
  {
    baseImages = null,
    onLocationsChange,
    decorationType = "embroidery",
    leatherPatchImageSrc = null,
    leatherOutline = null,
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

  const frontScaleStartRef = useRef<ReturnType<typeof cloneSlot> | null>(null);
  const sideScaleStartRef = useRef<ReturnType<typeof cloneSlot> | null>(null);

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
      setter((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return file ? URL.createObjectURL(file) : null;
      });
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
    setOverlaySide((p) => {
      if (p) URL.revokeObjectURL(p);
      return null;
    });
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
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      return canvas.toDataURL("image/jpeg", DESIGN_ONLY_JPEG_QUALITY);
    } catch {
      return undefined;
    }
  }, []);

  const getCompositedImages = useCallback(async () => {
    const result: {
      front?: string;
      side?: string;
      frontDesignOnly?: string;
      sideDesignOnly?: string;
      dieCutShapeHighResDataUrl?: string;
    } = {};
    const INSET = 0.12;
    const SIDE_INSET_LEFT = 0.28;
    const SIDE_INSET_RIGHT = 0.12;
    const OVERLAY_FRACTION = 0.68;

    const frontBase = baseSrcs.front;
    const sideBase = baseSrcs.side;

    const pf = frontPresentRef.current;
    const ps = sidePresentRef.current;

    /** Front composite only when customer artwork exists (leather patch texture alone does not count). */
    const shouldExportFront = Boolean(overlayFront);

    if (shouldExportFront) {
      try {
        const baseImg = await loadImage(frontBase);
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

        if (decorationType === "leather" && overlayFront) {
          const patchBox =
            Math.min(contentW, contentH) * leatherPatchPreviewMaxFrac(leatherOutline);
          const cx = contentLeft + contentW / 2 + LEATHER_PATCH_PREVIEW_NUDGE_PX;
          const cy = contentTop + contentH / 2;

          if (leatherPatchImageSrc) {
            const patchImgFull = await loadImage(leatherPatchImageSrc);
            const patchImg = await downscaleImageForPatchExport(patchImgFull, 256);
            ctx.save();
            ctx.globalCompositeOperation = "multiply";
            drawOverlayContain(
              ctx,
              patchImg,
              cx - patchBox / 2,
              cy - patchBox / 2,
              patchBox,
              patchBox
            );
            ctx.restore();
          }

          if (leatherOutline === "die cut" && dieCutShapeUrl) {
            const dieFull = await loadImage(dieCutShapeUrl);
            const dieImg = await downscaleImageForPatchExport(dieFull, 256);
            const dieCutBox = patchBox * dieCutScale;
            ctx.save();
            ctx.globalCompositeOperation = leatherPatchImageSrc
              ? "multiply"
              : "source-over";
            drawOverlayContain(
              ctx,
              dieImg,
              cx - dieCutBox / 2,
              cy - dieCutBox / 2,
              dieCutBox,
              dieCutBox
            );
            ctx.restore();
          }
        }

        if (overlayFront) {
          const overlayImg = await loadImage(overlayFront);
          const centerX = contentLeft + pf.position.x * contentW;
          const centerY = contentTop + pf.position.y * contentH;
          const overlayMaxW = Math.max(
            4,
            Math.floor(contentW * OVERLAY_FRACTION * pf.scale)
          );
          const overlayMaxH = Math.max(
            4,
            Math.floor(contentH * OVERLAY_FRACTION * pf.scale)
          );
          const ox = centerX - overlayMaxW / 2;
          const oy = centerY - overlayMaxH / 2;
          drawOverlayContain(ctx, overlayImg, ox, oy, overlayMaxW, overlayMaxH);
        }

        result.front = canvas.toDataURL("image/png");
        if (overlayFront) {
          result.frontDesignOnly = await exportDesignOnly(overlayFront);
        }
      } catch {
        // CORS or decode failure
      }
    }

    if (
      decorationType === "leather" &&
      leatherOutline === "die cut" &&
      dieCutShapeUrl
    ) {
      const hi = await objectUrlToFullDataUrl(dieCutShapeUrl);
      if (hi) result.dieCutShapeHighResDataUrl = hi;
    }

    if (decorationType !== "leather" && overlaySide) {
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
        const centerX = contentLeft + ps.position.x * contentW;
        const centerY = contentTop + ps.position.y * contentH;
        const overlayMaxW = Math.max(
          4,
          Math.floor(contentW * OVERLAY_FRACTION * ps.scale)
        );
        const overlayMaxH = Math.max(
          4,
          Math.floor(contentH * OVERLAY_FRACTION * ps.scale)
        );
        const ox = centerX - overlayMaxW / 2;
        const oy = centerY - overlayMaxH / 2;
        drawOverlayContain(ctx, overlayImg, ox, oy, overlayMaxW, overlayMaxH);
        result.side = canvas.toDataURL("image/png");
        result.sideDesignOnly = await exportDesignOnly(overlaySide);
      } catch {
        // skip
      }
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
    baseImages?.front ?? FALLBACK_BASE_IMAGES.front,
    baseImages?.side ?? FALLBACK_BASE_IMAGES.side,
  ]);

  useImperativeHandle(ref, () => ({ getCompositedImages }), [getCompositedImages]);

  const copyFrontToSide = useCallback(async () => {
    if (decorationType === "leather" || !overlayFront) return;
    try {
      const blob = await fetch(overlayFront).then((r) => r.blob());
      setOverlaySide((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(blob);
      });
      const f = frontPresentRef.current;
      sideHistory.commit({
        position: { ...f.position },
        scale: f.scale,
      });
    } catch {
      // ignore
    }
  }, [decorationType, overlayFront, sideHistory]);

  const copySideToFront = useCallback(async () => {
    if (decorationType === "leather" || !overlaySide) return;
    try {
      const blob = await fetch(overlaySide).then((r) => r.blob());
      setOverlayFront((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(blob);
      });
      const s = sidePresentRef.current;
      frontHistory.commit({
        position: { ...s.position },
        scale: s.scale,
      });
    } catch {
      // ignore
    }
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

  return (
    <div className="min-w-0 w-full max-w-none">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4 sm:mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
              Live preview
            </span>
            <DesignerHelpDialog />
          </div>
          <h2 className="mt-1.5 text-base sm:text-lg font-medium tracking-tight text-[#111827]">
            Design preview
          </h2>
          <p className="text-xs sm:text-sm text-zinc-600 mt-1 max-w-3xl leading-snug">
            {decorationType === "leather"
              ? "Leatherette is front-only on a standard reference hat so the patch lines up consistently. Your order still uses the hat you pick below—add your artwork on top."
              : baseImages
                ? "Uses the selected product. Drop an image on each view to preview placement."
                : "Select a product, then drop an image on each view."}
          </p>
        </div>
      </div>

      <p className="text-[10px] sm:text-[11px] text-zinc-500 mb-3 sm:mb-4 leading-snug max-w-3xl">
        Tip: click the preview with artwork, then use arrow keys to nudge (Shift = finer). Undo/redo
        apply per view.
      </p>

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
            slotActions={overlaySide ? sideActions : undefined}
          />
        )}
      </div>
    </div>
  );
});

export default ImageOverlaySection;
