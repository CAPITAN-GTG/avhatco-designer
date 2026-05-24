"use client";

import { Calendar } from "lucide-react";
import { useRouter } from "next/navigation";

export default function AdminMonthPicker({ month }: { month: string }) {
  const router = useRouter();

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    if (!value) {
      return;
    }
    router.push(`/admin?month=${value}`);
  }

  return (
    <label className="mb-5 flex w-full flex-col gap-1.5 text-sm sm:mb-6 sm:w-auto sm:flex-row sm:items-center sm:gap-2">
      <span className="flex items-center gap-2 font-medium text-[#374151]">
        <Calendar className="h-4 w-4 shrink-0" aria-hidden />
        Month
      </span>
      <input
        type="month"
        value={month}
        onChange={handleChange}
        className="w-full rounded-xl border border-[#e5e7eb] bg-white px-3 py-2.5 text-[#111827] outline-none transition focus:border-[#111827] sm:w-auto"
      />
    </label>
  );
}
