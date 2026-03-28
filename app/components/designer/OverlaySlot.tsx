"use client";

import {
  useState,
  useCallback,
  useRef,
  useEffect,
  useLayoutEffect,
  useMemo,
} from "react";
import {
  X,
  Maximize2,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Scissors,
  ImageIcon,
} from "lucide-react";
import type { DecorationType } from "@/lib/decoration";
import { dieCutMaskFillStyle } from "@/lib/decoration";
import type { NormalizedPosition } from "./overlayConstants";
import {
  ARTWORK_FILE_HINT,
  CENTER_POSITION,
  DIE_CUT_SCALE_DEFAULT,
  DIE_CUT_LEATHER_OVERLAY_BLEED_PX,
  NUDGE_STEP,
  NUDGE_STEP_FINE,
  OVERLAY_SCALE_MAX,
  OVERLAY_SCALE_MIN,
  OVERLAY_UI_MAX_FRAC,
  LEATHER_PATCH_PREVIEW_NUDGE_PX,
  DESIGN_NUDGE_PIXEL_PX,
  ARROW_HOLD_INITIAL_DELAY_MS,
  ARROW_HOLD_REPEAT_MS,
  type Slot,
} from "./overlayConstants";
import { DropZone } from "./DropZone";
import { getStageGeometry } from "./stageGeometry";

type ArrowPadDir = "up" | "left" | "right" | "down";

/** Rhombus vertices on the control box: top, right, bottom, left mid-edges (true diamond outline). */
const DIAMOND_W = {
  t: "50% 0%",
  r: "100% 50%",
  b: "50% 100%",
  l: "0% 50%",
  c: "50% 50%",
} as const;

const FULLSCREEN_PATCH_SCALE_MULTIPLIER = 1.22;

function ArrowPadWedge({
  dir,
  activeDir,
  clipPolygon,
  innerClipPolygon,
}: {
  dir: ArrowPadDir;
  activeDir: ArrowPadDir | null;
  clipPolygon: string;
  /** Smaller concentric facet so the fractal read stays inside the diamond. */
  innerClipPolygon: string;
}) {
  const active = activeDir === dir;
  return (
    <div
      aria-hidden
      className={
        "pointer-events-none absolute inset-0 transition-colors duration-150 backdrop-blur-[1px] " +
        (active
          ? "bg-sky-500/[0.22]"
          : "bg-white/[0.08]")
      }
      style={{ clipPath: clipPolygon }}
    >
      <div
        className={
          "absolute inset-0 transition-colors duration-150 " +
          (active ? "bg-sky-400/[0.12]" : "bg-white/[0.05]")
        }
        style={{ clipPath: innerClipPolygon }}
      />
    </div>
  );
}

/** Actual bitmap rect for `object-fit: contain` inside the img’s layout box (pixel alignment for the mask). */
function getObjectFitContainRect(img: HTMLImageElement): {
  left: number;
  top: number;
  width: number;
  height: number;
} | null {
  const cw = img.clientWidth;
  const ch = img.clientHeight;
  const nw = img.naturalWidth;
  const nh = img.naturalHeight;
  if (!cw || !ch || !nw || !nh) return null;
  const scale = Math.min(cw / nw, ch / nh);
  const width = nw * scale;
  const height = nh * scale;
  const left = (cw - width) / 2;
  const top = (ch - height) / 2;
  return { left, top, width, height };
}

/** Minimal two layers: die-cut img + leather overlay masked by the same asset. */
function DieCutShapePreview({
  src,
  patchUnderlayUrl,
  dieCutFrac,
  applyOverlayMask,
  leatherColor,
}: {
  src: string;
  patchUnderlayUrl: string | null;
  dieCutFrac: number;
  applyOverlayMask: boolean;
  leatherColor?: string | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const updateOverlayRect = useCallback(() => {
    const img = imgRef.current;
    const overlay = overlayRef.current;
    const container = containerRef.current;
    if (!img || !overlay || !container) return;

    const nw = img.naturalWidth;
    const nh = img.naturalHeight;
    if (!nw || !nh) {
      overlay.style.visibility = "hidden";
      return;
    }

    const inner = getObjectFitContainRect(img);
    if (!inner || inner.width <= 0 || inner.height <= 0) {
      overlay.style.visibility = "hidden";
      return;
    }

    /* Centered box matching bitmap aspect; uniform scale for bleed (avoids aspect skew from asymmetric padding). */
    const containerRect = container.getBoundingClientRect();
    const imgRect = img.getBoundingClientRect();
    const b = DIE_CUT_LEATHER_OVERLAY_BLEED_PX;
    const innerLeft = imgRect.left - containerRect.left + inner.left;
    const innerTop = imgRect.top - containerRect.top + inner.top;
    const w = Math.round(inner.width);
    const h = Math.round(inner.height);
    const cx = innerLeft + inner.width / 2;
    const cy = innerTop + inner.height / 2;
    const minSide = Math.max(1, Math.min(inner.width, inner.height));
    const rawBleed = 1 + (2 * b) / minSide;
    const bleedScale = Math.min(1.045, Math.max(1.006, rawBleed));

    overlay.style.visibility = "visible";
    overlay.style.left = `${Math.round(cx)}px`;
    overlay.style.top = `${Math.round(cy)}px`;
    overlay.style.width = `${w}px`;
    overlay.style.height = `${h}px`;
    overlay.style.transformOrigin = "50% 50%";
    overlay.style.transform = `translate(-50%, -50%) scale(${bleedScale})`;

    const mask = `url(${JSON.stringify(src)})`;
    overlay.style.setProperty("-webkit-mask-image", mask);
    overlay.style.setProperty("mask-image", mask);
    overlay.style.setProperty("-webkit-mask-repeat", "no-repeat");
    overlay.style.setProperty("mask-repeat", "no-repeat");
    overlay.style.setProperty("-webkit-mask-position", "center");
    overlay.style.setProperty("mask-position", "center");
    overlay.style.setProperty("-webkit-mask-size", "100% 100%");
    overlay.style.setProperty("mask-size", "100% 100%");
    overlay.style.setProperty("-webkit-mask-mode", "alpha");
    overlay.style.setProperty("mask-mode", "alpha");
    const fill = dieCutMaskFillStyle(leatherColor);
    overlay.style.backgroundColor = fill.backgroundColor;
    overlay.style.backgroundImage = fill.backgroundImage ?? "none";
    overlay.style.backgroundRepeat = "no-repeat";
    overlay.style.backgroundSize = "cover";
    /* overlay: stronger contrast so texture/detail reads through the tint */
    overlay.style.mixBlendMode = patchUnderlayUrl ? "overlay" : "normal";
  }, [src, patchUnderlayUrl, leatherColor]);

  useLayoutEffect(() => {
    updateOverlayRect();
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => {
      updateOverlayRect();
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [updateOverlayRect, dieCutFrac]);

  return (
    <div
      ref={containerRef}
      className="preview-container inline-block max-w-full max-h-full align-middle"
      style={{
        width: `${dieCutFrac * 100}%`,
        height: `${dieCutFrac * 100}%`,
        maxWidth: `${dieCutFrac * 100}%`,
        maxHeight: `${dieCutFrac * 100}%`,
      }}
    >
      <img
        ref={imgRef}
        src={src}
        alt="Die-cut"
        className={
          applyOverlayMask
            ? "diecut-img diecut-img-layout-only"
            : "diecut-img"
        }
        onLoad={updateOverlayRect}
      />
      {applyOverlayMask ? (
        <div ref={overlayRef} className="leather-overlay" aria-hidden />
      ) : null}
    </div>
  );
}

export function OverlaySlot({
  slot,
  baseSrc,
  overlayUrl,
  patchUnderlayUrl,
  /** Die-cut custom shape (shown between leather texture and artwork). */
  patchDieCutShapeUrl,
  /** Scales die-cut layer relative to patch outline (see {@link DIE_CUT_SCALE_DEFAULT}). */
  dieCutScale,
  onDieCutScaleLive,
  onDieCutScalePointerDown,
  onDieCutScalePointerUp,
  patchMaxFrac,
  /** Normalized center of the leatherette texture patch (0–1). */
  patchPosition,
  onPatchPositionCommit,
  overlayPosition,
  overlayScale,
  onPositionCommit,
  onScaleLive,
  onScalePointerDown,
  onScalePointerUp,
  onClear,
  onFile,
  decorationType = "embroidery",
  leatherColor,
  /** Undo/redo/copy — bottom bar, right-aligned. */
  slotActions,
  /** Single full-width column (e.g. leatherette front-only): taller preview on larger screens. */
  soloFullWidth = false,
  /** Only show the “Larger” fullscreen control below `md` (desktop uses the inline preview). */
  largerPreviewMobileOnly = false,
  exportCaptureMode = false,
  exportCaptureRef,
}: {
  slot: Slot;
  baseSrc: string;
  overlayUrl: string | null;
  patchUnderlayUrl: string | null;
  patchDieCutShapeUrl?: string | null;
  dieCutScale?: number;
  onDieCutScaleLive?: (scale: number) => void;
  onDieCutScalePointerDown?: () => void;
  onDieCutScalePointerUp?: () => void;
  patchMaxFrac: number;
  patchPosition?: NormalizedPosition;
  onPatchPositionCommit?: (pos: NormalizedPosition) => void;
  overlayPosition: NormalizedPosition;
  overlayScale: number;
  onPositionCommit: (pos: NormalizedPosition) => void;
  onScaleLive: (scale: number) => void;
  onScalePointerDown: () => void;
  onScalePointerUp: () => void;
  onClear: () => void;
  onFile: (file: File) => void;
  decorationType?: DecorationType;
  leatherColor?: string | null;
  slotActions?: React.ReactNode;
  soloFullWidth?: boolean;
  largerPreviewMobileOnly?: boolean;
  exportCaptureMode?: boolean;
  exportCaptureRef?: React.Ref<HTMLDivElement>;
}) {
  const label = slot === "front" ? "Front" : "Side";
  const showDieCutSlider = Boolean(
    patchDieCutShapeUrl && onDieCutScaleLive && typeof dieCutScale === "number"
  );
  const shouldApplySubmittedDieCutMask = Boolean(patchDieCutShapeUrl);
  const showArtworkSlider = Boolean(overlayUrl);
  const twoLeftSliders = showDieCutSlider && showArtworkSlider;
  const dieCutFrac = patchMaxFrac * (dieCutScale ?? DIE_CUT_SCALE_DEFAULT);
  const fullscreenPatchMaxFrac = patchMaxFrac * FULLSCREEN_PATCH_SCALE_MULTIPLIER;
  const fullscreenDieCutFrac =
    fullscreenPatchMaxFrac * (dieCutScale ?? DIE_CUT_SCALE_DEFAULT);
  const [position, setPosition] = useState<NormalizedPosition>(() => overlayPosition);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ clientX: 0, clientY: 0, startX: 0, startY: 0 });
  const innerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLImageElement>(null);
  const positionRef = useRef(position);
  const previewFocusRef = useRef<HTMLDivElement>(null);
  const [baseLoaded, setBaseLoaded] = useState(false);
  const arrowRepeatTimeoutRef = useRef<number | null>(null);
  const arrowPadActiveRef = useRef(false);
  const [arrowPadHighlight, setArrowPadHighlight] = useState<ArrowPadDir | null>(null);

  const patchDragInnerRef = useRef<HTMLDivElement>(null);
  const patchImgRef = useRef<HTMLImageElement>(null);
  const [patchPos, setPatchPos] = useState<NormalizedPosition>(
    () => patchPosition ?? CENTER_POSITION
  );
  const patchPosRef = useRef(patchPos);

  useEffect(() => {
    patchPosRef.current = patchPos;
  }, [patchPos]);

  useEffect(() => {
    if (patchPosition) {
      setPatchPos(patchPosition);
      patchPosRef.current = patchPosition;
    }
  }, [patchPosition]);

  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  useEffect(() => {
    setBaseLoaded(false);
  }, [baseSrc]);

  useEffect(() => {
    setPosition(overlayPosition);
    positionRef.current = overlayPosition;
  }, [overlayPosition]);

  useEffect(() => {
    if (!overlayUrl) {
      setPosition(CENTER_POSITION);
      positionRef.current = CENTER_POSITION;
    }
  }, [overlayUrl]);

  const artworkGeometry = useMemo(
    () =>
      getStageGeometry({
        stageRect: { x: 0, y: 0, width: 1000, height: 1000 },
        slot,
        showArtworkSlider,
        showDieCutSlider,
      }),
    [slot, showArtworkSlider, showDieCutSlider]
  );

  const artworkInteractInsetStyle = useMemo(
    () => ({
      left: `${artworkGeometry.insets.left}px`,
      right: `${artworkGeometry.insets.right}px`,
      top: `${artworkGeometry.insets.top}px`,
      bottom: `${artworkGeometry.insets.bottom}px`,
    }),
    [artworkGeometry]
  );

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

  const clampPatchToContent = useCallback(
    (centerX: number, centerY: number) => {
      const inner = patchDragInnerRef.current;
      if (!inner) return { x: 0.5, y: 0.5 };
      const innerRect = inner.getBoundingClientRect();
      const patchEl =
        patchImgRef.current ??
        (inner.querySelector(".diecut-img") as HTMLImageElement | null);
      if (!patchEl) {
        const margin = 0.05;
        const minX = innerRect.left + innerRect.width * margin;
        const maxX = innerRect.right - innerRect.width * margin;
        const minY = innerRect.top + innerRect.height * margin;
        const maxY = innerRect.bottom - innerRect.height * margin;
        const clampedX = Math.max(minX, Math.min(maxX, centerX));
        const clampedY = Math.max(minY, Math.min(maxY, centerY));
        return {
          x: (clampedX - innerRect.left) / innerRect.width,
          y: (clampedY - innerRect.top) / innerRect.height,
        };
      }
      const patchRect = patchEl.getBoundingClientRect();
      const minX = innerRect.left + patchRect.width / 2;
      const maxX = innerRect.right - patchRect.width / 2;
      const minY = innerRect.top + patchRect.height / 2;
      const maxY = innerRect.bottom - patchRect.height / 2;
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
      previewFocusRef.current?.focus({ preventScroll: true });
      setIsDragging(true);
      dragStart.current = {
        clientX: e.clientX,
        clientY: e.clientY,
        startX: positionRef.current.x,
        startY: positionRef.current.y,
      };
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    },
    []
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return;
      const inner = innerRef.current;
      if (!inner) return;
      const innerRect = inner.getBoundingClientRect();
      const startCenterX =
        innerRect.left + dragStart.current.startX * innerRect.width;
      const startCenterY =
        innerRect.top + dragStart.current.startY * innerRect.height;
      const dx = e.clientX - dragStart.current.clientX;
      const dy = e.clientY - dragStart.current.clientY;
      const next = clampToContent(startCenterX + dx, startCenterY + dy);
      positionRef.current = next;
      setPosition(next);
    },
    [isDragging, clampToContent]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return;
      setIsDragging(false);
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
      onPositionCommit(positionRef.current);
    },
    [isDragging, onPositionCommit]
  );

  const nudgePatchNorm = useCallback(
    (dxNorm: number, dyNorm: number) => {
      if (!onPatchPositionCommit) return;
      const inner = patchDragInnerRef.current;
      if (!inner) return;
      const innerRect = inner.getBoundingClientRect();
      const centerX =
        innerRect.left +
        patchPosRef.current.x * innerRect.width +
        dxNorm * innerRect.width;
      const centerY =
        innerRect.top +
        patchPosRef.current.y * innerRect.height +
        dyNorm * innerRect.height;
      const next = clampPatchToContent(centerX, centerY);
      patchPosRef.current = next;
      setPatchPos(next);
      onPatchPositionCommit(next);
    },
    [clampPatchToContent, onPatchPositionCommit]
  );

  const nudgePixels = useCallback(
    (dxPx: number, dyPx: number) => {
      const inner = innerRef.current;
      const overlay = overlayRef.current;
      if (!inner || !overlay) return;
      const innerRect = inner.getBoundingClientRect();
      const centerX =
        innerRect.left + positionRef.current.x * innerRect.width + dxPx;
      const centerY =
        innerRect.top + positionRef.current.y * innerRect.height + dyPx;
      const next = clampToContent(centerX, centerY);
      positionRef.current = next;
      setPosition(next);
    },
    [clampToContent]
  );

  const clearArrowRepeat = useCallback(() => {
    if (arrowRepeatTimeoutRef.current !== null) {
      clearTimeout(arrowRepeatTimeoutRef.current);
      arrowRepeatTimeoutRef.current = null;
    }
  }, []);

  const endArrowAdjust = useCallback(() => {
    clearArrowRepeat();
    setArrowPadHighlight(null);
    if (!arrowPadActiveRef.current) return;
    arrowPadActiveRef.current = false;
    onPositionCommit(positionRef.current);
  }, [clearArrowRepeat, onPositionCommit]);

  const startArrowRepeat = useCallback(
    (dirX: number, dirY: number) => {
      clearArrowRepeat();
      const px = DESIGN_NUDGE_PIXEL_PX;
      const dx = dirX * px;
      const dy = dirY * px;
      nudgePixels(dx, dy);
      const loop = () => {
        nudgePixels(dx, dy);
        arrowRepeatTimeoutRef.current = window.setTimeout(loop, ARROW_HOLD_REPEAT_MS);
      };
      arrowRepeatTimeoutRef.current = window.setTimeout(
        loop,
        ARROW_HOLD_INITIAL_DELAY_MS
      );
    },
    [clearArrowRepeat, nudgePixels]
  );

  const arrowPadBtnClass =
    "flex size-5 shrink-0 items-center justify-center rounded-sm bg-transparent text-[#111827] hover:opacity-80 active:opacity-60 touch-manipulation select-none outline-none focus-visible:ring-1 focus-visible:ring-[#111827]/35 focus-visible:ring-offset-1";

  /** Top-right controls for leatherette patch position (brown, separate from artwork nudge). */
  const patchArrowBtnClass =
    "flex size-5 shrink-0 items-center justify-center rounded-sm bg-[#f0e4d8] border border-[#7c4a2a]/75 text-[#4a3428] shadow-sm hover:bg-[#e6d4c4] active:opacity-85 touch-manipulation select-none outline-none focus-visible:ring-1 focus-visible:ring-[#5c3d2e]/50";

  useEffect(() => {
    return () => {
      clearArrowRepeat();
    };
  }, [clearArrowRepeat]);

  useEffect(() => {
    if (!overlayUrl) {
      clearArrowRepeat();
      arrowPadActiveRef.current = false;
      setArrowPadHighlight(null);
    }
  }, [overlayUrl, clearArrowRepeat]);

  const nudge = useCallback(
    (dxNorm: number, dyNorm: number) => {
      const inner = innerRef.current;
      const overlay = overlayRef.current;
      if (!inner || !overlay) return;
      const innerRect = inner.getBoundingClientRect();
      const centerX =
        innerRect.left +
        positionRef.current.x * innerRect.width +
        dxNorm * innerRect.width;
      const centerY =
        innerRect.top +
        positionRef.current.y * innerRect.height +
        dyNorm * innerRect.height;
      const next = clampToContent(centerX, centerY);
      positionRef.current = next;
      setPosition(next);
      onPositionCommit(next);
    },
    [clampToContent, onPositionCommit]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!overlayUrl) return;
      const fine = e.shiftKey;
      const step = fine ? NUDGE_STEP_FINE : NUDGE_STEP;
      let dx = 0;
      let dy = 0;
      switch (e.key) {
        case "ArrowLeft":
          dx = -step;
          break;
        case "ArrowRight":
          dx = step;
          break;
        case "ArrowUp":
          dy = -step;
          break;
        case "ArrowDown":
          dy = step;
          break;
        default:
          return;
      }
      e.preventDefault();
      nudge(dx, dy);
    },
    [overlayUrl, nudge]
  );

  const [showFullScreen, setShowFullScreen] = useState(false);

  const previewMaxHeightClass = soloFullWidth
    ? "max-h-[min(52vh,320px)] sm:max-h-[min(56vh,420px)] md:max-h-[min(62vh,520px)] lg:max-h-[min(70vh,600px)]"
    : "max-h-[min(52vh,320px)] sm:max-h-[min(48vh,380px)] lg:max-h-[420px]";

  const stageClassName = exportCaptureMode
    ? "relative w-[400px] h-[300px] bg-white rounded-none border-0 shadow-none overflow-hidden"
    : (overlayUrl || showDieCutSlider
        ? "relative w-full aspect-4/3 bg-white rounded-lg border border-[#e5e7eb] shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-[#111827]/20 focus-visible:ring-offset-1 "
        : "relative w-full aspect-4/3 bg-white rounded-lg border border-[#e5e7eb] shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden ") +
      previewMaxHeightClass;

  return (
    <div className="flex flex-col min-w-0 w-full">
      {!exportCaptureMode && (
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
            {label} view
          </p>
        </div>
      )}
      <div
        ref={(node) => {
          previewFocusRef.current = node;
          if (!exportCaptureRef) return;
          if (typeof exportCaptureRef === "function") {
            exportCaptureRef(node);
          } else {
            exportCaptureRef.current = node;
          }
        }}
        tabIndex={exportCaptureMode ? -1 : overlayUrl || showDieCutSlider ? 0 : -1}
        onKeyDown={exportCaptureMode ? undefined : overlayUrl ? handleKeyDown : undefined}
        className={stageClassName}
      >
        {!baseLoaded && (
          <div
            className="absolute inset-0 z-[1] animate-pulse bg-[#ececee]"
            aria-hidden
          />
        )}
        <img
          src={baseSrc}
          alt={label}
          className="absolute inset-0 w-full h-full object-contain p-2 sm:p-3 z-0"
          onLoad={() => setBaseLoaded(true)}
        />
        {onPatchPositionCommit && (patchUnderlayUrl || patchDieCutShapeUrl) && (
          <div
            ref={patchDragInnerRef}
            className="absolute inset-0 z-[4] pointer-events-none"
          >
            {patchUnderlayUrl && (
              <div
                className="absolute inset-0 z-[5] flex items-center justify-center p-2 sm:p-3 pointer-events-none"
                style={{
                  transform: `translateX(${LEATHER_PATCH_PREVIEW_NUDGE_PX}px)`,
                }}
              >
                <div
                  className="absolute flex items-center justify-center w-full h-full pointer-events-none"
                  style={{
                    left: `${patchPos.x * 100}%`,
                    top: `${patchPos.y * 100}%`,
                    transform: "translate(-50%, -50%)",
                  }}
                >
                  <img
                    ref={patchImgRef}
                    src={patchUnderlayUrl}
                    alt=""
                    className="w-auto h-auto object-contain mix-blend-multiply pointer-events-none"
                    draggable={false}
                    style={{
                      maxWidth: `${patchMaxFrac * 100}%`,
                      maxHeight: `${patchMaxFrac * 100}%`,
                    }}
                  />
                </div>
              </div>
            )}
            {patchDieCutShapeUrl && (
              <div
                className="absolute inset-0 z-[6] flex items-center justify-center pointer-events-none p-2 sm:p-3"
                style={{
                  transform: `translateX(${LEATHER_PATCH_PREVIEW_NUDGE_PX}px)`,
                }}
                aria-hidden
              >
                <div
                  className="absolute flex items-center justify-center w-full h-full pointer-events-none"
                  style={{
                    left: `${patchPos.x * 100}%`,
                    top: `${patchPos.y * 100}%`,
                    transform: "translate(-50%, -50%)",
                  }}
                >
                  <DieCutShapePreview
                    src={patchDieCutShapeUrl}
                    patchUnderlayUrl={patchUnderlayUrl ?? null}
                    dieCutFrac={dieCutFrac}
                    applyOverlayMask={shouldApplySubmittedDieCutMask}
                    leatherColor={leatherColor}
                  />
                </div>
              </div>
            )}
          </div>
        )}
        {!onPatchPositionCommit && patchUnderlayUrl && (
          <div
            className="absolute inset-0 z-[5] flex items-center justify-center p-2 sm:p-3 pointer-events-none"
            style={{ transform: `translateX(${LEATHER_PATCH_PREVIEW_NUDGE_PX}px)` }}
          >
            <img
              ref={patchImgRef}
              src={patchUnderlayUrl}
              alt=""
              className="w-auto h-auto object-contain mix-blend-multiply pointer-events-none"
              style={{
                maxWidth: `${patchMaxFrac * 100}%`,
                maxHeight: `${patchMaxFrac * 100}%`,
              }}
            />
          </div>
        )}
        {!onPatchPositionCommit && patchDieCutShapeUrl && (
          <div
            className="absolute inset-0 z-[6] flex items-center justify-center pointer-events-none p-2 sm:p-3"
            style={{ transform: `translateX(${LEATHER_PATCH_PREVIEW_NUDGE_PX}px)` }}
            aria-hidden
          >
            <DieCutShapePreview
              src={patchDieCutShapeUrl}
              patchUnderlayUrl={patchUnderlayUrl ?? null}
              dieCutFrac={dieCutFrac}
              applyOverlayMask={shouldApplySubmittedDieCutMask}
              leatherColor={leatherColor}
            />
          </div>
        )}
        {onPatchPositionCommit && (patchUnderlayUrl || patchDieCutShapeUrl) && (
          <div
            className={
              "absolute z-[25] flex flex-col items-end gap-0.5 pointer-events-auto " +
              (overlayUrl ? "top-10 right-2" : "top-2 right-2")
            }
            role="group"
            aria-label="Nudge leatherette texture and die-cut shape together"
          >
            <span className="text-[8px] font-semibold uppercase tracking-[0.1em] text-[#6b4423]">
              Patch
            </span>
            <div className="grid grid-cols-3 gap-px place-items-center rounded-md border border-[#6b4423]/50 bg-[#faf4ed]/98 p-0.5 shadow-[0_1px_3px_rgba(50,25,10,0.14)]">
              <span className="size-5" aria-hidden />
              <button
                type="button"
                className={patchArrowBtnClass}
                aria-label="Nudge leatherette patch up"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const step = e.shiftKey ? NUDGE_STEP_FINE : NUDGE_STEP;
                  nudgePatchNorm(0, -step);
                }}
              >
                <ChevronUp className="size-4" strokeWidth={4} aria-hidden />
              </button>
              <span className="size-5" aria-hidden />
              <button
                type="button"
                className={patchArrowBtnClass}
                aria-label="Nudge leatherette patch left"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const step = e.shiftKey ? NUDGE_STEP_FINE : NUDGE_STEP;
                  nudgePatchNorm(-step, 0);
                }}
              >
                <ChevronLeft className="size-4" strokeWidth={4} aria-hidden />
              </button>
              <span className="size-5" aria-hidden />
              <button
                type="button"
                className={patchArrowBtnClass}
                aria-label="Nudge leatherette patch right"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const step = e.shiftKey ? NUDGE_STEP_FINE : NUDGE_STEP;
                  nudgePatchNorm(step, 0);
                }}
              >
                <ChevronRight className="size-4" strokeWidth={4} aria-hidden />
              </button>
              <span className="size-5" aria-hidden />
              <button
                type="button"
                className={patchArrowBtnClass}
                aria-label="Nudge leatherette patch down"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const step = e.shiftKey ? NUDGE_STEP_FINE : NUDGE_STEP;
                  nudgePatchNorm(0, step);
                }}
              >
                <ChevronDown className="size-4" strokeWidth={4} aria-hidden />
              </button>
              <span className="size-5" aria-hidden />
            </div>
          </div>
        )}
        {overlayUrl && (
          <>
            <div
              ref={innerRef}
              className="absolute z-[10] flex items-center justify-center pointer-events-none"
              style={artworkInteractInsetStyle}
            >
              <img
                ref={overlayRef}
                src={overlayUrl}
                alt="Overlay"
                className="absolute pointer-events-auto cursor-grab active:cursor-grabbing object-contain select-none touch-none"
                style={{
                  left: `${position.x * 100}%`,
                  top: `${position.y * 100}%`,
                  transform: "translate(-50%, -50%)",
                  width: `${OVERLAY_UI_MAX_FRAC * overlayScale * 100}%`,
                  height: `${OVERLAY_UI_MAX_FRAC * overlayScale * 100}%`,
                }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={(e) => {
                  if (isDragging) handlePointerUp(e);
                }}
                draggable={false}
              />
            </div>
            {!exportCaptureMode && (
              <div
              className={
                "absolute top-2 z-20 inline-block p-px pointer-events-auto " +
                (twoLeftSliders ? "left-20" : "left-10")
              }
              role="group"
              aria-label="Move design 1 pixel; hold to repeat"
            >
              <div className="relative">
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 z-0 overflow-visible"
                >
                  <ArrowPadWedge
                    dir="up"
                    activeDir={arrowPadHighlight}
                    clipPolygon={`polygon(${DIAMOND_W.c}, ${DIAMOND_W.l}, ${DIAMOND_W.t}, ${DIAMOND_W.r})`}
                    innerClipPolygon="polygon(50% 50%, 15% 42%, 50% 12%, 85% 42%)"
                  />
                  <ArrowPadWedge
                    dir="right"
                    activeDir={arrowPadHighlight}
                    clipPolygon={`polygon(${DIAMOND_W.c}, ${DIAMOND_W.t}, ${DIAMOND_W.r}, ${DIAMOND_W.b})`}
                    innerClipPolygon="polygon(50% 50%, 50% 12%, 88% 50%, 50% 88%)"
                  />
                  <ArrowPadWedge
                    dir="down"
                    activeDir={arrowPadHighlight}
                    clipPolygon={`polygon(${DIAMOND_W.c}, ${DIAMOND_W.r}, ${DIAMOND_W.b}, ${DIAMOND_W.l})`}
                    innerClipPolygon="polygon(50% 50%, 85% 58%, 50% 88%, 15% 58%)"
                  />
                  <ArrowPadWedge
                    dir="left"
                    activeDir={arrowPadHighlight}
                    clipPolygon={`polygon(${DIAMOND_W.c}, ${DIAMOND_W.b}, ${DIAMOND_W.l}, ${DIAMOND_W.t})`}
                    innerClipPolygon="polygon(50% 50%, 50% 88%, 12% 50%, 50% 12%)"
                  />
                  <div
                    aria-hidden
                    className={
                      "pointer-events-none absolute inset-0 z-[1] backdrop-blur-[1px] transition-colors duration-150 [clip-path:polygon(50%_18%,82%_50%,50%_82%,18%_50%)] " +
                      (arrowPadHighlight !== null
                        ? "bg-sky-400/[0.14]"
                        : "bg-white/[0.07]")
                    }
                  />
                </div>
                <div className="relative z-10 grid grid-cols-3 gap-px place-items-center leading-none">
                <span className="size-5" aria-hidden />
                <button
                  type="button"
                  className={arrowPadBtnClass}
                  aria-label="Nudge up 1 pixel"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setArrowPadHighlight("up");
                    arrowPadActiveRef.current = true;
                    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                    startArrowRepeat(0, -1);
                  }}
                  onPointerUp={(e) => {
                    (e.currentTarget as HTMLElement).releasePointerCapture?.(
                      e.pointerId
                    );
                    endArrowAdjust();
                  }}
                  onPointerCancel={endArrowAdjust}
                >
                  <ChevronUp className="size-4" strokeWidth={4} aria-hidden />
                </button>
                <span className="size-5" aria-hidden />
                <button
                  type="button"
                  className={arrowPadBtnClass}
                  aria-label="Nudge left 1 pixel"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setArrowPadHighlight("left");
                    arrowPadActiveRef.current = true;
                    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                    startArrowRepeat(-1, 0);
                  }}
                  onPointerUp={(e) => {
                    (e.currentTarget as HTMLElement).releasePointerCapture?.(
                      e.pointerId
                    );
                    endArrowAdjust();
                  }}
                  onPointerCancel={endArrowAdjust}
                >
                  <ChevronLeft className="size-4" strokeWidth={4} aria-hidden />
                </button>
                <span className="size-5" aria-hidden />
                <button
                  type="button"
                  className={arrowPadBtnClass}
                  aria-label="Nudge right 1 pixel"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setArrowPadHighlight("right");
                    arrowPadActiveRef.current = true;
                    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                    startArrowRepeat(1, 0);
                  }}
                  onPointerUp={(e) => {
                    (e.currentTarget as HTMLElement).releasePointerCapture?.(
                      e.pointerId
                    );
                    endArrowAdjust();
                  }}
                  onPointerCancel={endArrowAdjust}
                >
                  <ChevronRight className="size-4" strokeWidth={4} aria-hidden />
                </button>
                <span className="size-5" aria-hidden />
                <button
                  type="button"
                  className={arrowPadBtnClass}
                  aria-label="Nudge down 1 pixel"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setArrowPadHighlight("down");
                    arrowPadActiveRef.current = true;
                    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                    startArrowRepeat(0, 1);
                  }}
                  onPointerUp={(e) => {
                    (e.currentTarget as HTMLElement).releasePointerCapture?.(
                      e.pointerId
                    );
                    endArrowAdjust();
                  }}
                  onPointerCancel={endArrowAdjust}
                >
                  <ChevronDown className="size-4" strokeWidth={4} aria-hidden />
                </button>
                <span className="size-5" aria-hidden />
              </div>
              </div>
              </div>
            )}
            {!exportCaptureMode && (
              <button
              type="button"
              onClick={onClear}
              className="absolute top-2 right-2 inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded-md border border-zinc-200 bg-white text-zinc-700 shadow-sm hover:bg-sky-50/90 hover:border-sky-200 hover:text-zinc-900 z-10 transition-colors"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
              Clear
            </button>
            )}
            {!exportCaptureMode && slotActions ? (
              <div
                className={
                  "absolute bottom-0 right-0 z-10 flex flex-wrap items-center justify-end gap-1 py-1.5 px-1.5 min-h-[32px] border-t border-[#e5e7eb] bg-white/98 backdrop-blur-sm rounded-br-lg " +
                  (twoLeftSliders ? "left-20" : "left-10")
                }
                role="toolbar"
                aria-label={`${label} view actions`}
              >
                {slotActions}
              </div>
            ) : null}
          </>
        )}
        {showDieCutSlider && !showFullScreen && !exportCaptureMode && (
          <div
            className={
              "pointer-events-auto isolate absolute left-0 top-0 bottom-0 z-[100] flex w-10 flex-col items-center justify-center overflow-hidden rounded-l-lg border-y border-l border-[#6b4423]/50 bg-gradient-to-b from-[#faf4ed] to-[#f0e4d8] shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] " +
              (twoLeftSliders ? "border-r-0" : "border-r border-[#6b4423]/50")
            }
            style={{ paddingLeft: "2px" }}
          >
            <span className="mb-1 mt-2.5 inline-flex items-center justify-center text-[#6b4423]">
              <Scissors className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-visible">
              <input
                type="range"
                min={OVERLAY_SCALE_MIN}
                max={OVERLAY_SCALE_MAX}
                step={0.05}
                value={dieCutScale}
                onChange={(e) => onDieCutScaleLive?.(parseFloat(e.target.value))}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onDieCutScalePointerDown?.();
                }}
                onPointerUp={onDieCutScalePointerUp}
                onPointerCancel={onDieCutScalePointerUp}
                className="die-cut-size-slider pointer-events-auto relative z-[101] appearance-none bg-transparent cursor-pointer touch-none [&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-[#d4b8a0] [&::-webkit-slider-runnable-track]:shadow-[inset_0_1px_2px_rgba(80,45,20,0.12)] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-[#7c4a2a]/75 [&::-webkit-slider-thumb]:bg-[#f0e4d8] [&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:active:cursor-grabbing [&::-webkit-slider-thumb]:mt-[calc(-0.5rem+4px)] [&::-moz-range-track]:h-2 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-[#d4b8a0] [&::-moz-range-track]:shadow-[inset_0_1px_2px_rgba(80,45,20,0.12)] [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-[#7c4a2a]/75 [&::-moz-range-thumb]:bg-[#f0e4d8] [&::-moz-range-thumb]:shadow-sm [&::-moz-range-thumb]:cursor-grab"
                style={{
                  transform: "rotate(-90deg)",
                  width: "120px",
                  height: "8px",
                }}
                aria-label="Die-cut shape size"
              />
            </div>
          </div>
        )}
        {showArtworkSlider && !showFullScreen && !exportCaptureMode && (
          <div
            className={
              "pointer-events-auto isolate absolute top-0 bottom-0 z-[101] flex w-10 flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-white to-[#fafafa] border-r border-[#e5e7eb] " +
              (showDieCutSlider ? "left-10" : "left-0 rounded-l-lg")
            }
            style={{ paddingLeft: "2px" }}
          >
            <span className="mb-1 mt-2.5 inline-flex items-center justify-center text-[#6b7280]">
              <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-visible">
              <input
                type="range"
                min={OVERLAY_SCALE_MIN}
                max={OVERLAY_SCALE_MAX}
                step={0.05}
                value={overlayScale}
                onChange={(e) => onScaleLive(parseFloat(e.target.value))}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onScalePointerDown();
                }}
                onPointerUp={onScalePointerUp}
                onPointerCancel={onScalePointerUp}
                className="pointer-events-auto relative z-[102] appearance-none bg-transparent cursor-pointer touch-none [&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-[#e5e7eb] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#111827] [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:active:cursor-grabbing [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:mt-[calc(-0.5rem+4px)] [&::-moz-range-track]:h-2 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-[#e5e7eb] [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-[#111827] [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-grab"
                style={{
                  transform: "rotate(-90deg)",
                  width: "120px",
                  height: "8px",
                }}
                aria-label="Artwork size"
              />
            </div>
          </div>
        )}
      </div>
      {!exportCaptureMode && (
        <DropZone
        label={overlayUrl ? "Drop another image to replace" : `Drop image for ${label}`}
        onFile={onFile}
        rightActionMobileOnly={largerPreviewMobileOnly}
        rightAction={
          <button
            type="button"
            onClick={() => setShowFullScreen(true)}
            className="inline-flex h-full min-h-[42px] items-center justify-center gap-1 px-3 py-2 rounded-r-lg border border-zinc-200 border-l-0 bg-white text-zinc-700 hover:bg-sky-50/90 hover:border-sky-200 hover:text-zinc-900 text-[11px] font-medium shadow-sm transition-colors"
            title="Larger preview"
            aria-label="Open larger preview"
          >
            <Maximize2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span className="hidden sm:inline">Larger</span>
          </button>
        }
        />
      )}
      {!exportCaptureMode && (
        <p className="mt-2 text-[10px] sm:text-[11px] text-zinc-500 leading-snug">
          {ARTWORK_FILE_HINT}
        </p>
      )}
      {showFullScreen && !exportCaptureMode && (
        <div
          className="fixed inset-0 z-[300] bg-black"
          onClick={() => setShowFullScreen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Design preview full screen"
        >
          <button
            type="button"
            onClick={() => setShowFullScreen(false)}
            className="absolute top-3 right-3 z-20 p-2 rounded-md bg-black/45 text-white hover:bg-black/65 transition-colors"
            aria-label="Close preview"
          >
            <X className="w-5 h-5" />
          </button>
          <div
            className="relative h-screen w-screen overflow-hidden bg-black"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute inset-0 flex items-center justify-center p-2 sm:p-3">
              <div className="relative aspect-4/3 w-full max-h-full max-w-[min(calc(100vw-1rem),calc((100vh-1rem)*4/3))] overflow-hidden rounded-lg bg-white">
                <img
                  src={baseSrc}
                  alt={label}
                  className="absolute inset-0 z-0 h-full w-full object-contain p-2 sm:p-3"
                />
                {onPatchPositionCommit && (patchUnderlayUrl || patchDieCutShapeUrl) && (
                  <div className="absolute inset-0 z-[4] pointer-events-none">
                    {patchUnderlayUrl && (
                      <div
                        className="absolute inset-0 z-[5] flex items-center justify-center pointer-events-none p-2 sm:p-3"
                        style={{
                          transform: `translateX(${LEATHER_PATCH_PREVIEW_NUDGE_PX}px)`,
                        }}
                        aria-hidden
                      >
                        <div
                          className="absolute flex items-center justify-center w-full h-full pointer-events-none"
                          style={{
                            left: `${patchPos.x * 100}%`,
                            top: `${patchPos.y * 100}%`,
                            transform: "translate(-50%, -50%)",
                          }}
                        >
                          <img
                            src={patchUnderlayUrl}
                            alt=""
                            className="w-auto h-auto object-contain mix-blend-multiply"
                            style={{
                              maxWidth: `${fullscreenPatchMaxFrac * 100}%`,
                              maxHeight: `${fullscreenPatchMaxFrac * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}
                    {patchDieCutShapeUrl && (
                      <div
                        className="absolute inset-0 z-[6] flex items-center justify-center pointer-events-none p-2 sm:p-3"
                        style={{
                          transform: `translateX(${LEATHER_PATCH_PREVIEW_NUDGE_PX}px)`,
                        }}
                        aria-hidden
                      >
                        <div
                          className="absolute flex items-center justify-center w-full h-full pointer-events-none"
                          style={{
                            left: `${patchPos.x * 100}%`,
                            top: `${patchPos.y * 100}%`,
                            transform: "translate(-50%, -50%)",
                          }}
                        >
                          <DieCutShapePreview
                            src={patchDieCutShapeUrl}
                            patchUnderlayUrl={patchUnderlayUrl ?? null}
                            dieCutFrac={fullscreenDieCutFrac}
                            applyOverlayMask={shouldApplySubmittedDieCutMask}
                            leatherColor={leatherColor}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {!onPatchPositionCommit && patchUnderlayUrl && (
                  <div
                    className="absolute inset-0 z-[5] flex items-center justify-center pointer-events-none p-2 sm:p-3"
                    style={{ transform: `translateX(${LEATHER_PATCH_PREVIEW_NUDGE_PX}px)` }}
                    aria-hidden
                  >
                    <img
                      src={patchUnderlayUrl}
                      alt=""
                      className="w-auto h-auto object-contain mix-blend-multiply"
                      style={{
                        maxWidth: `${fullscreenPatchMaxFrac * 100}%`,
                        maxHeight: `${fullscreenPatchMaxFrac * 100}%`,
                      }}
                    />
                  </div>
                )}
                {!onPatchPositionCommit && patchDieCutShapeUrl && (
                  <div
                    className="absolute inset-0 z-[6] flex items-center justify-center pointer-events-none p-2 sm:p-3"
                    style={{ transform: `translateX(${LEATHER_PATCH_PREVIEW_NUDGE_PX}px)` }}
                    aria-hidden
                  >
                    <DieCutShapePreview
                      src={patchDieCutShapeUrl}
                      patchUnderlayUrl={patchUnderlayUrl ?? null}
                      dieCutFrac={fullscreenDieCutFrac}
                      applyOverlayMask={shouldApplySubmittedDieCutMask}
                      leatherColor={leatherColor}
                    />
                  </div>
                )}
                {overlayUrl && (
                  <div
                    className="absolute z-[10] flex items-center justify-center pointer-events-none"
                    style={artworkInteractInsetStyle}
                  >
                    <img
                      src={overlayUrl}
                      alt="Overlay"
                      className="absolute pointer-events-none object-contain"
                      style={{
                        left: `${position.x * 100}%`,
                        top: `${position.y * 100}%`,
                        transform: "translate(-50%, -50%)",
                        width: `${OVERLAY_UI_MAX_FRAC * overlayScale * 100}%`,
                        height: `${OVERLAY_UI_MAX_FRAC * overlayScale * 100}%`,
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
