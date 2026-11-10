"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import JsBarcode from "jsbarcode";
import { Printer, Search, X, ChevronLeft, ChevronRight } from "lucide-react";
import toast from "react-hot-toast";

// Admin-side barcode print sheet.
// Workflow:
//   1. Search/filter variants from the list passed in by the server.
//   2. Tick rows (or set copies per row) — selection persists across pages.
//   3. Hit "Print" — the label grid is rendered ONLY then and the browser
//      print dialog opens.
//
// Why lazy rendering: each label mounts a JsBarcode <svg>. The earlier version
// kept the entire print sheet mounted (display:none) and rebuilt it on every
// quantity change — selecting a large catalog mounted thousands of SVGs at
// once and crashed the tab. Now the sheet only mounts during the print run
// and is capped, so day-to-day interaction stays cheap.

interface Row {
  variantId: string;
  productName: string;
  sku: string;
  barcode: string;
  label: string;
  stock: number;
  price: number;
}

interface Props {
  rows: Row[];
  // Optional header overrides so this sheet can be reused on a purchase-scoped
  // page (e.g. "Print Barcodes · BILL-123") with a back link.
  title?: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
}

const PAGE_SIZE = 50;
// Hard ceiling on labels per print run. ~21 labels/A4 page → 600 ≈ 29 pages,
// which is already a lot; beyond this the browser print preview gets unstable.
const MAX_LABELS = 600;

export function BarcodePrintClient({ rows, title, subtitle, backHref, backLabel }: Props) {
  const [query, setQuery] = useState("");
  const [qty, setQty] = useState<Record<string, number>>({});
  const [page, setPage] = useState(1);
  const [printing, setPrinting] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.productName.toLowerCase().includes(q) ||
        r.sku.toLowerCase().includes(q) ||
        r.barcode.toLowerCase().includes(q) ||
        r.label.toLowerCase().includes(q)
    );
  }, [rows, query]);

  // Reset to page 1 whenever the search changes.
  useEffect(() => setPage(1), [query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Build the flat label list (one entry per copy). Cheap (array of refs);
  // only the rendering of these is expensive, and that's gated on `printing`.
  const printSheet = useMemo(() => {
    const out: Row[] = [];
    for (const r of rows) {
      const n = qty[r.variantId] ?? 0;
      for (let i = 0; i < n; i++) {
        out.push(r);
        if (out.length >= MAX_LABELS) return out;
      }
    }
    return out;
  }, [rows, qty]);

  const totalLabels = useMemo(
    () => rows.reduce((sum, r) => sum + (qty[r.variantId] ?? 0), 0),
    [rows, qty]
  );
  const selectedCount = useMemo(
    () => rows.filter((r) => (qty[r.variantId] ?? 0) > 0).length,
    [rows, qty]
  );
  // Every selected variant (across ALL pages) — the source for the top bar, so
  // you always see exactly what's queued and with how many copies.
  const selectedRows = useMemo(
    () => rows.filter((r) => (qty[r.variantId] ?? 0) > 0),
    [rows, qty]
  );

  // Default copies per variant = its stock on hand (one tag per item).
  const stockById = useMemo(() => new Map(rows.map((r) => [r.variantId, r.stock])), [rows]);
  const defaultQty = (id: string) => Math.max(1, stockById.get(id) ?? 1);

  const setOne = (id: string, n: number) =>
    setQty((m) => ({ ...m, [id]: Math.max(0, Math.min(9999, n)) }));

  const toggleOne = (id: string) =>
    setQty((m) => ({ ...m, [id]: (m[id] ?? 0) > 0 ? 0 : defaultQty(id) }));

  // "Select all" applies to the CURRENT PAGE only — predictable, and avoids
  // accidentally arming the whole catalogue with one click.
  const pageAllSelected =
    pageRows.length > 0 && pageRows.every((r) => (qty[r.variantId] ?? 0) > 0);

  const togglePageAll = () => {
    setQty((m) => {
      const next = { ...m };
      if (pageAllSelected) {
        for (const r of pageRows) next[r.variantId] = 0;
      } else {
        for (const r of pageRows) if ((next[r.variantId] ?? 0) === 0) next[r.variantId] = defaultQty(r.variantId);
      }
      return next;
    });
  };

  // Select every row matching the current search (across all pages), 1 copy
  // each. Capped at MAX_LABELS so the print run stays sane.
  const selectAllMatching = () => {
    setQty((m) => {
      const next = { ...m };
      let count = Object.values(next).filter((n) => n > 0).reduce((a) => a + 1, 0);
      for (const r of filtered) {
        if ((next[r.variantId] ?? 0) === 0) {
          if (count >= MAX_LABELS) break;
          next[r.variantId] = defaultQty(r.variantId);
          count++;
        }
      }
      return next;
    });
    if (filtered.length > MAX_LABELS) {
      toast(`Selected the first ${MAX_LABELS} (print limit).`, { icon: "ℹ️" });
    }
  };

  const clearAll = () => setQty({});

  // Search + Enter → add the matched code to the selection (top bar). Prefers an
  // EXACT sku/barcode match (scanner / typed code), else the first search hit.
  // Each Enter on an already-selected code bumps its copies by one (scan twice =
  // two copies), then clears the box for the next code.
  const addByEnter = () => {
    const q = query.trim().toLowerCase();
    if (!q) return;
    const exact = rows.find(
      (r) => r.barcode.toLowerCase() === q || r.sku.toLowerCase() === q
    );
    const match = exact ?? filtered[0];
    if (!match) {
      toast.error("No code matches that search.");
      return;
    }
    setQty((m) => ({
      ...m,
      [match.variantId]: Math.min(9999, (m[match.variantId] ?? 0) + 1),
    }));
    setQuery("");
    toast.success(`Added ${match.sku}`);
  };

  // ── Print run ──────────────────────────────────────────────────────────────
  function handlePrint() {
    if (totalLabels === 0) return;
    if (totalLabels > MAX_LABELS) {
      toast.error(
        `That's ${totalLabels} labels — too many for one run. Only the first ${MAX_LABELS} will print. Split into batches for the rest.`
      );
    }
    setPrinting(true);
  }

  // When `printing` flips on we mount the sheet, give JsBarcode a moment to
  // draw every SVG, then open the print dialog. afterprint tears it back down
  // so we never keep thousands of SVGs in memory.
  useEffect(() => {
    if (!printing) return;
    const onAfter = () => setPrinting(false);
    window.addEventListener("afterprint", onAfter);
    const t = setTimeout(() => {
      window.print();
    }, 400);
    return () => {
      clearTimeout(t);
      window.removeEventListener("afterprint", onAfter);
    };
  }, [printing]);

  return (
    <div>
      {/* Print isolation: the label sheet is portaled to <body> (see below) so
          the admin sidebar/header — which live outside this component and
          aren't tagged .no-print — don't print. The visibility trick hides
          everything, then re-shows only the portaled sheet. */}
      <style>{`
        @media print {
          /* 2-up roll/sheet: two 50mm × 25mm labels across (= 100mm wide). */
          @page { size: 100mm auto; margin: 0; }
          body * { visibility: hidden !important; }
          #barcode-print-root, #barcode-print-root * { visibility: visible !important; }
          #barcode-print-root {
            position: absolute;
            left: 0;
            top: 0;
            display: grid !important;
            grid-template-columns: repeat(2, 50mm);
            gap: 0;
          }
          #barcode-print-root .bc-label {
            width: 50mm !important;
            height: 25mm !important;
            box-sizing: border-box;
            overflow: hidden;
            border: 0 !important;
            padding: 1mm 1.5mm !important;
          }
          #barcode-print-root .barcode-svg svg {
            width: 100% !important;
            height: 8.5mm !important;
            display: block;
          }
        }
        #barcode-print-root { display: none; }
        .barcode-svg svg { width: 100%; height: auto; display: block; }
      `}</style>

      {/* ── Screen-only controls ──────────────────────────────────────────── */}
      <div className="no-print">
        <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
          <div>
            {backHref && (
              <Link
                href={backHref}
                className="inline-flex items-center gap-1 text-sm text-nate-grey-500 hover:text-nate-grey-800 mb-2"
              >
                <ChevronLeft className="w-4 h-4" />
                {backLabel ?? "Back"}
              </Link>
            )}
            <h1 className="text-2xl font-serif text-nate-grey-800">{title ?? "Print Barcodes"}</h1>
            {subtitle && <p className="text-sm text-nate-grey-500 mt-0.5">{subtitle}</p>}
            <p className="text-xs text-nate-grey-400 mt-0.5">
              Label: <strong>50 × 25&nbsp;mm, 2-up</strong>. In the print dialog set paper to
              100&nbsp;mm wide, margins <strong>None</strong>, scale <strong>100%</strong>.
            </p>
            <p className="text-sm text-nate-grey-500 mt-1">
              <span className="font-medium text-nate-grey-700">1.</span> Search a code and press{" "}
              <kbd className="px-1.5 py-0.5 rounded border border-nate-grey-300 bg-nate-grey-50 text-xs font-medium">Enter</kbd>{" "}
              to add it{" "}
              <span className="font-medium text-nate-grey-700">2.</span> set copies in the list above{" "}
              <span className="font-medium text-nate-grey-700">3.</span> hit Print.
              {selectedCount > 0 && (
                <span className="ml-2 text-nate-grey-700 font-medium">
                  {selectedCount} selected · {totalLabels} label
                  {totalLabels === 1 ? "" : "s"}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={clearAll}
              className="px-3 py-2 text-sm rounded-lg border border-nate-grey-200 text-nate-grey-600 hover:bg-nate-grey-50"
            >
              Reset
            </button>
            <button
              onClick={handlePrint}
              disabled={totalLabels === 0 || printing}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-nate-grey-900 text-white hover:bg-black disabled:bg-nate-grey-300 disabled:cursor-not-allowed transition-colors"
            >
              <Printer className="w-4 h-4" />
              {printing ? "Preparing…" : `Print${totalLabels > 0 ? ` (${Math.min(totalLabels, MAX_LABELS)})` : ""}`}
            </button>
          </div>
        </div>

        {/* Search + bulk actions */}
        <div className="bg-white rounded-xl p-4 mb-4 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-nate-grey-400" />
            <input
              type="text"
              placeholder="Search a product / SKU / barcode, then press Enter to add…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addByEnter();
                }
              }}
              className="w-full pl-9 pr-9 py-2 text-sm rounded-lg border border-nate-grey-200 focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-nate-grey-400 hover:text-nate-grey-700"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <button
            onClick={selectAllMatching}
            className="px-3 py-2 rounded-lg border border-nate-grey-200 hover:bg-nate-grey-50 text-xs font-medium text-nate-grey-700 whitespace-nowrap"
            title="Selects each variant with copies = its current stock"
          >
            Select all {filtered.length} (copies = stock)
          </button>
        </div>
        <p className="text-xs text-nate-grey-400 mb-3 -mt-1">
          Selecting a variant defaults its copies to its <strong>stock on hand</strong> (one tag per item). Adjust any row&apos;s Copies if needed.
        </p>

        {/* ── Selected bar — everything queued for print, across all pages ──── */}
        {selectedRows.length > 0 && (
          <div className="bg-white rounded-xl border-2 border-accent/30 p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-nate-grey-800">
                Selected for printing — {selectedRows.length} code{selectedRows.length === 1 ? "" : "s"} ·{" "}
                {totalLabels} label{totalLabels === 1 ? "" : "s"}
              </h2>
              <button
                onClick={clearAll}
                className="text-xs text-red-500 hover:text-red-700 font-medium"
              >
                Clear all
              </button>
            </div>
            <div className="flex flex-col gap-2 max-h-72 overflow-y-auto">
              {selectedRows.map((r) => {
                const copies = qty[r.variantId] ?? 0;
                return (
                  <div
                    key={r.variantId}
                    className="flex items-center gap-3 bg-nate-grey-50 rounded-lg px-3 py-2"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-nate-grey-800 truncate">
                        {r.productName}
                        {r.label && r.label !== "—" ? ` · ${r.label}` : ""}
                      </p>
                      <p className="text-xs text-nate-grey-400 font-mono truncate">
                        {r.sku} · {r.barcode}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => setOne(r.variantId, copies - 1)}
                        className="w-7 h-7 rounded border border-nate-grey-200 text-nate-grey-600 hover:bg-nate-grey-100 leading-none"
                        aria-label="One fewer copy"
                      >
                        −
                      </button>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={copies}
                        onChange={(e) => setOne(r.variantId, parseInt(e.target.value) || 0)}
                        className="w-14 text-center px-1 py-1 rounded border border-nate-grey-200 focus:outline-none focus:ring-2 focus:ring-accent/50 tabular-nums text-sm"
                        aria-label="Copies"
                      />
                      <button
                        onClick={() => setOne(r.variantId, copies + 1)}
                        className="w-7 h-7 rounded border border-nate-grey-200 text-nate-grey-600 hover:bg-nate-grey-100 leading-none"
                        aria-label="One more copy"
                      >
                        +
                      </button>
                    </div>
                    <span className="text-[11px] text-nate-grey-400 hidden sm:block">copies</span>
                    <button
                      onClick={() => setOne(r.variantId, 0)}
                      className="p-1 text-nate-grey-400 hover:text-red-600 shrink-0"
                      aria-label={`Remove ${r.sku}`}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Variant list */}
        <div className="bg-white rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-nate-grey-50 border-b border-nate-grey-200">
              <tr>
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={pageAllSelected}
                    onChange={togglePageAll}
                    className="h-4 w-4 accent-black cursor-pointer"
                    aria-label="Select all on this page"
                  />
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-nate-grey-500 uppercase tracking-wide">Product</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-nate-grey-500 uppercase tracking-wide">Variant</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-nate-grey-500 uppercase tracking-wide">SKU / Barcode</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-nate-grey-500 uppercase tracking-wide">Stock</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-nate-grey-500 uppercase tracking-wide">Copies</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-nate-grey-100">
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-nate-grey-500">
                    No variants match that search.
                  </td>
                </tr>
              ) : (
                pageRows.map((r) => {
                  const copies = qty[r.variantId] ?? 0;
                  const selected = copies > 0;
                  return (
                    <tr key={r.variantId} className={selected ? "bg-accent/5" : undefined}>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleOne(r.variantId)}
                          className="h-4 w-4 accent-black cursor-pointer"
                          aria-label={`Select ${r.productName} ${r.label}`}
                        />
                      </td>
                      <td className="px-6 py-3 text-nate-grey-800 font-medium">{r.productName}</td>
                      <td className="px-6 py-3 text-nate-grey-600">{r.label}</td>
                      <td className="px-6 py-3">
                        <p className="text-nate-grey-700">{r.sku}</p>
                        <p className="text-xs text-nate-grey-400 font-mono">{r.barcode}</p>
                      </td>
                      <td className="px-6 py-3 text-right text-nate-grey-600 tabular-nums">{r.stock}</td>
                      <td className="px-6 py-3 text-right">
                        <input
                          type="text" inputMode="decimal"
                          min={0}
                          max={999}
                          value={copies}
                          onChange={(e) => setOne(r.variantId, parseInt(e.target.value) || 0)}
                          className="w-20 text-right px-2 py-1 rounded border border-nate-grey-200 focus:outline-none focus:ring-2 focus:ring-accent/50 tabular-nums"
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-3 border-t border-nate-grey-100 text-sm">
              <span className="text-nate-grey-500">
                {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of{" "}
                {filtered.length}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                  className="p-1.5 rounded border border-nate-grey-200 disabled:opacity-40 hover:bg-nate-grey-50"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-2 text-nate-grey-600 tabular-nums">
                  {safePage} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                  className="p-1.5 rounded border border-nate-grey-200 disabled:opacity-40 hover:bg-nate-grey-50"
                  aria-label="Next page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {totalLabels > 0 && (
          <p className="mt-4 text-sm text-nate-grey-500 text-center">
            Ready to print <strong>{Math.min(totalLabels, MAX_LABELS)}</strong> label
            {totalLabels === 1 ? "" : "s"}
            {totalLabels > MAX_LABELS && (
              <span className="text-amber-600"> (capped from {totalLabels})</span>
            )}
            . Selection persists across pages.
          </p>
        )}
      </div>

      {/* ── Print-only sheet ──────────────────────────────────────────────────
          Portaled to <body> so it sits OUTSIDE the admin layout (which is
          h-screen overflow-hidden and would otherwise clip it) and so the
          visibility-based print CSS can isolate it from the sidebar/header.
          Mounted only during a print run. */}
      {printing &&
        typeof document !== "undefined" &&
        createPortal(
          <div id="barcode-print-root">
            {printSheet.map((r, i) => (
              <BarcodeLabel key={`${r.variantId}-${i}`} row={r} />
            ))}
          </div>,
          document.body
        )}
    </div>
  );
}

function BarcodeLabel({ row }: { row: Row }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    try {
      JsBarcode(svgRef.current, row.barcode, {
        format: "CODE128",
        width: 1.4,
        height: 38,
        displayValue: false,
        margin: 0,
      });
    } catch (err) {
      console.error("[barcode label]", row.barcode, err);
    }
  }, [row.barcode]);

  const priceStr = row.price.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  // Product line: name + variant (e.g. "HORCE LOGO POLO S-38 / WHITE").
  const productLine = [row.productName, row.label && row.label !== "—" ? row.label : ""].filter(Boolean).join(" ");

  return (
    <div
      className="bc-label"
      style={{
        breakInside: "avoid",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        fontFamily: "Arial, Helvetica, sans-serif",
        color: "#000",
      }}
    >
      <p style={{ fontSize: "6pt", fontWeight: 800, margin: 0, letterSpacing: "0.3px", lineHeight: 1.05 }}>
        FARMYZEST
      </p>
      <p
        style={{
          fontSize: "5pt",
          fontWeight: 700,
          margin: "0.4mm 0 0",
          lineHeight: 1.05,
          maxHeight: "4.6mm",
          overflow: "hidden",
        }}
      >
        {productLine}
      </p>
      <p style={{ fontSize: "5.5pt", fontWeight: 700, margin: "0.4mm 0 0.4mm" }}>
        Our Price : {priceStr}
      </p>
      <div className="barcode-svg" style={{ width: "100%" }}>
        <svg ref={svgRef} />
      </div>
      <p style={{ fontSize: "7pt", fontWeight: 800, margin: "0.3mm 0 0", letterSpacing: "0.3px" }}>
        {row.sku}
      </p>
    </div>
  );
}
