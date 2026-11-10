"use client";

import { useEffect } from "react";

// When the invoice is opened with ?autoprint=1 (e.g. straight after a POS sale),
// fire the print dialog automatically once the A5 sheet has laid out.
export function AutoPrint() {
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        window.print();
      } catch {
        /* user can still use the Print button */
      }
    }, 400);
    return () => clearTimeout(t);
  }, []);
  return null;
}
