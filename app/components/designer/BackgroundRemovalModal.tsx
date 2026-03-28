"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import {
  DEFAULT_BG_REMOVE_HEX,
  DEFAULT_BG_REMOVE_TOLERANCE,
  extractPaletteFromDataUrl,
  removeColorFromImageDataUrl,
  type PaletteSwatch,
} from "@/lib/overlayBackgroundRemoval";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";

const CHECKERBOARD_STYLE: CSSProperties = {
  backgroundColor: "#f3f4f6",
  backgroundImage: `
    linear-gradient(45deg, #e5e7eb 25%, transparent 25%),
    linear-gradient(-45deg, #e5e7eb 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #e5e7eb 75%),
    linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)`,
  backgroundSize: "12px 12px",
  backgroundPosition: "0 0, 0 6px, 6px -6px, -6px 0",
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Raw PNG data URL from the upload (before chroma removal). */
  previewDataUrl: string | null;
  onConfirm: (processedPngDataUrl: string) => void;
  title?: string;
  description?: string;
};

export function BackgroundRemovalModal({
  open,
  onOpenChange,
  previewDataUrl,
  onConfirm,
  title = "Remove background",
  description = "We remove a single color (default: white) so your design can sit on the hat. Pick the background color to make transparent. This is the image used in your order email.",
}: Props) {
  const [palette, setPalette] = useState<PaletteSwatch[]>([]);
  const [paletteBusy, setPaletteBusy] = useState(false);
  const [selectedHex, setSelectedHex] = useState(DEFAULT_BG_REMOVE_HEX);
  const [tolerance, setTolerance] = useState(DEFAULT_BG_REMOVE_TOLERANCE);
  const [previewProcessed, setPreviewProcessed] = useState<string | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [confirmBusy, setConfirmBusy] = useState(false);

  useEffect(() => {
    if (!open || !previewDataUrl) {
      setPalette([]);
      setPreviewProcessed(null);
      setSelectedHex(DEFAULT_BG_REMOVE_HEX);
      setTolerance(DEFAULT_BG_REMOVE_TOLERANCE);
      return;
    }
    let cancelled = false;
    setPaletteBusy(true);
    void extractPaletteFromDataUrl(previewDataUrl)
      .then((swatches) => {
        if (!cancelled) setPalette(swatches);
      })
      .finally(() => {
        if (!cancelled) setPaletteBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, previewDataUrl]);

  useEffect(() => {
    if (!open || !previewDataUrl) return;
    let cancelled = false;
    setPreviewBusy(true);
    const t = window.setTimeout(() => {
      void removeColorFromImageDataUrl(previewDataUrl, selectedHex, tolerance)
        .then((url) => {
          if (!cancelled) setPreviewProcessed(url);
        })
        .finally(() => {
          if (!cancelled) setPreviewBusy(false);
        });
    }, 140);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [open, previewDataUrl, selectedHex, tolerance]);

  const handleConfirm = useCallback(async () => {
    if (!previewDataUrl || confirmBusy) return;
    setConfirmBusy(true);
    try {
      const finalUrl = await removeColorFromImageDataUrl(
        previewDataUrl,
        selectedHex,
        tolerance
      );
      onConfirm(finalUrl);
    } finally {
      setConfirmBusy(false);
    }
  }, [previewDataUrl, confirmBusy, selectedHex, tolerance, onConfirm]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(100vw-1.5rem,26rem)] max-h-[min(92vh,44rem)]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="text-left text-zinc-600">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div
            className="relative flex min-h-[140px] items-center justify-center overflow-hidden rounded-lg border border-zinc-200 p-2"
            style={CHECKERBOARD_STYLE}
          >
            {(previewBusy || paletteBusy) && (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-white/60 text-xs text-zinc-500">
                Updating…
              </div>
            )}
            {previewProcessed || previewDataUrl ? (
              <img
                src={previewProcessed ?? previewDataUrl ?? ""}
                alt="Preview after background removal"
                className="relative z-0 max-h-[min(36vh,220px)] w-full object-contain"
              />
            ) : null}
          </div>

          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              Colors in this image
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {palette.map((s) => {
                const active =
                  s.hex.toLowerCase() === selectedHex.toLowerCase();
                return (
                  <button
                    key={s.hex}
                    type="button"
                    title={s.hex}
                    onClick={() => setSelectedHex(s.hex)}
                    className={
                      "h-9 w-9 shrink-0 rounded-full border-2 shadow-inner transition-transform " +
                      (active
                        ? "border-sky-500 ring-2 ring-sky-300 scale-105"
                        : "border-zinc-300 hover:border-zinc-400")
                    }
                    style={{ backgroundColor: s.hex }}
                  />
                );
              })}
              <label className="ml-1 flex items-center gap-1.5 text-[11px] text-zinc-600">
                <span className="sr-only">Custom color</span>
                <input
                  type="color"
                  value={selectedHex}
                  onChange={(e) => setSelectedHex(e.target.value)}
                  className="h-9 w-10 cursor-pointer rounded border border-zinc-300 bg-white p-0.5"
                  aria-label="Pick color to remove"
                />
                Custom
              </label>
            </div>
            <p className="mt-1.5 text-[10px] text-zinc-500">
              Default removes white (#FFFFFF). Tap a swatch if the background is another solid color.
            </p>
          </div>

          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-zinc-600">
              Tolerance — {tolerance}
            </span>
            <input
              type="range"
              min={8}
              max={120}
              step={1}
              value={tolerance}
              onChange={(e) =>
                setTolerance(Number.parseInt(e.target.value, 10))
              }
              className="w-full"
              aria-label="Color match tolerance"
            />
          </label>
        </div>

        <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between sm:gap-3">
          <button
            type="button"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-lg bg-[#111827] px-3 py-2 text-sm font-medium text-white hover:bg-[#1f2937] disabled:opacity-50"
            onClick={() => void handleConfirm()}
            disabled={confirmBusy || !previewDataUrl}
          >
            {confirmBusy ? "Applying…" : "Use this image"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
