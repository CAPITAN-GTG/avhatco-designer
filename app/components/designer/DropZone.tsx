"use client";

import { useState, useCallback } from "react";
import { Upload } from "lucide-react";

export function DropZone({
  onFile,
  label,
  rightAction,
  /** When true, `rightAction` is only shown below the `md` breakpoint; the upload control gets full rounding on `md+`. */
  rightActionMobileOnly = false,
}: {
  onFile: (file: File) => void;
  label: string;
  rightAction?: React.ReactNode;
  rightActionMobileOnly?: boolean;
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
    (rightAction
      ? rightActionMobileOnly
        ? "flex-1 flex items-center justify-center gap-1.5 rounded-r-none border-r-0 md:rounded-r-lg md:border-r "
        : "flex-1 flex items-center justify-center gap-1.5 rounded-r-none border-r-0 "
      : "mt-3 block rounded-r-lg ") +
    (drag
      ? "border-sky-500 bg-sky-50/90 text-zinc-900 ring-1 ring-sky-200"
      : "border-zinc-300 bg-white text-zinc-600 hover:border-sky-300 hover:bg-sky-50/50 hover:text-zinc-900");

  const content = (
    <>
      <input
        type="file"
        accept="image/*"
        onChange={onInputChange}
        className="sr-only"
      />
      <span className="inline-flex items-center justify-center gap-1.5 text-[11px] sm:text-xs text-zinc-700">
        <Upload className="w-3.5 h-3.5 text-zinc-500" aria-hidden="true" />
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
        {rightActionMobileOnly ? (
          <div className="shrink-0 md:hidden">{rightAction}</div>
        ) : (
          rightAction
        )}
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
