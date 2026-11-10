"use client";

import Link from "next/link";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  baseUrl: string;
  params: Record<string, string>;
}

export function Pagination({ currentPage, totalPages, baseUrl, params }: PaginationProps) {
  if (totalPages <= 1) return null;

  const buildUrl = (page: number) => {
    const searchParams = new URLSearchParams({ ...params, page: page.toString() });
    return `${baseUrl}?${searchParams.toString()}`;
  };

  const pages = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== "...") {
      pages.push("...");
    }
  }

  return (
    <div className="flex items-center justify-center gap-2 py-12">
      <Link
        href={buildUrl(currentPage - 1)}
        className={`w-10 h-10 flex items-center justify-center rounded-full border transition-colors ${
          currentPage === 1
            ? "border-grey-200 text-grey-300 cursor-not-allowed"
            : "border-grey-300 text-grey-600 hover:border-grey-900 hover:text-grey-900"
        }`}
        aria-disabled={currentPage === 1}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
        </svg>
      </Link>

      {pages.map((page, idx) =>
        page === "..." ? (
          <span key={`ellipsis-${idx}`} className="w-10 h-10 flex items-center justify-center text-grey-400">
            ...
          </span>
        ) : (
          <Link
            key={page}
            href={buildUrl(page as number)}
            className={`w-10 h-10 flex items-center justify-center rounded-full text-sm font-sans transition-colors ${
              currentPage === page
                ? "bg-grey-900 text-white"
                : "border border-grey-300 text-grey-600 hover:border-grey-900 hover:text-grey-900"
            }`}
          >
            {page}
          </Link>
        )
      )}

      <Link
        href={buildUrl(currentPage + 1)}
        className={`w-10 h-10 flex items-center justify-center rounded-full border transition-colors ${
          currentPage === totalPages
            ? "border-grey-200 text-grey-300 cursor-not-allowed"
            : "border-grey-300 text-grey-600 hover:border-grey-900 hover:text-grey-900"
        }`}
        aria-disabled={currentPage === totalPages}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    </div>
  );
}