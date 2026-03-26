export type Slot = "front" | "side";

export const FALLBACK_BASE_IMAGES: Record<Slot, string> = {
  front: "/front.webp",
  side: "/side.webp",
};

export type BaseImages = { front: string; side: string } | null;

/** Position as fraction of content area (0–1). 0.5, 0.5 = center. */
export type NormalizedPosition = { x: number; y: number };

export const CENTER_POSITION: NormalizedPosition = { x: 0.5, y: 0.5 };

export const OVERLAY_SCALE_MIN = 0.2;
export const OVERLAY_SCALE_MAX = 1.2;
export const OVERLAY_SCALE_DEFAULT = 1;

/** Independent size control for the die-cut shape layer (multiplies patch outline size). */
export const DIE_CUT_SCALE_DEFAULT = 1;

/**
 * Max fraction of the preview content area for the overlay artwork (width & height caps).
 * The size slider multiplies this cap so layout size matches what you see (no separate CSS scale).
 */
export const OVERLAY_UI_MAX_FRAC = 0.45;

/** Shift leatherette patch outline right in the main preview, fullscreen, and exports (keep in sync). */
export const LEATHER_PATCH_PREVIEW_NUDGE_PX = 5;

/** Expand masked leather fill past computed bitmap bounds to hide subpixel gaps at die-cut edges. */
export const DIE_CUT_LEATHER_OVERLAY_BLEED_PX = 2;

/** @deprecated Use LEATHER_PATCH_PREVIEW_NUDGE_PX — fullscreen uses the same nudge as inline preview. */
export const LEATHER_PATCH_FULLSCREEN_NUDGE_PX = LEATHER_PATCH_PREVIEW_NUDGE_PX;

export const EXPORT_WIDTH = 400;
export const EXPORT_HEIGHT = 400;
/** Max longest side for "design only" export (user's artwork for download). */
export const DESIGN_ONLY_MAX_PX = 1200;
export const DESIGN_ONLY_JPEG_QUALITY = 0.85;

/** Keyboard nudge: normalized fraction of content box per arrow key. */
export const NUDGE_STEP = 0.012;
export const NUDGE_STEP_FINE = 0.004;

/** Recommended artwork hint (UX copy). */
export const ARTWORK_FILE_HINT =
  "PNG, JPG, or WebP · about 300×300 px or larger recommended for best results";

/** Arrow pad: move design by this many CSS pixels per step. */
export const DESIGN_NUDGE_PIXEL_PX = 1;

/** Delay before repeating while arrow is held (ms). */
export const ARROW_HOLD_INITIAL_DELAY_MS = 400;

/** Interval between repeated nudges while held (ms). */
export const ARROW_HOLD_REPEAT_MS = 40;
