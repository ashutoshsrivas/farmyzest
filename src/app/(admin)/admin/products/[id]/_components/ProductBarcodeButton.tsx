"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Barcode, X } from "lucide-react";
import { BarcodePrintClient } from "@/app/(admin)/admin/barcodes/BarcodePrintClient";

interface Row {
  variantId: string;
  productName: string;
  sku: string;
  barcode: string;
  label: string;
  stock: number;
  price: number;
}

// "Print Barcodes" for a single product: opens a popup with this product's
// variants and reuses the shared BarcodePrintClient — same 2-up 50×25 mm
// format, same select / copies-default-to-stock logic as /admin/barcodes.
export function ProductBarcodeButton({ rows, productName }: { rows: Row[]; productName: string }) {
  const [open, setOpen] = useState(false);
  const disabled = rows.length === 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        title={disabled ? "Save the product first to generate barcodes" : "Print barcodes for this product"}
        className="flex items-center gap-2 px-4 py-2 bg-nate-grey-100 text-nate-grey-700 rounded-lg text-sm font-medium hover:bg-nate-grey-200 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Barcode className="w-4 h-4" />
        Print Barcodes
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[80] bg-black/50 flex items-start justify-center p-4 overflow-y-auto"
            onClick={() => setOpen(false)}
          >
            <div
              className="bg-white w-full max-w-4xl rounded-xl shadow-xl my-8"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-nate-grey-100 sticky top-0 bg-white rounded-t-xl">
                <h2 className="font-serif text-lg text-nate-grey-900">Print Barcodes</h2>
                <button onClick={() => setOpen(false)} aria-label="Close" className="text-nate-grey-400 hover:text-nate-grey-800">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6">
                <BarcodePrintClient
                  rows={rows}
                  title="Print Barcodes"
                  subtitle={`${productName} · ${rows.length} variant${rows.length === 1 ? "" : "s"}`}
                />
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
