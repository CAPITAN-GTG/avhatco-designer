"use client";

import { CircleHelp } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";

const STEPS = [
  {
    title: "Choose your hat",
    body: "Select a product from the list. Embroidery previews use that hat; leatherette uses a standard reference hat for patch alignment while your order keeps your pick.",
  },
  {
    title: "Pick a decoration",
    body: "Embroidery uses front and side previews. Leatherette patch is front only—the outline shows where the patch sits.",
  },
  {
    title: "Add your artwork",
    body: "Drop an image or tap to upload. Drag to position, use the side slider for size, and the arrow pad or keyboard for fine nudges (Shift = smaller steps).",
  },
  {
    title: "Review and pay",
    body: "Enter your details, check the estimate, then pay securely. We email your order after payment succeeds.",
  },
] as const;

export function DesignerHelpDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="group inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 shadow-sm hover:border-sky-300/80 hover:bg-sky-50/80 hover:text-zinc-900 transition-colors"
        >
          <CircleHelp className="h-3.5 w-3.5 text-zinc-500 group-hover:text-sky-600" aria-hidden />
          How it works
        </button>
      </DialogTrigger>
      <DialogContent className="w-[min(100vw-1.5rem,26rem)] max-h-[min(85vh,32rem)]">
        <DialogHeader>
          <DialogTitle>Using the designer</DialogTitle>
          <DialogDescription className="text-left">
            Short guide to placing your custom request.
          </DialogDescription>
        </DialogHeader>
        <ol className="mt-2 space-y-3 text-sm text-[#374151]">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex gap-3">
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#111827] text-[11px] font-semibold text-white"
                aria-hidden
              >
                {i + 1}
              </span>
              <span>
                <span className="font-medium text-[#111827]">{step.title}. </span>
                {step.body}
              </span>
            </li>
          ))}
        </ol>
      </DialogContent>
    </Dialog>
  );
}
