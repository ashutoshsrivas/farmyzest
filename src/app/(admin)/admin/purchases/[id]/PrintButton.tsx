"use client";

import { Printer } from "lucide-react";

// Small client wrapper so the (server-rendered) bill detail page can offer a
// print button. Server components can't pass event handlers, so the onClick
// lives here.
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-nate-grey-300 rounded-lg text-sm hover:bg-nate-grey-50"
    >
      <Printer className="w-4 h-4" />
      Print
    </button>
  );
}
