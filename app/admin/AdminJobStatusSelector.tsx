"use client";

import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import {
  JOB_STATUS_LABELS,
  JOB_STATUS_VALUES,
  jobStatusChipClass,
  type JobStatus,
} from "@/lib/adminJobStatus";

type AdminJobStatusSelectorProps = {
  source: "shopify" | "stripe";
  id: string;
  initialStatus: JobStatus;
};

export default function AdminJobStatusSelector({
  source,
  id,
  initialStatus,
}: AdminJobStatusSelectorProps) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setStatus(initialStatus);
  }, [initialStatus]);

  const otherOptions = JOB_STATUS_VALUES.filter((value) => value !== status);

  async function handleSelect(next: JobStatus) {
    if (next === status || busy) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/job-status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, id, status: next }),
      });

      const data = (await response.json().catch(() => null)) as {
        error?: string;
        status?: JobStatus;
      } | null;

      if (!response.ok) {
        throw new Error(data?.error ?? "Could not update job status");
      }

      setStatus(data?.status ?? next);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            disabled={busy}
            aria-label={`Job status: ${JOB_STATUS_LABELS[status]}. Click to change.`}
            className={jobStatusChipClass(status)}
          >
            <span>{JOB_STATUS_LABELS[status]}</span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[10rem]">
          {otherOptions.map((value) => (
            <DropdownMenuItem
              key={value}
              disabled={busy}
              onSelect={() => handleSelect(value)}
            >
              {JOB_STATUS_LABELS[value]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
