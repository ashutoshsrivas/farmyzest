"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  Search,
  X,
  Trash2,
  Plus,
  ScanLine,
  AlertCircle,
  CheckCircle2,
  Percent,
  IndianRupee,
  PackagePlus,
} from "lucide-react";
import {
  QuickCreateProductModal,
  type CreatedProduct,
} from "@/components/admin/QuickCreateProductModal";

// New-bill form. Three principles drive the layout:
//   1. The "supplier + bill identifiers + dates" stay above the fold in a
//      three-card grid — admins glance them once and never scroll back.
//   2. Items are entered in a single horizontal row per line so quantity,
//      cost, MRP, selling, disc, tax, and amount are all visible without
//      tabbing. Add items via barcode scan (auto-focus on page load) or by
//      searching product name / SKU.
//   3. The totals card on the right is sticky on desktop so the running
//      net amount tracks every line edit.
//
// On submit we POST to /api/admin/purchases which atomically writes the
// SupplierBill, its items, increments variant stock, and (by default) syncs
// Product.costPrice from the unit costs on this bill.

interface SupplierLite {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  gstin: string | null;
}

interface CategoryLite {
  id: string;
  name: string;
}

interface TaxSlabLite {
  id: string;
  name: string;
  percentage: number;
}

interface VariantPick {
  id: string;
  sku: string;
  barcode: string;
  size: string | null;
  color: string | null;
  stock: number;
  product: {
    mrp: number;
    onlinePrice: number | null;
    sellingPrice: number | null;
  };
}
interface ProductPick {
  id: string;
  name: string;
  variants: VariantPick[];
  taxSlab: { percentage: number } | null;
}

interface LineRow {
  // local-only id
  rid: string;
  productId: string | null;
  variantId: string | null;
  // Variant code (SKU/barcode) — shown beside the line so it's clear exactly
  // which variant this is. Empty for free-text lines.
  sku?: string;
  description: string;
  hsnCode: string;
  unit: string;
  quantity: string; // string so users can clear inputs
  freeQuantity: string;
  unitCost: string;
  mrp: string;
  sellingPrice: string;
  discount1Pct: string;
  discount2Pct: string;
  taxPercent: string;
  // surfaced for the row's "in stock" hint
  stock: number | null;
}

export interface InitialBill {
  id: string;
  supplierId: string;
  refBillNo: string;
  date: string;
  shippingDate: string;
  dueDate: string;
  paymentTerm: string;
  reverseCharge: boolean;
  taxType: string;
  flatDiscount: string;
  flatDiscountIsPct: boolean;
  notes: string;
  terms: string;
  updateCostPrice: boolean;
  items: Omit<LineRow, "rid">[];
}

function num(s: string): number {
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function inr(n: number) {
  return `₹${(Math.round(n * 100) / 100).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
}

// yyyy-mm-dd for <input type="date">
function today() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

// Monotonic counter for row IDs. Safer than crypto.randomUUID() in a
// useState initializer because it doesn't produce different values on
// server-render vs client-hydrate.
let _ridCounter = 0;
function nextRid() {
  _ridCounter += 1;
  return `row-${_ridCounter}`;
}

function emptyLine(): LineRow {
  return {
    rid: nextRid(),
    productId: null,
    variantId: null,
    sku: "",
    description: "",
    hsnCode: "",
    unit: "PCS",
    quantity: "1",
    freeQuantity: "0",
    unitCost: "0",
    mrp: "",
    sellingPrice: "",
    discount1Pct: "0",
    discount2Pct: "0",
    taxPercent: "",
    stock: null,
  };
}

export function NewBillForm({
  suppliers,
  categories,
  taxSlabs,
  initial,
}: {
  suppliers: SupplierLite[];
  categories: CategoryLite[];
  taxSlabs: TaxSlabLite[];
  initial?: InitialBill;
}) {
  const isEdit = !!initial;
  const router = useRouter();

  // ── Quick-create-product modal state ───────────────────────────────────────
  // Two ways to launch the modal:
  //   - "picker": triggered from inside the product-picker overlay while the
  //     admin was filling a specific line. The result replaces that line.
  //   - "newLine": triggered from the items toolbar at the top. The result
  //     is appended as a fresh line (or replaces the last empty line).
  const [quickCreateMode, setQuickCreateMode] = useState<
    | { type: "picker"; lineIdx: number }
    | { type: "newLine" }
    | null
  >(null);
  const [quickCreateSeedName, setQuickCreateSeedName] = useState<string>("");

  // ── Header state ────────────────────────────────────────────────────────────
  const [supplierId, setSupplierId] = useState(initial?.supplierId ?? "");
  const [supplierSearch, setSupplierSearch] = useState("");
  const [supplierMenuOpen, setSupplierMenuOpen] = useState(false);

  const [refBillNo, setRefBillNo] = useState(initial?.refBillNo ?? "");
  const [date, setDate] = useState(initial?.date ?? today());
  const [shippingDate, setShippingDate] = useState(initial?.shippingDate ?? today());
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? "");
  const [paymentTerm, setPaymentTerm] = useState(initial?.paymentTerm ?? "");
  const [reverseCharge, setReverseCharge] = useState(initial?.reverseCharge ?? false);
  const [taxType, setTaxType] = useState(initial?.taxType ?? "Default");

  const [updateCostPrice, setUpdateCostPrice] = useState(initial?.updateCostPrice ?? true);

  // Footer state
  const [flatDiscount, setFlatDiscount] = useState(initial?.flatDiscount ?? "0");
  const [flatDiscountIsPct, setFlatDiscountIsPct] = useState(initial?.flatDiscountIsPct ?? true);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [terms, setTerms] = useState(initial?.terms ?? "");

  // ── Items state ─────────────────────────────────────────────────────────────
  const [lines, setLines] = useState<LineRow[]>(
    initial?.items?.length ? initial.items.map((it) => ({ ...it, rid: nextRid() })) : [emptyLine()]
  );

  // ── Product search ──────────────────────────────────────────────────────────
  const [pickerOpen, setPickerOpen] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<ProductPick[]>([]);
  const [searching, setSearching] = useState(false);

  // Barcode scan input — auto-focused
  const scanRef = useRef<HTMLInputElement>(null);

  // ── Submit state ───────────────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // ── Derived: selected supplier ──────────────────────────────────────────────
  const supplier = suppliers.find((s) => s.id === supplierId) ?? null;

  // Visible supplier list (search filter)
  const visibleSuppliers = useMemo(() => {
    const q = supplierSearch.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.phone?.toLowerCase().includes(q) ||
        s.gstin?.toLowerCase().includes(q)
    );
  }, [supplierSearch, suppliers]);

  // ── Product picker search ──────────────────────────────────────────────────
  useEffect(() => {
    if (pickerOpen == null) return;
    if (!search.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/pos/products?search=${encodeURIComponent(search)}&limit=20`
        );
        if (res.ok) {
          const data = await res.json();
          setResults(data.products ?? []);
        } else {
          setResults([]);
        }
      } finally {
        setSearching(false);
      }
    }, 220);
    return () => clearTimeout(t);
  }, [search, pickerOpen]);

  // ── Barcode scan handler ───────────────────────────────────────────────────
  // Hidden barcode input collects scans. On Enter (most scanners append CR),
  // we hit the POS barcode API to resolve and add the line.
  async function handleScan(barcode: string) {
    const trimmed = barcode.trim();
    if (!trimmed) return;
    try {
      const res = await fetch(
        `/api/pos/barcode?barcode=${encodeURIComponent(trimmed)}`
      );
      if (res.status === 404) {
        setError(`No product found for barcode ${trimmed}`);
        return;
      }
      if (!res.ok) {
        setError(`Lookup failed (${res.status})`);
        return;
      }
      const data = await res.json();
      addLineFromBarcode(data);
      setError(null);
    } catch {
      setError("Network error during barcode lookup");
    }
  }

  function addLineFromBarcode(d: {
    variantId: string;
    productId: string;
    sku: string;
    barcode: string;
    size: string | null;
    color: string | null;
    stock: number;
    product: {
      name: string;
      mrp: number;
      sellingPrice: number;
      taxPercent: number;
    };
  }) {
    const label = [d.color, d.size].filter(Boolean).join(" / ");
    const desc = `${d.product.name}${label ? ` — ${label}` : ""}`;
    const newRow: LineRow = {
      ...emptyLine(),
      productId: d.productId,
      variantId: d.variantId,
      sku: d.sku || d.barcode || "",
      description: desc,
      mrp: String(d.product.mrp),
      sellingPrice: String(d.product.sellingPrice ?? d.product.mrp),
      taxPercent: String(d.product.taxPercent ?? ""),
      stock: d.stock,
    };
    setLines((prev) => {
      // If the only existing row is empty, replace it.
      const onlyEmpty =
        prev.length === 1 &&
        !prev[0]!.productId &&
        !prev[0]!.description &&
        num(prev[0]!.unitCost) === 0;
      const next = onlyEmpty ? [newRow] : [...prev, newRow];
      return next;
    });
  }

  // ── Line ops ───────────────────────────────────────────────────────────────
  function updateLine(rid: string, patch: Partial<LineRow>) {
    setLines((prev) =>
      prev.map((l) => (l.rid === rid ? { ...l, ...patch } : l))
    );
  }
  function removeLine(rid: string) {
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((l) => l.rid !== rid)));
  }
  function addBlankLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }

  // Build a populated bill line for ONE variant of a freshly-created product.
  // `base` supplies the row's rid (and any defaults) — pass an existing line to
  // keep its position, or emptyLine() for a fresh row.
  function lineFromVariant(
    created: CreatedProduct,
    base: LineRow,
    variant: CreatedProduct["variants"][number]
  ): LineRow {
    const label = [variant.color, variant.size].filter(Boolean).join(" / ");
    const desc = `${created.name}${label ? ` — ${label}` : ""}`;
    return {
      ...base,
      productId: created.id,
      variantId: variant.id,
      sku: (variant as { sku?: string }).sku ?? "",
      description: desc,
      // Pre-fill the purchase cost from the modal so it persists on save
      // (otherwise the bill would write back a 0 cost and wipe it).
      unitCost: created.costPrice != null ? String(created.costPrice) : base.unitCost,
      mrp: String(created.mrp ?? ""),
      sellingPrice: String(
        created.sellingPrice ?? created.onlinePrice ?? created.mrp ?? ""
      ),
      taxPercent: String(created.taxSlab?.percentage ?? ""),
      stock: variant.stock,
    };
  }

  // Modal-success handler. A product can be created with many variants
  // (size × colour), so we add ONE bill line per variant. Routes to "replace
  // line N + append the rest" or "append all" based on the trigger.
  function handleQuickCreated(created: CreatedProduct) {
    const variants = created.variants;
    if (!variants.length) return;

    if (quickCreateMode?.type === "picker") {
      const lineIdx = quickCreateMode.lineIdx;
      setLines((prev) => {
        const next = [...prev];
        const firstLine = lineFromVariant(created, next[lineIdx]!, variants[0]!);
        const restLines = variants
          .slice(1)
          .map((v) => lineFromVariant(created, emptyLine(), v));
        next.splice(lineIdx, 1, firstLine, ...restLines);
        return next;
      });
      setPickerOpen(null);
      setSearch("");
      setResults([]);
    } else {
      // Top-level CTA: append all variants (replacing a trailing fully-empty
      // line so we don't leave dangling blanks).
      setLines((prev) => {
        const last = prev[prev.length - 1];
        const lastEmpty =
          last &&
          !last.productId &&
          !last.description &&
          num(last.unitCost) === 0;
        const newRows = variants.map((v) => lineFromVariant(created, emptyLine(), v));
        return lastEmpty ? [...prev.slice(0, -1), ...newRows] : [...prev, ...newRows];
      });
    }
    setQuickCreateMode(null);
  }

  function chooseVariant(lineIdx: number, product: ProductPick, variant: VariantPick) {
    const label = [variant.color, variant.size].filter(Boolean).join(" / ");
    const desc = `${product.name}${label ? ` — ${label}` : ""}`;
    setLines((prev) =>
      prev.map((l, i) =>
        i === lineIdx
          ? {
              ...l,
              productId: product.id,
              variantId: variant.id,
              sku: variant.sku || variant.barcode || "",
              description: desc,
              mrp: String(variant.product.mrp ?? ""),
              sellingPrice: String(
                variant.product.sellingPrice ?? variant.product.onlinePrice ?? ""
              ),
              taxPercent: String(product.taxSlab?.percentage ?? ""),
              stock: variant.stock,
            }
          : l
      )
    );
    setPickerOpen(null);
    setSearch("");
    setResults([]);
  }

  // ── Totals ─────────────────────────────────────────────────────────────────
  const totals = useMemo(() => {
    let subtotal = 0;
    let lineTaxSum = 0;
    for (const l of lines) {
      const qty = num(l.quantity);
      const cost = num(l.unitCost);
      const d1 = num(l.discount1Pct);
      const d2 = num(l.discount2Pct);
      const tax = num(l.taxPercent);
      const netRate = cost * (1 - d1 / 100) * (1 - d2 / 100);
      const lineBase = netRate * qty;
      const lineTax = (lineBase * tax) / 100;
      subtotal += lineBase;
      lineTaxSum += lineTax;
    }
    const flatAbs = flatDiscountIsPct
      ? (subtotal * Math.min(100, num(flatDiscount))) / 100
      : Math.min(subtotal, num(flatDiscount));
    const taxable = Math.max(0, subtotal - flatAbs);
    const effectiveTax =
      subtotal > 0 ? (lineTaxSum * taxable) / subtotal : 0;
    const raw = taxable + effectiveTax;
    const rounded = Math.round(raw);
    const roundOff = rounded - raw;
    return {
      subtotal,
      flatAbs,
      taxable,
      tax: effectiveTax,
      roundOff,
      total: rounded,
      lineTaxSum,
    };
  }, [lines, flatDiscount, flatDiscountIsPct]);

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function submit(thenCreateAnother = false) {
    if (!supplierId) {
      setError("Select a supplier first");
      return;
    }
    const validLines = lines.filter(
      (l) => l.description.trim() && num(l.quantity) > 0 && num(l.unitCost) >= 0
    );
    if (validLines.length === 0) {
      setError("Add at least one item with quantity and unit cost");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        supplierId,
        refBillNo: refBillNo || undefined,
        date,
        shippingDate: shippingDate || undefined,
        dueDate: dueDate || undefined,
        paymentTerm: paymentTerm || undefined,
        reverseCharge,
        taxType,
        flatDiscount: num(flatDiscount),
        flatDiscountIsPct,
        notes: notes || undefined,
        termsAndConditions: terms || undefined,
        updateCostPrice,
        items: validLines.map((l) => ({
          productId: l.productId,
          variantId: l.variantId,
          description: l.description,
          hsnCode: l.hsnCode || undefined,
          unit: l.unit || "PCS",
          quantity: num(l.quantity),
          freeQuantity: num(l.freeQuantity),
          unitCost: num(l.unitCost),
          mrp: l.mrp ? num(l.mrp) : undefined,
          sellingPrice: l.sellingPrice ? num(l.sellingPrice) : undefined,
          discount1Pct: num(l.discount1Pct),
          discount2Pct: num(l.discount2Pct),
          taxPercent: l.taxPercent ? num(l.taxPercent) : undefined,
        })),
      };

      const res = await fetch(
        isEdit ? `/api/admin/purchases?id=${initial!.id}` : "/api/admin/purchases",
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? `Failed (${res.status})`);
        setSubmitting(false);
        return;
      }
      setSuccess(true);
      setTimeout(() => {
        if (thenCreateAnother && !isEdit) {
          // Reset just the items; keep supplier so user can rapid-fire bills
          setLines([emptyLine()]);
          setRefBillNo("");
          setFlatDiscount("0");
          setNotes("");
          setSuccess(false);
          setSubmitting(false);
          scanRef.current?.focus();
        } else {
          router.push(`/admin/purchases/${data.bill.id}`);
        }
      }, 600);
    } catch {
      setError("Network error — please try again");
      setSubmitting(false);
    }
  }

  // ── Empty state: no suppliers yet ──────────────────────────────────────────
  // Without at least one supplier the bill cannot be created. Surface this
  // explicitly with a clear next-action instead of letting the admin sit at
  // an empty dropdown wondering what's wrong.
  if (suppliers.length === 0) {
    return (
      <div>
        <Link
          href="/admin/purchases"
          className="inline-flex items-center gap-1 text-sm text-nate-grey-500 hover:text-nate-grey-800 mb-4"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to purchases
        </Link>
        <div className="bg-white rounded-xl p-12 text-center max-w-xl mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-nate-grey-100 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-7 h-7 text-nate-grey-400" />
          </div>
          <h1 className="text-xl font-serif text-nate-grey-900 mb-2">
            Add a supplier first
          </h1>
          <p className="text-sm text-nate-grey-500 mb-6">
            You need at least one supplier on file to record a purchase bill.
            Add one in <strong>Admin → Suppliers</strong>, then come back to
            create the bill.
          </p>
          <Link
            href="/admin/suppliers"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-nate-grey-900 text-white rounded-lg text-sm font-medium hover:bg-black"
          >
            Go to Suppliers →
          </Link>
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <Link
            href="/admin/purchases"
            className="inline-flex items-center gap-1 text-sm text-nate-grey-500 hover:text-nate-grey-800 mb-2"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to purchases
          </Link>
          <h1 className="text-2xl font-serif text-nate-grey-800">
            New Supplier Bill
          </h1>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-start gap-2 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4 flex items-center gap-2 text-sm text-green-700">
          <CheckCircle2 className="w-4 h-4" />
          Bill saved · stock updated
        </div>
      )}

      {/* Three-up header cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Card 1 — Supplier */}
        <div className="bg-white rounded-xl p-5 space-y-3">
          <p className="text-[10px] uppercase tracking-wider font-semibold text-nate-grey-500">
            Supplier
          </p>

          <div className="relative">
            <button
              type="button"
              onClick={() => setSupplierMenuOpen((o) => !o)}
              className="w-full flex items-center justify-between border border-nate-grey-200 rounded-lg px-3 py-2 text-sm bg-white hover:border-nate-grey-400 transition-colors"
            >
              <span className={supplier ? "text-nate-grey-900" : "text-nate-grey-400"}>
                {supplier ? supplier.name : "Choose supplier…"}
              </span>
              <Search className="w-4 h-4 text-nate-grey-400" />
            </button>
            {supplierMenuOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-white border border-nate-grey-200 rounded-lg shadow-lg max-h-72 overflow-y-auto">
                <div className="p-2 border-b border-nate-grey-100">
                  <input
                    autoFocus
                    placeholder="Search by name, phone, GSTIN…"
                    value={supplierSearch}
                    onChange={(e) => setSupplierSearch(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-nate-grey-200 rounded outline-none"
                  />
                </div>
                <div className="py-1">
                  {visibleSuppliers.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-nate-grey-500">
                      No suppliers match.
                    </p>
                  ) : (
                    visibleSuppliers.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setSupplierId(s.id);
                          setSupplierMenuOpen(false);
                          setSupplierSearch("");
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-nate-grey-50 transition-colors"
                      >
                        <p className="text-sm font-medium text-nate-grey-800">
                          {s.name}
                        </p>
                        <p className="text-xs text-nate-grey-500">
                          {[s.phone, s.gstin].filter(Boolean).join(" · ") ||
                            "no contact / GSTIN"}
                        </p>
                      </button>
                    ))
                  )}
                </div>
                <div className="p-2 border-t border-nate-grey-100">
                  <Link
                    href="/admin/suppliers"
                    className="text-xs text-accent hover:underline"
                  >
                    Manage suppliers →
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Auto-loaded supplier details */}
          <div className="text-xs space-y-1 text-nate-grey-600 pt-2 border-t border-nate-grey-100 min-h-[80px]">
            {supplier ? (
              <>
                <p>
                  <span className="text-nate-grey-400">GSTIN: </span>
                  {supplier.gstin ?? "—"}
                </p>
                <p>
                  <span className="text-nate-grey-400">Phone: </span>
                  {supplier.phone ?? "—"}
                </p>
                <p>
                  <span className="text-nate-grey-400">Address: </span>
                  {supplier.address ?? "—"}
                </p>
              </>
            ) : (
              <p className="text-nate-grey-400">
                Supplier details will appear here once selected.
              </p>
            )}
          </div>
        </div>

        {/* Card 2 — Identifiers */}
        <div className="bg-white rounded-xl p-5 space-y-3">
          <p className="text-[10px] uppercase tracking-wider font-semibold text-nate-grey-500">
            Bill identifiers
          </p>
          <Field label="Reference Bill # (supplier's invoice no.)">
            <input
              value={refBillNo}
              onChange={(e) => setRefBillNo(e.target.value)}
              placeholder="e.g. INV-2025-09-0123"
              className="form-input"
            />
          </Field>
          <Field label="Bill date">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="form-input"
            />
          </Field>
          <Field label="Shipping date">
            <input
              type="date"
              value={shippingDate}
              onChange={(e) => setShippingDate(e.target.value)}
              className="form-input"
            />
          </Field>
          <p className="text-[11px] text-nate-grey-400 pt-2">
            Internal bill # will be auto-assigned (BIL-YYYYMMDD-NNNN) on save.
          </p>
        </div>

        {/* Card 3 — Terms */}
        <div className="bg-white rounded-xl p-5 space-y-3">
          <p className="text-[10px] uppercase tracking-wider font-semibold text-nate-grey-500">
            Payment & tax
          </p>
          <Field label="Payment term">
            <input
              value={paymentTerm}
              onChange={(e) => setPaymentTerm(e.target.value)}
              placeholder="e.g. Net 30 / Advance"
              className="form-input"
            />
          </Field>
          <Field label="Due date">
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="form-input"
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Tax type">
              <select
                value={taxType}
                onChange={(e) => setTaxType(e.target.value)}
                className="form-input"
              >
                <option>Default</option>
                <option>Inclusive</option>
                <option>Exclusive</option>
                <option>Zero-rated</option>
              </select>
            </Field>
            <Field label="Reverse charge">
              <select
                value={reverseCharge ? "yes" : "no"}
                onChange={(e) => setReverseCharge(e.target.value === "yes")}
                className="form-input"
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </Field>
          </div>
        </div>
      </div>

      {/* ── Items table ────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-nate-grey-100 flex items-center gap-3 flex-wrap">
          <p className="text-sm font-medium text-nate-grey-800">Items</p>

          {/* Hidden-ish barcode input: scanner gun outputs into this on focus */}
          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <ScanLine className="w-4 h-4 text-nate-grey-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                ref={scanRef}
                type="text"
                placeholder="Scan barcode…"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const v = (e.target as HTMLInputElement).value;
                    handleScan(v);
                    (e.target as HTMLInputElement).value = "";
                  }
                }}
                className="pl-8 pr-3 py-2 border border-nate-grey-200 rounded-lg text-sm w-56 focus:outline-none focus:ring-1 focus:ring-nate-grey-400"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setQuickCreateSeedName("");
                setQuickCreateMode({ type: "newLine" });
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-nate-grey-900 text-white rounded-lg text-xs font-medium hover:bg-black transition-colors"
            >
              <PackagePlus className="w-3.5 h-3.5" />
              New product
            </button>
            <button
              type="button"
              onClick={addBlankLine}
              className="flex items-center gap-1 px-3 py-2 bg-nate-grey-100 text-nate-grey-800 rounded-lg text-xs font-medium hover:bg-nate-grey-200 transition-colors"
            >
              <Plus className="w-3 h-3" />
              Blank line
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[1200px]">
            <thead className="bg-nate-grey-50 text-[10px] uppercase tracking-wider text-nate-grey-500">
              <tr>
                <th className="text-left px-3 py-2 w-8">#</th>
                <th className="text-left px-3 py-2 min-w-[220px]">Product / description</th>
                <th className="text-left px-3 py-2 w-24">HSN</th>
                <th className="text-right px-3 py-2 w-20">Qty</th>
                <th className="text-right px-3 py-2 w-20">Free</th>
                <th className="text-right px-3 py-2 w-24">Unit cost</th>
                <th className="text-right px-3 py-2 w-24">MRP</th>
                <th className="text-right px-3 py-2 w-24">Selling</th>
                <th className="text-right px-3 py-2 w-20">Disc 1 %</th>
                <th className="text-right px-3 py-2 w-20">Disc 2 %</th>
                <th className="text-right px-3 py-2 w-20">Tax %</th>
                <th className="text-right px-3 py-2 w-24">Landing</th>
                <th className="text-right px-3 py-2 w-28">Amount</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-nate-grey-100">
              {lines.map((l, idx) => {
                const qty = num(l.quantity);
                const cost = num(l.unitCost);
                const d1 = num(l.discount1Pct);
                const d2 = num(l.discount2Pct);
                const tax = num(l.taxPercent);
                const netRate = cost * (1 - d1 / 100) * (1 - d2 / 100);
                const lineBase = netRate * qty;
                const lineTax = (lineBase * tax) / 100;
                const lineAmount = lineBase + lineTax;
                // Landed unit cost = net cost (after discounts) + its GST.
                const landingPerUnit = netRate * (1 + tax / 100);
                return (
                  <tr key={l.rid} className="hover:bg-nate-grey-50/50">
                    <td className="px-3 py-2 text-nate-grey-400">{idx + 1}</td>
                    <td className="px-3 py-2">
                      <div className="space-y-1">
                        <div className="flex items-start gap-1">
                          <textarea
                            value={l.description}
                            onChange={(e) =>
                              updateLine(l.rid, { description: e.target.value })
                            }
                            rows={2}
                            placeholder="Type or pick product…"
                            // Textarea (not a single-line input) so long product
                            // names/descriptions are fully visible and wrap.
                            className="form-input flex-1 resize-y min-h-[38px] leading-snug"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setPickerOpen(idx);
                              setSearch("");
                              setResults([]);
                            }}
                            className="px-2 py-1.5 bg-nate-grey-100 hover:bg-nate-grey-200 rounded text-nate-grey-700"
                            title="Search products"
                          >
                            <Search className="w-3 h-3" />
                          </button>
                        </div>
                        {l.sku && (
                          <p className="text-xs font-mono text-nate-grey-600">
                            Code: <span className="font-semibold text-nate-grey-800">{l.sku}</span>
                          </p>
                        )}
                        {l.variantId && (
                          <p className="text-[10px] text-nate-grey-500">
                            Inventory line · current stock:{" "}
                            <span className="font-medium">{l.stock ?? "—"}</span>
                            {l.stock != null && (
                              <span className="text-green-600">
                                {" "}
                                → after save: {l.stock + qty + num(l.freeQuantity)}
                              </span>
                            )}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        value={l.hsnCode}
                        onChange={(e) =>
                          updateLine(l.rid, { hsnCode: e.target.value })
                        }
                        className="form-input"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text" inputMode="decimal"
                        value={l.quantity}
                        onChange={(e) =>
                          updateLine(l.rid, { quantity: e.target.value })
                        }
                        className="form-input text-right"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text" inputMode="decimal"
                        value={l.freeQuantity}
                        onChange={(e) =>
                          updateLine(l.rid, { freeQuantity: e.target.value })
                        }
                        className="form-input text-right"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text" inputMode="decimal"
                        step="0.01"
                        value={l.unitCost}
                        onChange={(e) =>
                          updateLine(l.rid, { unitCost: e.target.value })
                        }
                        className="form-input text-right"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text" inputMode="decimal"
                        step="0.01"
                        value={l.mrp}
                        onChange={(e) => updateLine(l.rid, { mrp: e.target.value })}
                        className="form-input text-right"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text" inputMode="decimal"
                        step="0.01"
                        value={l.sellingPrice}
                        onChange={(e) =>
                          updateLine(l.rid, { sellingPrice: e.target.value })
                        }
                        className="form-input text-right"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text" inputMode="decimal"
                        step="0.01"
                        value={l.discount1Pct}
                        onChange={(e) =>
                          updateLine(l.rid, { discount1Pct: e.target.value })
                        }
                        className="form-input text-right"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text" inputMode="decimal"
                        step="0.01"
                        value={l.discount2Pct}
                        onChange={(e) =>
                          updateLine(l.rid, { discount2Pct: e.target.value })
                        }
                        className="form-input text-right"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text" inputMode="decimal"
                        step="0.01"
                        value={l.taxPercent}
                        onChange={(e) =>
                          updateLine(l.rid, { taxPercent: e.target.value })
                        }
                        placeholder="0"
                        className="form-input text-right"
                      />
                    </td>
                    <td className="px-3 py-2 text-right text-nate-grey-600 tabular-nums">
                      {inr(landingPerUnit)}
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-nate-grey-800 tabular-nums">
                      {inr(lineAmount)}
                    </td>
                    <td className="px-3 py-2">
                      {lines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeLine(l.rid)}
                          className="text-nate-grey-300 hover:text-red-600 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-nate-grey-50/50 text-sm">
                <td colSpan={3} className="px-3 py-3 text-right text-nate-grey-500">
                  Items total
                </td>
                <td className="px-3 py-3 text-right text-nate-grey-700 font-medium">
                  {lines.reduce((s, l) => s + num(l.quantity), 0)}
                </td>
                <td className="px-3 py-3 text-right text-nate-grey-700 font-medium">
                  {lines.reduce((s, l) => s + num(l.freeQuantity), 0)}
                </td>
                <td colSpan={7}></td>
                <td className="px-3 py-3 text-right font-medium text-nate-grey-900 tabular-nums">
                  {inr(
                    lines.reduce((s, l) => {
                      const qty = num(l.quantity);
                      const cost = num(l.unitCost);
                      const d1 = num(l.discount1Pct);
                      const d2 = num(l.discount2Pct);
                      const tax = num(l.taxPercent);
                      const netRate =
                        cost * (1 - d1 / 100) * (1 - d2 / 100);
                      const base = netRate * qty;
                      return s + base + (base * tax) / 100;
                    }, 0)
                  )}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ── Bottom row: notes + totals ────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        <div className="space-y-3">
          <div className="bg-white rounded-xl p-5">
            <label className="block text-[10px] uppercase tracking-wider font-semibold text-nate-grey-500 mb-2">
              Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal note for this bill"
              className="form-input"
            />
          </div>
          <div className="bg-white rounded-xl p-5">
            <label className="block text-[10px] uppercase tracking-wider font-semibold text-nate-grey-500 mb-2">
              Terms & conditions
            </label>
            <textarea
              rows={2}
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              placeholder="e.g. Goods once accepted are not returnable"
              className="form-input"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-nate-grey-700">
            <input
              type="checkbox"
              checked={updateCostPrice}
              onChange={(e) => setUpdateCostPrice(e.target.checked)}
              className="rounded"
            />
            Update each product's cost price from this bill's unit cost
          </label>
        </div>

        {/* Totals card */}
        <div className="bg-nate-grey-900 text-white rounded-xl p-5 space-y-2.5 text-sm h-fit">
          <Row label="Gross amount" value={inr(totals.subtotal)} />
          <div className="flex items-center justify-between">
            <span className="text-nate-grey-300">Flat discount</span>
            <div className="flex items-center gap-1">
              <input
                type="text" inputMode="decimal"
                step="0.01"
                value={flatDiscount}
                onChange={(e) => setFlatDiscount(e.target.value)}
                className="w-20 px-2 py-1 text-right bg-white/10 border border-white/15 rounded text-white text-sm"
              />
              <button
                type="button"
                onClick={() => setFlatDiscountIsPct((v) => !v)}
                className="w-8 h-8 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded transition-colors"
                title={flatDiscountIsPct ? "Switch to ₹" : "Switch to %"}
              >
                {flatDiscountIsPct ? (
                  <Percent className="w-3.5 h-3.5" />
                ) : (
                  <IndianRupee className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>
          <Row label="Discount applied" value={`− ${inr(totals.flatAbs)}`} />
          <Row label="Taxable amount" value={inr(totals.taxable)} />
          <Row label="Tax" value={inr(totals.tax)} />
          <Row label="Round-off" value={inr(totals.roundOff)} muted />
          <div className="flex items-center justify-between pt-3 mt-2 border-t border-white/15">
            <span className="text-base">Net amount</span>
            <span className="font-serif text-2xl tabular-nums">{inr(totals.total)}</span>
          </div>
        </div>
      </div>

      {/* ── Sticky action bar ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 sticky bottom-0 bg-nate-grey-100/95 backdrop-blur py-3 -mx-8 px-8 border-t border-nate-grey-200">
        <Link
          href="/admin/purchases"
          className="px-4 py-2 text-sm text-nate-grey-700 hover:text-nate-grey-900"
        >
          Cancel
        </Link>
        <div className="flex items-center gap-2">
          {!isEdit && (
            <button
              type="button"
              onClick={() => submit(true)}
              disabled={submitting}
              className="px-4 py-2 border border-nate-grey-300 text-nate-grey-800 rounded-lg text-sm font-medium hover:bg-white disabled:opacity-50"
            >
              Save & add another
            </button>
          )}
          <button
            type="button"
            onClick={() => submit(false)}
            disabled={submitting}
            className="px-5 py-2 bg-nate-grey-900 text-white rounded-lg text-sm font-medium hover:bg-black disabled:opacity-50"
          >
            {submitting ? "Saving…" : isEdit ? "Update bill" : "Save bill"}
          </button>
        </div>
      </div>

      {/* ── Quick-create-product modal ─────────────────────────────────────── */}
      <QuickCreateProductModal
        open={quickCreateMode != null}
        onClose={() => setQuickCreateMode(null)}
        onCreated={handleQuickCreated}
        categories={categories}
        taxSlabs={taxSlabs}
        initialName={quickCreateSeedName}
      />

      {/* ── Product picker overlay ────────────────────────────────────────── */}
      {pickerOpen != null && (
        <div
          className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPickerOpen(null);
          }}
        >
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-nate-grey-100">
              <Search className="w-4 h-4 text-nate-grey-400" />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by product name, SKU, or barcode…"
                className="flex-1 outline-none text-sm"
              />
              <button
                onClick={() => setPickerOpen(null)}
                className="text-nate-grey-400 hover:text-nate-grey-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {/* Inline "create new product" CTA. Always visible — the
                  search may simply return zero matches because the SKU
                  isn't in the catalog yet. */}
              <button
                type="button"
                onClick={() => {
                  setQuickCreateSeedName(search.trim());
                  if (pickerOpen != null) {
                    setQuickCreateMode({ type: "picker", lineIdx: pickerOpen });
                  }
                }}
                className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-left text-sm border border-dashed border-nate-grey-300 hover:border-nate-grey-900 hover:bg-nate-grey-50 mb-3"
              >
                <span className="flex items-center gap-2">
                  <PackagePlus className="w-4 h-4 text-nate-grey-700" />
                  <span className="font-medium text-nate-grey-800">
                    Create new product
                    {search.trim() ? (
                      <>
                        {" — "}
                        <span className="text-nate-grey-500">
                          &ldquo;{search.trim()}&rdquo;
                        </span>
                      </>
                    ) : null}
                  </span>
                </span>
                <span className="text-xs text-nate-grey-400">
                  Adds to inventory
                </span>
              </button>

              {searching && (
                <p className="text-xs text-nate-grey-400 px-3 py-2">
                  Searching…
                </p>
              )}
              {!searching && search.trim() && results.length === 0 && (
                <p className="text-sm text-nate-grey-500 px-3 py-6 text-center">
                  No matches. Use the button above to create one.
                </p>
              )}
              {!search.trim() && (
                <p className="text-xs text-nate-grey-400 px-3 py-2">
                  Type to search products, scan a barcode, or create a new one.
                </p>
              )}
              {results.map((p) => (
                <div key={p.id} className="mb-2">
                  <p className="text-xs font-medium text-nate-grey-700 px-2 py-1">
                    {p.name}
                  </p>
                  <div className="space-y-1">
                    {p.variants.map((v) => {
                      const label =
                        [v.color, v.size].filter(Boolean).join(" / ") || "—";
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => chooseVariant(pickerOpen, p, v)}
                          className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-left text-sm hover:bg-nate-grey-50"
                        >
                          <div className="min-w-0">
                            <p className="font-medium text-nate-grey-800">{label}</p>
                            <p className="text-xs text-nate-grey-500">
                              SKU {v.sku} · BC {v.barcode}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs text-nate-grey-500">
                              MRP {inr(v.product.mrp)}
                            </p>
                            <p className="text-xs text-nate-grey-400">
                              {v.stock} in stock
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs text-nate-grey-600 mb-1">{label}</span>
      {children}
    </label>
  );
}

function Row({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={muted ? "text-nate-grey-400" : "text-nate-grey-300"}>{label}</span>
      <span className={`tabular-nums ${muted ? "text-nate-grey-400" : ""}`}>{value}</span>
    </div>
  );
}
