import type { Slot } from "./overlayConstants";

export type Rect = { x: number; y: number; width: number; height: number };

export type StageGeometryConfig = {
  stageRect: Rect;
  slot: Slot;
  showArtworkSlider: boolean;
  showDieCutSlider: boolean;
};

const DEFAULT_INSET_PX = 48;
const FRONT_ONE_SLIDER_LEFT_PX = 40;
const FRONT_TWO_SLIDERS_LEFT_PX = 90;
const SIDE_LEFT_PX = 78;
const SIDE_RIGHT_PX = 34;

export function getStageGeometry(config: StageGeometryConfig): {
  contentRect: Rect;
  insets: { top: number; right: number; bottom: number; left: number };
} {
  const { stageRect, slot, showArtworkSlider, showDieCutSlider } = config;

  let left = DEFAULT_INSET_PX;
  let right = DEFAULT_INSET_PX;
  const top = DEFAULT_INSET_PX;
  const bottom = DEFAULT_INSET_PX;

  if (slot === "side") {
    left = SIDE_LEFT_PX;
    right = SIDE_RIGHT_PX;
  } else if (showArtworkSlider && showDieCutSlider) {
    left = FRONT_TWO_SLIDERS_LEFT_PX;
  } else if (showArtworkSlider || showDieCutSlider) {
    left = FRONT_ONE_SLIDER_LEFT_PX;
  }

  const x = stageRect.x + left;
  const y = stageRect.y + top;
  const width = Math.max(8, stageRect.width - left - right);
  const height = Math.max(8, stageRect.height - top - bottom);

  return {
    contentRect: { x, y, width, height },
    insets: {
      top,
      right,
      bottom,
      left,
    },
  };
}

export function normalizedToScreen(
  pos: { x: number; y: number },
  contentRect: Rect
): { x: number; y: number } {
  return {
    x: contentRect.x + pos.x * contentRect.width,
    y: contentRect.y + pos.y * contentRect.height,
  };
}

export function screenToNormalized(
  point: { x: number; y: number },
  contentRect: Rect
): { x: number; y: number } {
  return {
    x: (point.x - contentRect.x) / contentRect.width,
    y: (point.y - contentRect.y) / contentRect.height,
  };
}
