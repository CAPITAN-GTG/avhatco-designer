"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  X,
  Maximize2,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { NormalizedPosition } from "./overlayConstants";
import {
  ARTWORK_FILE_HINT,
  CENTER_POSITION,
  DIE_CUT_SCALE_DEFAULT,
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

type ArrowPadDir = "up" | "left" | "right" | "down";

/** Rhombus vertices on the control box: top, right, bottom, left mid-edges (true diamond outline). */
const DIAMOND_W = {
  t: "50% 0%",
  r: "100% 50%",
  b: "50% 100%",
  l: "0% 50%",
  c: "50% 50%",
} as const;

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
  overlayPosition,
  overlayScale,
  onPositionCommit,
  onScaleLive,
  onScalePointerDown,
  onScalePointerUp,
  onClear,
  onFile,
  /** Undo/redo/copy — bottom bar, right-aligned. */
  slotActions,
  /** Single full-width column (e.g. leatherette front-only): taller preview on larger screens. */
  soloFullWidth = false,
  /** Only show the “Larger” fullscreen control below `md` (desktop uses the inline preview). */
  largerPreviewMobileOnly = false,
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
  overlayPosition: NormalizedPosition;
  overlayScale: number;
  onPositionCommit: (pos: NormalizedPosition) => void;
  onScaleLive: (scale: number) => void;
  onScalePointerDown: () => void;
  onScalePointerUp: () => void;
  onClear: () => void;
  onFile: (file: File) => void;
  slotActions?: React.ReactNode;
  soloFullWidth?: boolean;
  largerPreviewMobileOnly?: boolean;
}) {
  const label = slot === "front" ? "Front" : "Side";
  const showDieCutSlider = Boolean(
    patchDieCutShapeUrl && onDieCutScaleLive && typeof dieCutScale === "number"
  );
  const showArtworkSlider = Boolean(overlayUrl);
  const twoLeftSliders = showDieCutSlider && showArtworkSlider;
  const dieCutFrac = patchMaxFrac * (dieCutScale ?? DIE_CUT_SCALE_DEFAULT);
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

  const innerPaddingClass =
    slot === "side"
      ? "pl-[calc(5rem-2px)] sm:pl-[calc(7rem-2px)] pr-[calc(2rem+2px)] sm:pr-[calc(3rem+2px)] py-12 sm:py-16"
      : twoLeftSliders
        ? "pl-[calc(5.5rem+2px)] sm:pl-[calc(7rem+2px)] pr-12 sm:pr-16 py-12 sm:py-16"
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

  return (
    <div className="flex flex-col min-w-0 w-full">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
          {label} view
        </p>
      </div>
      <div
        ref={previewFocusRef}
        tabIndex={overlayUrl ? 0 : -1}
        onKeyDown={overlayUrl ? handleKeyDown : undefined}
        className={
          (overlayUrl || showDieCutSlider
            ? "relative w-full aspect-4/3 bg-white rounded-lg border border-[#e5e7eb] shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-[#111827]/20 focus-visible:ring-offset-1 "
            : "relative w-full aspect-4/3 bg-white rounded-lg border border-[#e5e7eb] shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden ") +
          previewMaxHeightClass
        }
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
        {patchUnderlayUrl && (
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
                maxWidth: `${patchMaxFrac * 100}%`,
                maxHeight: `${patchMaxFrac * 100}%`,
              }}
            />
          </div>
        )}
        {patchDieCutShapeUrl && (
          <div
            className="absolute inset-0 z-[6] flex items-center justify-center pointer-events-none p-2 sm:p-3"
            style={{ transform: `translateX(${LEATHER_PATCH_PREVIEW_NUDGE_PX}px)` }}
            aria-hidden
          >
            <img
              src={patchDieCutShapeUrl}
              alt=""
              className="w-auto h-auto object-contain mix-blend-multiply"
              style={{
                maxWidth: `${dieCutFrac * 100}%`,
                maxHeight: `${dieCutFrac * 100}%`,
              }}
            />
          </div>
        )}
        {showDieCutSlider && (
          <div
            className="absolute left-0 top-0 bottom-0 w-10 flex flex-col items-center justify-center z-[15] bg-gradient-to-b from-white to-[#fafafa] border-r border-[#e5e7eb] rounded-l-lg"
            style={{ paddingLeft: "2px" }}
          >
            <span className="text-[7px] font-semibold uppercase tracking-[0.1em] text-[#6b7280] mb-1 mt-2.5 text-center leading-tight px-0.5">
              Die cut
            </span>
            <div className="flex-1 flex items-center justify-center min-h-0 overflow-visible">
              <input
                type="range"
                min={OVERLAY_SCALE_MIN}
                max={OVERLAY_SCALE_MAX}
                step={0.05}
                value={dieCutScale}
                onChange={(e) => onDieCutScaleLive?.(parseFloat(e.target.value))}
                onPointerDown={onDieCutScalePointerDown}
                onPointerUp={onDieCutScalePointerUp}
                onPointerCancel={onDieCutScalePointerUp}
                className="appearance-none bg-transparent cursor-pointer touch-none [&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-[#e5e7eb] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#111827] [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:active:cursor-grabbing [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:mt-[calc(-0.5rem+4px)] [&::-moz-range-track]:h-2 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-[#e5e7eb] [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-[#111827] [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-grab"
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
        {showArtworkSlider && (
          <div
            className={
              "absolute top-0 bottom-0 w-10 flex flex-col items-center justify-center z-[15] bg-gradient-to-b from-white to-[#fafafa] border-r border-[#e5e7eb] " +
              (showDieCutSlider ? "left-10" : "left-0 rounded-l-lg")
            }
            style={{ paddingLeft: "2px" }}
          >
            <span className="text-[8px] font-semibold uppercase tracking-[0.12em] text-[#6b7280] mb-1 mt-2.5 whitespace-nowrap">
              Artwork
            </span>
            <div className="flex-1 flex items-center justify-center min-h-0 overflow-visible">
              <input
                type="range"
                min={OVERLAY_SCALE_MIN}
                max={OVERLAY_SCALE_MAX}
                step={0.05}
                value={overlayScale}
                onChange={(e) => onScaleLive(parseFloat(e.target.value))}
                onPointerDown={onScalePointerDown}
                onPointerUp={onScalePointerUp}
                onPointerCancel={onScalePointerUp}
                className="appearance-none bg-transparent cursor-pointer touch-none [&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-[#e5e7eb] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#111827] [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:active:cursor-grabbing [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:mt-[calc(-0.5rem+4px)] [&::-moz-range-track]:h-2 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-[#e5e7eb] [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-[#111827] [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-grab"
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
        {overlayUrl && (
          <>
            <div
              ref={innerRef}
              className={`absolute inset-0 z-[10] flex items-center justify-center pointer-events-none ${innerPaddingClass}`}
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
                  className="w-auto h-auto max-w-none max-h-none object-contain select-none touch-none"
                  style={{
                    maxWidth: `${OVERLAY_UI_MAX_FRAC * overlayScale * 100}%`,
                    maxHeight: `${OVERLAY_UI_MAX_FRAC * overlayScale * 100}%`,
                  }}
                  draggable={false}
                />
              </div>
            </div>
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
            <button
              type="button"
              onClick={onClear}
              className="absolute top-2 right-2 inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded-md border border-zinc-200 bg-white text-zinc-700 shadow-sm hover:bg-sky-50/90 hover:border-sky-200 hover:text-zinc-900 z-10 transition-colors"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
              Clear
            </button>
            {slotActions ? (
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
      </div>
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
      <p className="mt-2 text-[10px] sm:text-[11px] text-zinc-500 leading-snug">
        {ARTWORK_FILE_HINT}
      </p>
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
            className="absolute top-3 right-3 p-2 rounded-lg bg-white/15 text-white hover:bg-white/30 hover:ring-1 hover:ring-white/40 transition-colors"
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
              className="absolute inset-0 z-0 h-full w-full object-contain p-2 sm:p-3 md:p-6 lg:p-8"
            />
            {patchUnderlayUrl && (
              <div
                className="absolute inset-0 z-[5] flex items-center justify-center pointer-events-none p-2 sm:p-3 md:p-6 lg:p-8"
                style={{ transform: `translateX(${LEATHER_PATCH_PREVIEW_NUDGE_PX}px)` }}
                aria-hidden
              >
                <img
                  src={patchUnderlayUrl}
                  alt=""
                  className="w-auto h-auto object-contain mix-blend-multiply"
                  style={{
                    maxWidth: `${patchMaxFrac * 100}%`,
                    maxHeight: `${patchMaxFrac * 100}%`,
                  }}
                />
              </div>
            )}
            {patchDieCutShapeUrl && (
              <div
                className="absolute inset-0 z-[6] flex items-center justify-center pointer-events-none p-2 sm:p-3 md:p-6 lg:p-8"
                style={{ transform: `translateX(${LEATHER_PATCH_PREVIEW_NUDGE_PX}px)` }}
                aria-hidden
              >
                <img
                  src={patchDieCutShapeUrl}
                  alt=""
                  className="w-auto h-auto object-contain mix-blend-multiply"
                  style={{
                    maxWidth: `${dieCutFrac * 100}%`,
                    maxHeight: `${dieCutFrac * 100}%`,
                  }}
                />
              </div>
            )}
            {overlayUrl && (
              <div className="absolute inset-0 z-[10] flex items-center justify-center p-2 sm:p-3 md:p-12 lg:p-20">
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
                    className="w-auto h-auto max-w-none max-h-none object-contain pointer-events-none"
                    style={{
                      maxWidth: `${OVERLAY_UI_MAX_FRAC * overlayScale * 100}%`,
                      maxHeight: `${OVERLAY_UI_MAX_FRAC * overlayScale * 100}%`,
                    }}
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
