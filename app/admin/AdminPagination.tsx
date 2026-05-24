"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import {
  ADMIN_PAGE_SIZE,
  adminTotalPages,
  buildAdminHref,
} from "@/lib/adminPagination";

type AdminPaginationProps = {
  month: string;
  pageParam: "shopifyPage" | "stripePage";
  currentPage: number;
  totalItems: number;
  shopifyPage: number;
  stripePage: number;
};

export default function AdminPagination({
  month,
  pageParam,
  currentPage,
  totalItems,
  shopifyPage,
  stripePage,
}: AdminPaginationProps) {
  const totalPages = adminTotalPages(totalItems);
  const start = totalItems === 0 ? 0 : (currentPage - 1) * ADMIN_PAGE_SIZE + 1;
  const end = Math.min(currentPage * ADMIN_PAGE_SIZE, totalItems);

  const prevPage = currentPage - 1;
  const nextPage = currentPage + 1;
  const prevHref = buildAdminHref(month, shopifyPage, stripePage, {
    [pageParam]: prevPage,
  });
  const nextHref = buildAdminHref(month, shopifyPage, stripePage, {
    [pageParam]: nextPage,
  });

  return (
    <div className="mt-4 flex flex-col gap-3 text-sm text-[#4b5563] sm:mt-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-center sm:text-left">
        {totalItems === 0
          ? "No items"
          : `Showing ${start}–${end} of ${totalItems}`}
      </p>
      <div className="flex items-center justify-center gap-2 sm:justify-end">
        {currentPage > 1 ? (
          <Link
            href={prevHref}
            className="inline-flex items-center gap-1 rounded-lg border border-[#e5e7eb] bg-white px-2.5 py-1.5 transition hover:border-[#111827] hover:text-[#111827]"
          >
            <ChevronLeft className="h-4 w-4" />
            Prev
          </Link>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-2.5 py-1.5 opacity-50">
            <ChevronLeft className="h-4 w-4" />
            Prev
          </span>
        )}
        <span>
          Page {currentPage} of {totalPages}
        </span>
        {currentPage < totalPages ? (
          <Link
            href={nextHref}
            className="inline-flex items-center gap-1 rounded-lg border border-[#e5e7eb] bg-white px-2.5 py-1.5 transition hover:border-[#111827] hover:text-[#111827]"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Link>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-2.5 py-1.5 opacity-50">
            Next
            <ChevronRight className="h-4 w-4" />
          </span>
        )}
      </div>
    </div>
  );
}
