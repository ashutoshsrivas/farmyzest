"use client";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="px-5 py-2 rounded-full bg-nate-grey-800 text-white text-xs font-medium uppercase tracking-wider hover:bg-nate-grey-700 transition-colors"
    >
      Print / Save PDF
    </button>
  );
}
