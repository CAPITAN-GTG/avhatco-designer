export const JOB_STATUS_VALUES = ["todo", "in_progress", "complete"] as const;

export type JobStatus = (typeof JOB_STATUS_VALUES)[number];

export const SHOPIFY_JOB_STATUS_NAMESPACE = "custom";
export const SHOPIFY_JOB_STATUS_KEY = "job_status";

export const STRIPE_JOB_STATUS_METADATA_KEY = "job_status";
export const STRIPE_ORDER_NUMBER_METADATA_KEY = "order_number";

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  complete: "Complete",
};

export function parseJobStatus(value: string | null | undefined): JobStatus {
  if (value === "in_progress" || value === "complete") {
    return value;
  }
  return "todo";
}

export function jobStatusRowClass(
  status: JobStatus,
  variant: "shopify" | "stripe"
): string {
  const base =
    variant === "shopify"
      ? "border-green-200/60 bg-white"
      : "border-purple-200/60 bg-white";

  switch (status) {
    case "in_progress":
      return `${base} border-amber-300 bg-amber-50/90 shadow-amber-100/50`;
    case "complete":
      return `${base} border-emerald-300 bg-emerald-50/80`;
    default:
      return base;
  }
}

export function jobStatusChipClass(status: JobStatus): string {
  const base =
    "inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium shadow-sm transition hover:opacity-90 disabled:cursor-wait disabled:opacity-70";

  switch (status) {
    case "complete":
      return `${base} bg-emerald-600 text-white`;
    case "in_progress":
      return `${base} bg-amber-500 text-white`;
    default:
      return `${base} bg-[#111827] text-white`;
  }
}

export function jobStatusTableRowClass(status: JobStatus): string {
  switch (status) {
    case "in_progress":
      return "bg-amber-50/80";
    case "complete":
      return "bg-emerald-50/70";
    default:
      return "";
  }
}
