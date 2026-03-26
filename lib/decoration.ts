export type DecorationType = "embroidery" | "leather";

/** Default leatherette material (selected by default in the UI). */
export const DEFAULT_LEATHER_COLOR = "Rawhide" as const;

/** Default patch outline when opening leatherette options. */
export const DEFAULT_LEATHER_OUTLINE = "circle" as const;

/**
 * Max fraction of the preview/export content box for the leatherette patch artwork (min of W/H).
 * Circle stays compact; rectangle is much larger; hexagons moderately larger.
 */
export function leatherPatchPreviewMaxFrac(outline: string | null): number {
  const o = outline ?? DEFAULT_LEATHER_OUTLINE;
  switch (o) {
    case "circle":
      return 0.25;
    case "rectangle":
      return 0.38;
    case "hexagon short":
      return 0.3;
    case "hexagon long":
      return 0.38;
    case "die cut":
      return 0.3;
    default:
      return 0.25;
  }
}

export const PATCH_SHAPES: { value: string; label: string; image: string }[] = [
  { value: "circle", label: "Circle", image: "/circle.png" },
  { value: "rectangle", label: "Rectangle", image: "/rectangle.png" },
  { value: "hexagon short", label: "Hexagon short", image: "/hexagon-short.png" },
  { value: "hexagon long", label: "Hexagon long", image: "/hexagon-long.png" },
  { value: "die cut", label: "Die cut", image: "/die-cut.png" },
];

export const LEATHER_COLORS: { value: string; label: string; image: string }[] = [
  { value: "Rawhide", label: "Rawhide", image: "/rawhide.jpeg" },
  { value: "Aluminum Gold", label: "Aluminum Gold", image: "/aluminum_gold.jpeg" },
  { value: "Aluminum Silver", label: "Aluminum Silver", image: "/aluminum_silver.jpeg" },
  { value: "Rustic Gold", label: "Rustic Gold", image: "/rustic_gold.jpeg" },
  { value: "Holographic Leatherette", label: "Holographic Leatherette", image: "/holographic_leatherette.jpeg" },
];

/**
 * Public filenames use `rectanble` for rectangle (legacy spelling) and `custom` for die cut.
 */
const SHAPE_TO_FILE_PREFIX: Record<string, string> = {
  circle: "circle",
  rectangle: "rectanble",
  "hexagon short": "hexagon-short",
  "hexagon long": "hexagon-long",
  "die cut": "custom",
};

const COLOR_TO_FILE_SUFFIX: Record<string, string> = {
  Rawhide: "rawhide",
  "Aluminum Gold": "gold",
  "Aluminum Silver": "silver",
  "Rustic Gold": "RG",
  "Holographic Leatherette": "holographic",
};

/** Every shape × material composite texture under `/public` (for preloading). */
export const LEATHER_PATCH_TEXTURE_URLS: readonly string[] = (() => {
  const urls: string[] = [];
  for (const shape of PATCH_SHAPES) {
    const prefix = SHAPE_TO_FILE_PREFIX[shape.value];
    if (!prefix) continue;
    for (const color of LEATHER_COLORS) {
      const suffix = COLOR_TO_FILE_SUFFIX[color.value];
      if (!suffix) continue;
      urls.push(`/${prefix}-${suffix}.PNG`);
    }
  }
  return Object.freeze(urls);
})();

/**
 * Leatherette patch artwork for preview/export: material-specific texture for the chosen outline.
 * With only an outline, returns the generic shape image. With both, returns the composite PNG.
 */
export function leatherPatchTextureSrc(
  outline: string | null,
  color: string | null
): string | null {
  if (!outline) return null;
  const shape = PATCH_SHAPES.find((s) => s.value === outline);
  const fallback = shape?.image ?? null;
  const resolved = color ?? DEFAULT_LEATHER_COLOR;
  const prefix = SHAPE_TO_FILE_PREFIX[outline];
  const suffix = COLOR_TO_FILE_SUFFIX[resolved];
  if (!prefix || !suffix) return fallback;
  return `/${prefix}-${suffix}.PNG`;
}

/** @deprecated Use {@link leatherPatchTextureSrc} with outline (and optional color). */
export function patchImageForOutline(outline: string | null): string | null {
  return leatherPatchTextureSrc(outline, null);
}
