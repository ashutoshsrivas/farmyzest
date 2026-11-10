"use client";

import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  /** When provided, renders a "rows per page" selector (writes ?pageSize=). */
  pageSizeOptions?: number[];
}

export default function AdminPagination({
  page,
  totalPages,
  total,
  pageSize,
  pageSizeOptions,
}: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Hide entirely only when there's nothing to navigate AND no size selector.
  if (totalPages <= 1 && !pageSizeOptions) return null;

  const buildHref = (p: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(p));
    return `${pathname}?${params.toString()}`;
  };

  const onSizeChange = (size: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("pageSize", size);
    params.delete("page"); // back to page 1 when size changes
    router.push(`${pathname}?${params.toString()}`);
  };

  // Show at most 5 page numbers centred around current page
  const pages: (number | "…")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push("…");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push("…");
    pages.push(totalPages);
  }

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between px-6 py-4 border-t border-nate-grey-100 bg-white">
      <div className="flex items-center gap-4">
        <p className="text-sm text-nate-grey-500">
          Showing <span className="font-medium text-nate-grey-700">{from}–{to}</span> of{" "}
          <span className="font-medium text-nate-grey-700">{total}</span>
        </p>
        {pageSizeOptions && (
          <label className="flex items-center gap-1.5 text-sm text-nate-grey-500">
            <span>Rows:</span>
            <select
              value={pageSize}
              onChange={(e) => onSizeChange(e.target.value)}
              className="border border-nate-grey-200 rounded-lg px-2 py-1 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-nate-grey-400 cursor-pointer"
            >
              {pageSizeOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {totalPages > 1 && (
      <div className="flex items-center gap-1">
        <Link
          href={buildHref(page - 1)}
          aria-disabled={page === 1}
          className={cn(
            "flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm transition-colors",
            page === 1
              ? "pointer-events-none text-nate-grey-300"
              : "text-nate-grey-600 hover:bg-nate-grey-100"
          )}
        >
          <ChevronLeft className="w-4 h-4" />
          Prev
        </Link>

        {pages.map((p, i) =>
          p === "…" ? (
            <span key={`ellipsis-${i}`} className="px-2 text-nate-grey-400 text-sm">…</span>
          ) : (
            <Link
              key={p}
              href={buildHref(p)}
              className={cn(
                "w-8 h-8 flex items-center justify-center rounded-lg text-sm transition-colors",
                p === page
                  ? "bg-nate-grey-800 text-white font-medium"
                  : "text-nate-grey-600 hover:bg-nate-grey-100"
              )}
            >
              {p}
            </Link>
          )
        )}

        <Link
          href={buildHref(page + 1)}
          aria-disabled={page === totalPages}
          className={cn(
            "flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm transition-colors",
            page === totalPages
              ? "pointer-events-none text-nate-grey-300"
              : "text-nate-grey-600 hover:bg-nate-grey-100"
          )}
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
      )}
    </div>
  );
}
