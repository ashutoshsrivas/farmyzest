"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import toast, { Toaster } from "react-hot-toast";
import { ExchangeFlow } from "@/components/exchange/ExchangeFlow";
import {
  ShoppingCart,
  Search,
  Printer,
  Pause,
  Trash2,
  Plus,
  Minus,
  X,
  Package,
  Clock,
  User,
  CreditCard,
  Banknote,
  Smartphone,
  RotateCcw,
  Wallet,
  LogOut,
} from "lucide-react";
import { adminNavItems } from "@/lib/admin-nav";
import { bestAutoTier, type CouponInput, type DiscountLine } from "@/lib/discount";

// ─── Types ────────────────────────────────────────────────────────────────────

type Salesman = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  commissionRate: number;
};

type ProductVariant = {
  id: string;
  sku: string;
  barcode: string;
  size: string | null;
  color: string | null;
  colorHex: string | null;
  priceOverride: number | null;
  stock: number;
  lowStockThreshold: number;
  product: {
    id: string;
    name: string;
    mrp: number;
    onlinePrice: number | null;
    sellingPrice: number | null;
    // Max discount % caps (most-restrictive of the two wins; null = uncapped).
    maxDiscountPct?: number | null;
    categoryMaxDiscountPct?: number | null;
    // Flat POS discount % from the product's category (null/0 = none).
    categoryPosDiscountPct?: number | null;
    taxSlab: { percentage: number } | null;
  };
  images: { url: string; isPrimary: boolean }[];
};

type Product = {
  id: string;
  name: string;
  mrp: number;
  onlinePrice: number | null;
  sellingPrice: number | null;
  maxDiscountPct?: number | null;
  categoryMaxDiscountPct?: number | null;
  taxSlab: { percentage: number } | null;
  variants: ProductVariant[];
  images: { url: string; isPrimary: boolean; alt: string | null }[];
};

type DiscountType = "PERCENT" | "FIXED";

type CartItem = {
  variantId: string;
  productId: string;
  name: string;
  variantLabel: string;
  sku: string;
  barcode: string;
  price: number;
  taxPercent: number;
  quantity: number;
  stock: number;
  imageUrl: string;
  // Per-line discount. PERCENT = % off the line; FIXED = ₹ off the line total.
  // Clamped to maxDiscountPct (the product/category cap) on entry + at the
  // server. null = uncapped.
  discountType: DiscountType;
  discountValue: number;
  maxDiscountPct: number | null;
  // Optional per-line (article-wise) salesman. Empty = use the bill's salesman.
  // When set, this article's commission is credited to this salesman instead.
  salesmanId?: string;
};

type HeldBill = {
  id: string; // DB row id
  billNumber: string;
  salesmanId: string;
  salesmanName: string;
  items: CartItem[];
  subtotal: number;
  taxAmount: number;
  total: number;
  savedAt: string;
  // Full working-state snapshot, so retrieving restores the whole in-progress
  // bill (customer, discounts, charges, notes), not just the line items.
  payload?: DraftState;
};

// The complete POS working state persisted to localStorage (draft-on-refresh)
// and embedded in a held bill's payload (resume-from-DB).
type DraftState = {
  items: CartItem[];
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  salesmanId?: string;
  attendedById?: string;
  billDiscountType?: DiscountType;
  billDiscountValue?: string;
  additionalCharges?: string;
  roundOff?: boolean;
  orderType?: "WALK_IN" | "DELIVERY";
  billNotes?: string;
};

type PrintData = {
  orderNumber: string;
  date: string;
  salesmanName: string;
  customerName?: string;
  customerPhone?: string;
  items: {
    name: string;
    variant: string;
    quantity: number;
    unitPrice: number;
    taxPercent: number | null;
    total: number;
  }[];
  subtotal: number;
  discount: number;
  taxAmount: number;
  total: number;
  paymentMethod: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateBillNumber(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `HLD-${ts}-${rand}`;
}

function formatCurrency(n: number) {
  return `₹${n.toFixed(2)}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getVariantPrice(v: ProductVariant): number {
  // Defensive: if the API response somehow shows up without the nested
  // product (shouldn't happen with /api/pos/products) we degrade gracefully
  // to 0 instead of throwing during render.
  const p = v.product;
  const base =
    v.priceOverride ??
    p?.sellingPrice ??
    p?.onlinePrice ??
    p?.mrp ??
    0;
  // Category-level POS discount (independent of the online discount). Applied
  // as a flat markdown to the list price so the counter price, the cart line,
  // and the unit price billed to the server all agree. null/0 = no change.
  const pct = p?.categoryPosDiscountPct ?? 0;
  if (pct > 0) return Math.round(base * (1 - Math.min(100, pct) / 100));
  return base;
}

function getVariantLabel(v: ProductVariant): string {
  if (v.size && v.color) return `${v.color} / ${v.size}`;
  if (v.size) return v.size;
  if (v.color) return v.color;
  return "—";
}

function getVariantImage(v: ProductVariant): string {
  const imgs = v.images ?? [];
  const primary = imgs.find((i) => i.isPrimary);
  if (primary) return primary.url;
  if (imgs[0]) return imgs[0].url;
  return "";
}

/** Money taken off `base` for a discount. Uncapped input; caller floors. */
function discountAmount(type: DiscountType, value: number, base: number): number {
  if (!value || value <= 0) return 0;
  const raw = type === "PERCENT" ? (base * value) / 100 : value;
  return Math.min(base, Math.max(0, raw)); // never more than the base → net ≥ 0
}

/** Most-restrictive discount cap (%) — tighter of product & category caps. */
function effectiveCapPct(
  productCap: number | null | undefined,
  categoryCap: number | null | undefined
): number | null {
  const caps = [productCap, categoryCap].filter((c): c is number => c != null);
  return caps.length ? Math.min(...caps) : null;
}

/**
 * Clamp a discount value to a line's max-discount cap. Returns the (possibly
 * reduced) value and whether it was clamped, so the UI can flag it.
 * PERCENT is capped directly; FIXED is capped to capPct% of the line gross.
 */
function clampDiscountValue(
  type: DiscountType,
  value: number,
  gross: number,
  capPct: number | null
): { value: number; clamped: boolean } {
  if (capPct == null || value <= 0) return { value, clamped: false };
  const max = type === "PERCENT" ? capPct : (gross * capPct) / 100;
  if (value > max) return { value: Math.max(0, Math.round(max * 100) / 100), clamped: true };
  return { value, clamped: false };
}

// Speak "Out of stock" loud and clear when a cashier hits a sold-out item, so
// they hear it without having to read the toast. Uses the browser's built-in
// speech synthesis (no audio asset needed); fails silently if unsupported.
function speakOutOfStock() {
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel(); // drop any queued speech so this fires immediately
    const u = new SpeechSynthesisUtterance("Out of stock");
    u.volume = 1; // max
    u.rate = 0.95;
    u.pitch = 1;
    u.lang = "en-IN";
    synth.speak(u);
  } catch {
    /* speech unavailable — the toast still shows */
  }
}

/** Gross (pre-discount) line total. */
function lineGross(i: CartItem): number {
  return i.price * i.quantity;
}

/** ₹ discount applied to a single line. */
function lineDiscount(i: CartItem): number {
  return discountAmount(i.discountType, i.discountValue, lineGross(i));
}

type BillDiscount = { type: DiscountType; value: number };

// Totals pipeline (GST-INCLUSIVE — no tax added at POS):
//   line net   = gross − line discount
//   subtotal   = Σ gross                       (list value, pre-discount)
//   bill disc  = % / ₹ off the net subtotal
//   total      = subtotal − allDiscounts       (floored at 0; price already incl. GST)
function calcCartTotals(items: CartItem[], bill?: BillDiscount) {
  let subtotal = 0; // gross
  let lineDiscountTotal = 0;
  for (const i of items) {
    subtotal += lineGross(i);
    lineDiscountTotal += lineDiscount(i);
  }
  const netSubtotal = subtotal - lineDiscountTotal;
  // A bill discount is applied PER LINE so each item keeps the discount up to
  // its own max-discount cap — e.g. a 20% bill discount gives 20% on an
  // uncapped item but only 15% on one capped at 15%. The per-line shares are
  // summed, never clamped to the strictest item.
  let billDiscountAmount = 0;
  if (bill && bill.value > 0 && netSubtotal > 0) {
    const reqTotal = discountAmount(bill.type, bill.value, netSubtotal);
    for (const i of items) {
      const gross = lineGross(i);
      const lineDisc = lineDiscount(i);
      const lineNet = gross - lineDisc;
      if (lineNet <= 0) continue;
      const reqLine =
        bill.type === "FIXED"
          ? reqTotal * (lineNet / netSubtotal) // proportional ₹ share
          : discountAmount("PERCENT", bill.value, lineNet);
      const room =
        i.maxDiscountPct == null
          ? Infinity
          : Math.max(0, gross * (i.maxDiscountPct / 100) - lineDisc);
      billDiscountAmount += Math.min(reqLine, room);
    }
    billDiscountAmount = Math.round(billDiscountAmount * 100) / 100;
  }
  const totalDiscount = lineDiscountTotal + billDiscountAmount;
  // Selling prices are GST-inclusive, so no tax is added on the POS bill.
  const total = Math.max(0, subtotal - totalDiscount);
  return {
    subtotal,
    lineDiscountTotal,
    billDiscountAmount,
    totalDiscount,
    taxAmount: 0,
    total,
  };
}

// ─── Print Receipt Component ──────────────────────────────────────────────────

function Receipt({ printData, salesmanName }: { printData: PrintData; salesmanName: string }) {
  const LINE_WIDTH = 40;
  const SEP = "─".repeat(LINE_WIDTH);

  function center(text: string, width = LINE_WIDTH) {
    const pad = Math.max(0, Math.floor((width - text.length) / 2));
    return " ".repeat(pad) + text;
  }

  function row(name: string, qty: number, rate: number, total: number) {
    const n = name.slice(0, 14);
    const q = `x${qty}`;
    const r = formatCurrency(rate);
    const t = formatCurrency(total);
    return `${n.padEnd(14)}${q.padEnd(5)}${r.padStart(7)}${t.padStart(10)}`;
  }

  return (
    <div
      id="pos-receipt"
      style={{
        fontFamily: "'Courier New', monospace",
        fontSize: "13px",
        color: "#000",
        background: "#fff",
        width: "203px",
        padding: "8px",
      }}
    >
      <p style={{ textAlign: "center", fontWeight: "bold", fontSize: "16px", margin: "0 0 4px" }}>
        {center("FARMYZEST")}
      </p>
      <p style={{ textAlign: "center", margin: "0 0 4px" }}>{center("Garden & Agri Store")}</p>
      <p style={{ textAlign: "center", margin: "0 0 8px", fontSize: "11px" }}>
        {center(new Date(printData.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }))}
        {"\n"}
        {center(new Date(printData.date).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }))}
      </p>
      <p style={{ margin: "0", textAlign: "center" }}>{SEP}</p>
      <p style={{ margin: "2px 0", fontWeight: "bold" }}>
        {`ORDER: ${printData.orderNumber}`}
      </p>
      <p style={{ margin: "2px 0" }}>{`SALESMAN: ${salesmanName}`}</p>
      {printData.customerName ? (
        <p style={{ margin: "2px 0" }}>{`CUSTOMER: ${printData.customerName}`}</p>
      ) : null}
      {printData.customerPhone ? (
        <p style={{ margin: "2px 0" }}>{`PHONE: ${printData.customerPhone}`}</p>
      ) : null}
      <p style={{ margin: "0", textAlign: "center" }}>{SEP}</p>
      <p style={{ margin: "3px 0", fontWeight: "bold" }}>
        {"ITEM".padEnd(14)} {"QTY".padEnd(5)} {"RATE".padStart(7)} {"TOTAL".padStart(10)}
      </p>
      <p style={{ margin: "0", textAlign: "center" }}>{SEP}</p>
      {printData.items.map((item, i) => (
        <p key={i} style={{ margin: "2px 0", fontSize: "12px" }}>
          {row(item.name, item.quantity, item.unitPrice, item.total)}
        </p>
      ))}
      <p style={{ margin: "0", textAlign: "center" }}>{SEP}</p>
      <p style={{ margin: "3px 0" }}>
        {"SUBTOTAL".padEnd(20)}
        {formatCurrency(printData.subtotal).padStart(16)}
      </p>
      {printData.discount > 0 ? (
        <p style={{ margin: "3px 0" }}>
          {"DISCOUNT".padEnd(20)}
          {`-${formatCurrency(printData.discount)}`.padStart(16)}
        </p>
      ) : null}
      <p style={{ margin: "4px 0", fontWeight: "bold", fontSize: "15px" }}>
        {"TOTAL".padEnd(20)}
        {formatCurrency(printData.total).padStart(16)}
      </p>
      <p style={{ margin: "2px 0", textAlign: "center", fontSize: "11px" }}>
        {center(`PAID BY: ${printData.paymentMethod}`)}
      </p>
      <p style={{ margin: "8px 0 0", textAlign: "center" }}>{SEP}</p>
      <p style={{ textAlign: "center", margin: "4px 0", fontSize: "11px" }}>
        {center("Thank you for shopping with us!")}
      </p>
      <p style={{ textAlign: "center", margin: "2px 0", fontSize: "10px" }}>
        {center("No exchange / return on sale items")}
      </p>
    </div>
  );
}

// One label/value line in the right sidebar's detail panels.
function SbRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
      <span style={{ fontSize: 11, color: "#7C735C", flexShrink: 0 }}>{label}</span>
      <span
        style={{
          fontSize: 12,
          color: strong ? "#1F2E22" : "#2F3A2B",
          fontWeight: strong ? 700 : 500,
          textAlign: "right",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
        title={value}
      >
        {value}
      </span>
    </div>
  );
}

// Cash-drawer control modal — opening float, cash in/out, expected cash.
function CashControlModal({ onClose }: { onClose: () => void }) {
  type State = {
    opening: number; cashIn: number; cashOut: number; cashSales: number; expected: number;
    openedAt: string | null;
    movements: { id: string; type: string; amount: number; note: string | null; at: string }[];
  };
  const [data, setData] = useState<State | null>(null);
  const [type, setType] = useState<"OPEN" | "IN" | "OUT" | "CLOSE">("IN");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/pos/cash-control");
      if (res.ok) setData(await res.json());
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function record() {
    const amt = parseFloat(amount);
    if (!(amt >= 0)) return toast.error("Enter an amount");
    setSaving(true);
    try {
      const res = await fetch("/api/pos/cash-control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, amount: amt, note: note.trim() || undefined }),
      });
      if (!res.ok) return toast.error("Couldn't save");
      toast.success(`${type === "OPEN" ? "Drawer opened" : type === "CLOSE" ? "Drawer closed" : type === "IN" ? "Cash in" : "Cash out"} recorded`);
      setAmount(""); setNote("");
      load();
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  }

  const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

  return (
    <div className="modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 300, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 20, overflowY: "auto", fontFamily: "Inter, sans-serif" }} onClick={onClose}>
      <div style={{ background: "#fff", width: "100%", maxWidth: 440, borderRadius: 12, marginTop: 40 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: "1px solid #E7E1D0" }}>
          <span style={{ fontWeight: 700, fontSize: 16, color: "#1F2E22" }}>Cash Control</span>
          <button onClick={onClose} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#7C735C" }}><X size={18} /></button>
        </div>
        <div style={{ padding: 18 }}>
          {/* Expected cash summary */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
            {[
              { l: "Opening", v: data?.opening ?? 0 },
              { l: "Cash sales", v: data?.cashSales ?? 0 },
              { l: "Cash in", v: data?.cashIn ?? 0 },
              { l: "Cash out", v: data?.cashOut ?? 0 },
            ].map((s) => (
              <div key={s.l} style={{ border: "1px solid #E7E1D0", borderRadius: 8, padding: "8px 10px" }}>
                <div style={{ fontSize: 10, textTransform: "uppercase", color: "#A89F86", fontWeight: 600 }}>{s.l}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#2F3A2B" }}>{inr(s.v)}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "#1F2E22", color: "#fff", borderRadius: 8, marginBottom: 16 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Expected in drawer</span>
            <span style={{ fontSize: 20, fontWeight: 800 }}>{inr(data?.expected ?? 0)}</span>
          </div>

          {/* Record a movement */}
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            {(["OPEN", "IN", "OUT", "CLOSE"] as const).map((t) => (
              <button key={t} onClick={() => setType(t)} className="pos-btn" style={{ flex: 1, padding: "8px 4px", borderRadius: 7, border: "1px solid #D3CAB2", cursor: "pointer", fontSize: 12, fontWeight: 600, background: type === t ? "#2F3A2B" : "#fff", color: type === t ? "#fff" : "#7C735C" }}>
                {t === "OPEN" ? "Open" : t === "IN" ? "Cash In" : t === "OUT" ? "Cash Out" : "Close"}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input type="text" inputMode="decimal" min="0" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount ₹" style={{ flex: 1, padding: "9px 10px", border: "1px solid #D3CAB2", borderRadius: 7, outline: "none" }} />
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" style={{ flex: 1.4, padding: "9px 10px", border: "1px solid #D3CAB2", borderRadius: 7, outline: "none" }} />
          </div>
          <button onClick={record} disabled={saving} className="pos-btn" style={{ width: "100%", padding: "10px", borderRadius: 8, border: "none", background: "#2F3A2B", color: "#fff", fontWeight: 600, cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
            {saving ? "Saving…" : "Record"}
          </button>

          {/* Recent movements */}
          {data && data.movements.length > 0 && (
            <div style={{ marginTop: 16, maxHeight: 180, overflowY: "auto" }} className="scrollbar-thin">
              {data.movements.map((m) => (
                <div key={m.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #F1EDE1", fontSize: 12 }}>
                  <span style={{ color: "#7C735C" }}>{m.type}{m.note ? ` · ${m.note}` : ""}</span>
                  <span style={{ fontWeight: 600, color: "#2F3A2B" }}>{inr(m.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main POS Page ────────────────────────────────────────────────────────────

export default function PosPage() {
  // Data
  const [salesmen, setSalesmen] = useState<Salesman[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Side navigation drawer (opened from the SS logo).
  const [navOpen, setNavOpen] = useState(false);

  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);
  const [billDiscountType, setBillDiscountType] = useState<DiscountType>("PERCENT");
  const [billDiscountValue, setBillDiscountValue] = useState("");
  // Vasy-style bill extras.
  const [orderType, setOrderType] = useState<"WALK_IN" | "DELIVERY">("WALK_IN");
  const [additionalCharges, setAdditionalCharges] = useState(""); // ad-hoc ₹ (delivery/packaging)
  const [roundOff, setRoundOff] = useState(false); // snap total to nearest rupee
  const [couponCode, setCouponCode] = useState(""); // entered manual coupon
  const [couponDiscount, setCouponDiscount] = useState(0); // validated ₹ off (display)
  const [couponMsg, setCouponMsg] = useState<string | null>(null);

  // Automatic spend-tier coupons (applied by cart value, no code). Fetched once;
  // the best qualifying tier is computed live below as the cart changes.
  const [autoCoupons, setAutoCoupons] = useState<CouponInput[]>([]);

  // Customer — email is required (receipt + identity); name/phone optional.
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  // Internal remark saved on the bill for staff reference. Never printed on the
  // customer receipt or shared with the customer.
  const [billNotes, setBillNotes] = useState("");

  // Store-credit wallet, looked up by the customer's phone.
  const [walletBalance, setWalletBalance] = useState(0);
  const [applyWallet, setApplyWallet] = useState(false);
  const [redeemingCredit, setRedeemingCredit] = useState(false);

  // Look up the wallet balance whenever a full 10-digit phone is entered.
  useEffect(() => {
    const digits = customerPhone.replace(/\D/g, "");
    if (digits.length < 10) {
      setWalletBalance(0);
      setApplyWallet(false);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/pos/wallet?phone=${encodeURIComponent(digits)}`);
        const data = await res.json();
        if (!cancelled) {
          setWalletBalance(res.ok ? data.balance ?? 0 : 0);
          // Auto-fill a returning customer's name (don't clobber a typed one).
          if (res.ok && data.name) {
            setCustomerName((prev) => (prev.trim() ? prev : data.name));
          }
        }
      } catch {
        if (!cancelled) setWalletBalance(0);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [customerPhone]);

  // Exchange flow
  const [showExchange, setShowExchange] = useState(false);

  // Session
  const [salesmanId, setSalesmanId] = useState("");
  const [attendedById, setAttendedById] = useState("");
  // Per-method amounts for split tender (blank = not used yet).
  const [splitAmounts, setSplitAmounts] = useState({ CASH: "", UPI: "", CARD: "", CREDIT: "" });
  const [currentTime, setCurrentTime] = useState(new Date());

  // UI state
  const [showHeldModal, setShowHeldModal] = useState(false);
  const [heldBills, setHeldBills] = useState<HeldBill[]>([]);
  const [showCashItemModal, setShowCashItemModal] = useState(false);
  // When set, the variant picker is open for this product (multi-variant items).
  const [pickerProduct, setPickerProduct] = useState<Product | null>(null);
  const [cashItemName, setCashItemName] = useState("");
  const [cashItemPrice, setCashItemPrice] = useState("");
  const [cashItemQty, setCashItemQty] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [printData, setPrintData] = useState<PrintData | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastOrderNum, setLastOrderNum] = useState("");
  const [lastOrderId, setLastOrderId] = useState("");

  // Edit mode — re-opening a past POS bill (/pos?edit=<id>) to amend & re-save
  // in place, keeping its original date/time.
  const [editOrderId, setEditOrderId] = useState<string | null>(null);
  const [editOrderNum, setEditOrderNum] = useState("");
  const [editCreatedAt, setEditCreatedAt] = useState("");

  // Right sidebar data (Vasy-style).
  type CustSummary = {
    name: string | null;
    visits: number;
    lastVisited: string | null;
    lastBillAmount: number;
    lastPaymentMode: string | null;
    mostPurchasedItem: string | null;
    totalPurchase: number;
    duePayment: number;
    loyaltyPoints: number;
    creditNotes?: { id: string; amount: number; note: string | null; createdAt: string }[];
    creditNoteTotal?: number;
  };
  const [custSummary, setCustSummary] = useState<CustSummary | null>(null);
  const [lastBill, setLastBill] = useState<{ orderId: string; orderNumber: string; total: number; date: string } | null>(null);
  const [showCashControl, setShowCashControl] = useState(false);
  const [scanInvoice, setScanInvoice] = useState("");
  // Customer typeahead (name / phone / email).
  const [custQuery, setCustQuery] = useState("");
  const [custSuggest, setCustSuggest] = useState<{ name: string; phone: string; email: string }[]>([]);
  const [showSuggest, setShowSuggest] = useState(false);
  // Keyboard-highlighted row in the customer typeahead. -1 = none (Enter then
  // picks the top match); custSuggest.length = the "Create new customer" row.
  const [custHighlight, setCustHighlight] = useState(-1);

  // Customer snapshot for the right sidebar — fetched on a full phone number.
  useEffect(() => {
    const digits = customerPhone.replace(/\D/g, "");
    if (digits.length < 10) {
      setCustSummary(null);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/pos/customer-summary?phone=${encodeURIComponent(digits)}`);
        const d = await res.json();
        if (!cancelled) setCustSummary(res.ok && d.found ? d : null);
      } catch {
        if (!cancelled) setCustSummary(null);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [customerPhone]);

  // Last POS bill for the sidebar reprint — refreshes after each completed sale.
  useEffect(() => {
    fetch("/api/pos/last-bill")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.found) setLastBill(d);
      })
      .catch(() => {});
  }, [lastOrderId]);

  // Manual coupon — re-validate whenever the code or cart changes so the shown
  // discount always matches what the server will charge (same engine).
  useEffect(() => {
    const code = couponCode.trim();
    if (!code || cart.length === 0) {
      setCouponDiscount(0);
      setCouponMsg(null);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/coupons/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, items: cart.map((i) => ({ variantId: i.variantId, quantity: i.quantity })) }),
        });
        const d = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setCouponDiscount(0);
          setCouponMsg(d.error ?? "Invalid coupon");
          return;
        }
        const disc = d.discount ?? 0;
        setCouponDiscount(disc);
        setCouponMsg(disc > 0 ? `−${formatCurrency(disc)} applied` : "No discount on this cart");
      } catch {
        if (!cancelled) {
          setCouponDiscount(0);
          setCouponMsg("Network error");
        }
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // cart objects change identity on edit — that's intended (re-validate).
  }, [couponCode, cart]);

  // Customer typeahead — suggest by name / phone / email as the cashier types.
  useEffect(() => {
    const q = custQuery.trim();
    if (q.length < 2) {
      setCustSuggest([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/pos/customer-search?q=${encodeURIComponent(q)}`);
        const d = await res.json();
        if (!cancelled) setCustSuggest(res.ok ? d.customers ?? [] : []);
      } catch {
        if (!cancelled) setCustSuggest([]);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [custQuery]);

  // Edit mode — if opened as /pos?edit=<id>, load that bill into the cart.
  useEffect(() => {
    const editId = new URLSearchParams(window.location.search).get("edit");
    if (!editId) return;
    (async () => {
      try {
        const res = await fetch(`/api/pos/orders/${editId}`);
        const d = await res.json();
        if (!res.ok) {
          toast.error(d.error ?? "Couldn't load this bill");
          window.history.replaceState(null, "", "/pos");
          return;
        }
        setCart(d.items);
        setCustomerName(d.customerName || "");
        setCustomerPhone(d.customerPhone || "");
        setCustomerEmail(d.customerEmail || "");
        if (d.salesmanId) setSalesmanId(d.salesmanId);
        setAttendedById(d.attendedById || "");
        setOrderType(d.orderType === "DELIVERY" ? "DELIVERY" : "WALK_IN");
        setAdditionalCharges(d.additionalCharges ? String(d.additionalCharges) : "");
        setRoundOff(!!d.roundOff);
        setBillNotes(d.notes || "");
        setBillDiscountType("FIXED");
        setBillDiscountValue(d.billDiscountValue > 0 ? String(d.billDiscountValue) : "");
        setSplitAmounts({
          CASH: d.payments.cash ? String(d.payments.cash) : "",
          UPI: d.payments.upi ? String(d.payments.upi) : "",
          CARD: d.payments.card ? String(d.payments.card) : "",
          CREDIT: d.payments.credit ? String(d.payments.credit) : "",
        });
        setEditOrderId(d.id);
        setEditOrderNum(d.posOrderNum || d.id.slice(-8).toUpperCase());
        setEditCreatedAt(d.createdAt);
        toast.success(`Editing bill ${d.posOrderNum ?? ""}`);
      } catch {
        toast.error("Couldn't load this bill");
      }
    })();
    // Mount-only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refs
  const barcodeRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // ─── Clock ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // ─── Fetch salesmen on mount ─────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/pos/salesmen")
      .then((r) => r.json())
      .then((data) => {
        if (data.salesmen) {
          setSalesmen(data.salesmen);
          if (data.salesmen.length > 0 && !salesmanId) {
            setSalesmanId(data.salesmen[0].id);
          }
        }
      })
      .catch(() => toast.error("Failed to load salesmen"));
  }, [salesmanId]);

  // ─── Fetch auto spend-tier coupons on mount ─────────────────────────────────
  useEffect(() => {
    fetch("/api/pos/auto-coupons")
      .then((r) => (r.ok ? r.json() : { coupons: [] }))
      .then((d) =>
        setAutoCoupons(
          (d.coupons ?? []).map((c: CouponInput) => ({
            ...c,
            validFrom: c.validFrom ? new Date(c.validFrom) : null,
            validUntil: c.validUntil ? new Date(c.validUntil) : null,
          }))
        )
      )
      .catch(() => {});
  }, []);

  // ─── Fetch products on mount ────────────────────────────────────────────────
  // Uses /api/pos/products — purpose-built endpoint that injects the parent
  // product onto each variant and returns variant images. The general
  // /api/products endpoint can't be used here because Prisma's nested
  // variants[] don't carry a back-reference to the product, and the POS
  // helpers (getVariantPrice, getVariantImage) depend on that shape.
  // Load (and reload) the product grid. Called on mount and again after every
  // sale so the displayed stock reflects the just-committed deductions.
  const loadProducts = useCallback(() => {
    fetch("/api/pos/products?limit=100")
      .then(async (r) => {
        if (r.status === 401) {
          toast.error("Please sign in to use POS");
          return { products: [] };
        }
        if (!r.ok) {
          toast.error("Failed to load products");
          return { products: [] };
        }
        return r.json();
      })
      .then((data) => {
        if (data?.products) setProducts(data.products);
      })
      .catch(() => toast.error("Failed to load products"));
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // ─── Product search ─────────────────────────────────────────────────────────
  // Hits the POS-shaped endpoint so search results have the same parent-product
  // and image fields the grid below expects. Previously this used
  // /api/products which returned a different shape — the grid then crashed on
  // first access of `variant.product.sellingPrice`.
  useEffect(() => {
    if (!search.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(
          `/api/pos/products?search=${encodeURIComponent(search)}&limit=60`
        );
        if (!res.ok) {
          setSearchResults([]);
          if (res.status !== 401) toast.error("Search failed");
          return;
        }
        const data = await res.json();
        setSearchResults(data.products ?? []);
      } catch {
        setSearchResults([]);
        toast.error("Search failed");
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const displayedProducts = search.trim() ? searchResults : products;

  // Live availability = DB stock minus what's already in the current bill, so
  // the grid decrements in realtime as items are added/removed. Cart is small,
  // so recomputing the map each render is cheap.
  const cartQtyByVariant: Record<string, number> = {};
  for (const i of cart) cartQtyByVariant[i.variantId] = (cartQtyByVariant[i.variantId] || 0) + i.quantity;
  const availableStock = (v: ProductVariant) => v.stock - (cartQtyByVariant[v.id] || 0);
  // Hide genuinely out-of-stock products (every variant at 0 DB stock) from the grid.
  const visibleProducts = displayedProducts.filter((p) => p.variants.some((v) => v.stock > 0));

  // ─── Add an item by its variant code (SKU or barcode) ───────────────────────
  // Shared by the hidden barcode scanner and the search box (Enter to add).
  // Returns true when an item was added to the cart.
  const addByCode = useCallback(
    async (raw: string): Promise<boolean> => {
      const code = raw.trim();
      if (!code) return false;
      const codeUpper = code.toUpperCase();

      // 1) Local cache lookup (instant, no network) — match SKU or barcode,
      // case-insensitively (ss02358 == SS02358).
      for (const product of products) {
        const variant = product.variants.find(
          (v) => v.barcode?.toUpperCase() === codeUpper || v.sku?.toUpperCase() === codeUpper
        );
        if (variant) {
          if (variant.stock <= 0) {
            toast.error(`${product.name} is out of stock`);
            speakOutOfStock();
            return false;
          }
          addVariantToCart(product, variant);
          toast.success(`Added: ${product.name} ${getVariantLabel(variant)}`);
          return true;
        }
      }

      // 2) Server lookup via /api/pos/barcode (indexed lookup, clean 404).
      try {
        const res = await fetch(`/api/pos/barcode?barcode=${encodeURIComponent(code)}`);
        if (res.status === 404) {
          toast.error(`No product found for code: ${code}`);
          return false;
        }
        if (!res.ok) {
          toast.error(`Lookup failed (${res.status}). Try again.`);
          return false;
        }
        const data = await res.json();
        if (!data?.variantId) {
          toast.error(`Unexpected response for code: ${code}`);
          return false;
        }
        if ((data.stock ?? 0) <= 0) {
          toast.error(`${data.product?.name ?? "Item"} is out of stock`);
          speakOutOfStock();
          return false;
        }

        // Adapt the /api/pos/barcode response shape to our Product + Variant
        // types so addVariantToCart can be used unchanged.
        const productLike: Product = {
          id: data.productId,
          name: data.product.name,
          mrp: data.product.mrp,
          onlinePrice: data.product.onlinePrice,
          sellingPrice: data.product.sellingPrice,
          taxSlab: data.product.taxSlab,
          variants: [],
          images: data.product.imageUrl
            ? [{ url: data.product.imageUrl, isPrimary: true, alt: null }]
            : [],
        };
        const variantLike: ProductVariant = {
          id: data.variantId,
          sku: data.sku,
          barcode: data.barcode,
          size: data.size,
          color: data.color,
          colorHex: data.colorHex,
          priceOverride: null,
          stock: data.stock,
          lowStockThreshold: data.lowStockThreshold,
          product: {
            id: data.productId,
            name: data.product.name,
            mrp: data.product.mrp,
            onlinePrice: data.product.onlinePrice,
            sellingPrice: data.product.sellingPrice,
            categoryPosDiscountPct: data.product.categoryPosDiscountPct ?? null,
            taxSlab: data.product.taxSlab,
          },
          images: data.product.imageUrl
            ? [{ url: data.product.imageUrl, isPrimary: true }]
            : [],
        };
        addVariantToCart(productLike, variantLike);
        toast.success(`Added: ${productLike.name} ${getVariantLabel(variantLike)}`);
        return true;
      } catch (err) {
        console.error("[POS code lookup]", err);
        toast.error("Network error — could not look up code");
        return false;
      }
    },
    [products]
  );

  // ─── Barcode scanner (hidden input) ─────────────────────────────────────────
  const handleBarcodeScan = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const code = e.target.value.trim();
      e.target.value = "";
      if (code) await addByCode(code);
    },
    [addByCode]
  );

  // ─── Add variant to cart ────────────────────────────────────────────────────
  const addVariantToCart = (product: Product, variant: ProductVariant) => {
    const variantLabel = getVariantLabel(variant);
    const price = getVariantPrice(variant);
    const taxPercent = variant.product.taxSlab?.percentage ?? 0;
    const imageUrl = getVariantImage(variant);

    setCart((prev) => {
      const existing = prev.find((i) => i.variantId === variant.id);
      if (existing) {
        // Guard against the live DB stock, not the snapshot taken at add-time.
        if (existing.quantity >= variant.stock) {
          toast.error("No more stock available");
          return prev;
        }
        return prev.map((i) =>
          i.variantId === variant.id
            ? { ...i, quantity: i.quantity + 1, stock: variant.stock }
            : i
        );
      }
      return [
        ...prev,
        {
          variantId: variant.id,
          productId: product.id,
          name: product.name,
          variantLabel,
          sku: variant.sku,
          barcode: variant.barcode,
          price,
          taxPercent,
          quantity: 1,
          stock: variant.stock,
          imageUrl,
          discountType: "PERCENT",
          discountValue: 0,
          maxDiscountPct: effectiveCapPct(
            variant.product.maxDiscountPct,
            variant.product.categoryMaxDiscountPct
          ),
        },
      ];
    });
  };

  // ─── Add cash item to cart ─────────────────────────────────────────────────
  const addCashItemToCart = () => {
    const price = parseFloat(cashItemPrice) || 0;
    if (price <= 0) {
      toast.error("Enter a valid price");
      return;
    }
    const qty = Math.max(1, parseInt(String(cashItemQty)) || 1);
    setCart((prev) => [
      ...prev,
      {
        variantId: `cash-${Date.now()}`,
        productId: "cash",
        name: cashItemName.trim() || "Custom Item",
        variantLabel: "",
        sku: "",
        barcode: "",
        price,
        taxPercent: 0,
        quantity: qty,
        stock: 999,
        imageUrl: "",
        discountType: "PERCENT",
        discountValue: 0,
        maxDiscountPct: null, // cash/custom items have no catalog cap
      },
    ]);
    setShowCashItemModal(false);
    setCashItemName("");
    setCashItemPrice("");
    setCashItemQty(1);
    toast.success("Cash item added");
  };

  // ─── Quantity controls ──────────────────────────────────────────────────────
  const updateQty = (variantId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) =>
          i.variantId === variantId
            ? { ...i, quantity: Math.max(0, Math.min(i.quantity + delta, i.stock)) }
            : i
        )
        .filter((i) => i.quantity > 0)
    );
  };

  const removeItem = (variantId: string) => {
    setCart((prev) => prev.filter((i) => i.variantId !== variantId));
  };

  // Per-line discount edit. The value is clamped to the product/category
  // max-discount cap — if the cashier enters more, it's automatically reduced
  // to the cap (the server enforces the same ceiling as a backstop).
  const setLineDiscount = (
    variantId: string,
    patch: Partial<Pick<CartItem, "discountType" | "discountValue">>
  ) => {
    setCart((prev) =>
      prev.map((i) => {
        if (i.variantId !== variantId) return i;
        const next = { ...i, ...patch };
        const { value, clamped } = clampDiscountValue(
          next.discountType,
          next.discountValue || 0,
          lineGross(next),
          next.maxDiscountPct
        );
        if (clamped) {
          toast.error(`Max discount for this item is ${i.maxDiscountPct}%`);
        }
        return { ...next, discountValue: value };
      })
    );
  };

  // Assign (or clear) a per-line article-wise salesman.
  const setLineSalesman = (variantId: string, salesmanId: string) => {
    setCart((prev) => prev.map((i) => (i.variantId === variantId ? { ...i, salesmanId } : i)));
  };

  const clearCart = () => {
    setCart([]);
    setBillDiscountValue("");
    setCustomerName("");
    setCustomerPhone("");
    setCustomerEmail("");
    setCustQuery("");
    setCustSuggest([]);
    setAdditionalCharges("");
    setRoundOff(false);
    setCouponCode("");
    setCouponDiscount(0);
    setCouponMsg(null);
  };

  // ─── Draft persistence + snapshot ────────────────────────────────────────────
  // Snapshot the full working state (used for the localStorage draft AND a held
  // bill's payload).
  const buildDraft = (): DraftState => ({
    items: cart,
    customerName,
    customerPhone,
    customerEmail,
    salesmanId,
    attendedById,
    billDiscountType,
    billDiscountValue,
    additionalCharges,
    roundOff,
    orderType,
    billNotes,
  });

  // Restore a snapshot into the live bill (retrieving a held bill / rehydrating
  // the on-refresh draft). Line items always restore; the rest only when present.
  const applyDraft = (d: DraftState) => {
    setCart(Array.isArray(d.items) ? d.items : []);
    if (d.customerName !== undefined) setCustomerName(d.customerName);
    if (d.customerPhone !== undefined) setCustomerPhone(d.customerPhone);
    if (d.customerEmail !== undefined) setCustomerEmail(d.customerEmail);
    if (d.salesmanId) setSalesmanId(d.salesmanId);
    if (d.attendedById !== undefined) setAttendedById(d.attendedById);
    if (d.billDiscountType) setBillDiscountType(d.billDiscountType);
    if (d.billDiscountValue !== undefined) setBillDiscountValue(d.billDiscountValue);
    if (d.additionalCharges !== undefined) setAdditionalCharges(d.additionalCharges);
    if (d.roundOff !== undefined) setRoundOff(d.roundOff);
    if (d.orderType) setOrderType(d.orderType);
    if (d.billNotes !== undefined) setBillNotes(d.billNotes);
  };

  // Rehydrate the in-progress bill after an accidental refresh / tab reopen. The
  // active cart lives in this browser (localStorage) so it isn't lost. Skipped
  // when opened to edit a past bill (/pos?edit=…) — that flow loads its own data.
  const draftReady = useRef(false);
  useEffect(() => {
    const isEdit = new URLSearchParams(window.location.search).has("edit");
    if (!isEdit) {
      try {
        const raw = localStorage.getItem("pos_draft");
        if (raw) {
          const d = JSON.parse(raw) as DraftState;
          if (d && Array.isArray(d.items) && d.items.length > 0) applyDraft(d);
        }
      } catch {
        /* ignore a corrupt draft */
      }
    }
    draftReady.current = true;
    // Mount-only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist the working state on every change (once the initial rehydrate has
  // run, so we never clobber a saved draft with the empty mount state). Not
  // persisted while editing a past bill — that isn't a POS draft.
  useEffect(() => {
    if (!draftReady.current) return;
    if (editOrderId) return;
    try {
      if (cart.length === 0) localStorage.removeItem("pos_draft");
      else localStorage.setItem("pos_draft", JSON.stringify(buildDraft()));
    } catch {
      /* storage full / unavailable — non-fatal */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, customerName, customerPhone, customerEmail, salesmanId, attendedById, billDiscountType, billDiscountValue, additionalCharges, roundOff, orderType, billNotes, editOrderId]);

  // Fill the customer fields from a chosen suggestion (auto-fetches summary +
  // wallet via the customerPhone effects).
  const selectCustomer = (c: { name: string; phone: string; email: string }) => {
    if (c.name) setCustomerName(c.name);
    if (c.phone) setCustomerPhone(c.phone);
    if (c.email) setCustomerEmail(c.email);
    setCustQuery(c.name || c.phone || "");
    setCustSuggest([]);
    setShowSuggest(false);
  };

  // Create a customer account on the fly (when a phone/name search finds no one)
  // and drop them into the customer box. The account persists so a credit note
  // can be linked to them and any future lookup finds them. A phone search
  // creates the account immediately; a name search just stages the name and
  // asks for the phone (which is required to save an account).
  const createCustomer = async () => {
    const q = custQuery.trim();
    const qDigits = q.replace(/\D/g, "");
    let name = customerName.trim();
    let phone = customerPhone.trim();
    // Route whatever was typed into the right box.
    if (qDigits.length >= 10 && !phone) {
      phone = q;
      setCustomerPhone(q);
    } else if (!name && qDigits.length < 10) {
      name = q;
      setCustomerName(q);
    }
    if (phone.replace(/\D/g, "").length < 10) {
      setShowSuggest(false);
      setCustQuery("");
      toast("Enter the phone number to save the customer", { icon: "📱" });
      return;
    }
    try {
      const res = await fetch("/api/pos/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name || undefined, phone, email: customerEmail.trim() || undefined }),
      });
      const d = await res.json();
      if (!res.ok) {
        toast.error(d.error ?? "Couldn't create customer");
        return;
      }
      setCustomerName(d.name || name || "");
      setCustomerPhone(d.phone || phone);
      if (d.email) setCustomerEmail(d.email);
      setCustQuery("");
      setCustSuggest([]);
      setShowSuggest(false);
      toast.success("Customer added");
    } catch {
      toast.error("Network error — please retry.");
    }
  };

  // Move the customer's outstanding credit notes into their store-credit wallet,
  // then auto-enable "Apply store credit" so it comes off this bill.
  const redeemCreditToWallet = async () => {
    const digits = customerPhone.replace(/\D/g, "");
    if (digits.length < 10) {
      toast.error("Enter the customer's phone first");
      return;
    }
    setRedeemingCredit(true);
    try {
      const res = await fetch("/api/pos/credit-notes/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: digits }),
      });
      const d = await res.json();
      if (!res.ok) {
        toast.error(d.error ?? "Failed to redeem credit");
        return;
      }
      if (typeof d.balance === "number") setWalletBalance(d.balance);
      setApplyWallet(true);
      setCustSummary((s) => (s ? { ...s, creditNotes: [], creditNoteTotal: 0 } : s));
      toast.success(`${formatCurrency(d.redeemed)} moved to store credit`);
    } catch {
      toast.error("Network error — please retry.");
    } finally {
      setRedeemingCredit(false);
    }
  };

  // ─── Reprint a past bill by its number (Scan Sales Invoice) ─────────────────
  const scanInvoiceLookup = async (raw: string) => {
    const num = raw.trim();
    if (!num) return;
    try {
      const res = await fetch(`/api/pos/invoice-lookup?num=${encodeURIComponent(num)}`);
      const d = await res.json();
      if (res.ok && d.found) {
        window.open(`/invoice/${d.orderId}?autoprint=1`, "_blank");
        setScanInvoice("");
      } else {
        toast.error("Bill not found");
      }
    } catch {
      toast.error("Lookup failed");
    }
  };

  // ─── Hold bill ──────────────────────────────────────────────────────────────
  // Held bills are parked in the DB (not the browser) so they survive a tab
  // close / refresh and can be resumed from any counter.
  const holdBill = async () => {
    if (cart.length === 0) {
      toast.error("Cart is empty");
      return;
    }
    if (!salesmanId) {
      toast.error("Select a salesman first");
      return;
    }
    const { subtotal, taxAmount, total } = calcCartTotals(cart);
    const salesman = salesmen.find((s) => s.id === salesmanId);
    const billNumber = generateBillNumber();
    const snapshot = buildDraft();
    try {
      const res = await fetch("/api/pos/held", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          billNumber,
          salesmanId,
          salesmanName: salesman?.name ?? "Unknown",
          customerName: customerName || null,
          customerPhone: customerPhone || null,
          subtotal,
          taxAmount,
          total,
          itemCount: cart.reduce((s, i) => s + i.quantity, 0),
          payload: snapshot,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error ?? "Couldn't hold bill");
        return;
      }
      clearCart();
      setBillNotes("");
      setSplitAmounts({ CASH: "", UPI: "", CARD: "", CREDIT: "" });
      toast.success(`Bill ${billNumber} held`);
    } catch {
      toast.error("Network error — couldn't hold bill");
    }
  };

  // ─── Load held bills ────────────────────────────────────────────────────────
  const openHeldModal = async () => {
    setShowHeldModal(true);
    try {
      const res = await fetch("/api/pos/held");
      const d = await res.json();
      setHeldBills(res.ok && Array.isArray(d.bills) ? (d.bills as HeldBill[]) : []);
    } catch {
      setHeldBills([]);
    }
  };

  const retrieveBill = async (bill: HeldBill) => {
    // Restore the whole in-progress bill (customer, discounts, charges, notes),
    // falling back to just line items for any older row without a payload.
    if (bill.payload) applyDraft(bill.payload);
    else {
      setCart(bill.items);
      if (!salesmanId) setSalesmanId(bill.salesmanId);
    }
    setShowHeldModal(false);
    toast.success(`Bill ${bill.billNumber} retrieved`);
    setHeldBills((prev) => prev.filter((b) => b.id !== bill.id));
    try {
      await fetch(`/api/pos/held/${bill.id}`, { method: "DELETE" });
    } catch {
      /* the row is consumed client-side regardless */
    }
  };

  const discardHeldBill = async (id: string) => {
    setHeldBills((prev) => prev.filter((b) => b.id !== id));
    try {
      await fetch(`/api/pos/held/${id}`, { method: "DELETE" });
    } catch {
      /* best-effort */
    }
  };

  // ─── Complete sale ──────────────────────────────────────────────────────────
  // Tapping a payment tile means "charge the remaining balance to THIS method
  // and complete the sale." Amounts pre-typed in the other tiles' boxes are a
  // partial split; this tile soaks up whatever's left. A single tap with empty
  // boxes = full payment by that method.
  const chargeRemaining = async (method: "CASH" | "UPI" | "CARD" | "CREDIT") => {
    if (cart.length === 0) { toast.error("Cart is empty"); return; }
    if (!salesmanId) { toast.error("Select 'Billed by'"); return; }
    const keys = ["CASH", "UPI", "CARD", "CREDIT"] as const;
    const others = keys.filter((k) => k !== method).reduce((s, k) => s + (parseFloat(splitAmounts[k]) || 0), 0);
    const remaining = Math.round((amountDue - others) * 100) / 100;
    if (remaining < -0.01) { toast.error("Split exceeds the amount due"); return; }
    const payments = { cash: 0, upi: 0, card: 0, credit: 0 };
    for (const k of keys) {
      const v = k === method ? Math.max(0, remaining) : parseFloat(splitAmounts[k]) || 0;
      if (k === "CASH") payments.cash = v;
      else if (k === "UPI") payments.upi = v;
      else if (k === "CARD") payments.card = v;
      else payments.credit = v;
    }
    await submitOrder(payments);
  };

  // Re-save an edited bill in place (keeps its original date/time + bill number).
  const updateBill = async (payments: { cash: number; upi: number; card: number; credit: number }) => {
    if (!editOrderId) return;
    setIsProcessing(true);
    try {
      const billValue = parseFloat(billDiscountValue) || 0;
      const items = cart.map((i) => ({
        variantId: i.variantId.startsWith("cash") ? null : i.variantId,
        productId: i.productId,
        quantity: i.quantity,
        unitPrice: i.price,
        name: i.name,
        discountType: i.discountType,
        discountValue: i.discountValue || 0,
        salesmanId: i.salesmanId || null,
      }));
      const res = await fetch(`/api/admin/orders/${editOrderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          billDiscountType,
          billDiscountValue: billValue || undefined,
          customerName: customerName.trim() || undefined,
          customerPhone: customerPhone.trim() || undefined,
          customerEmail: customerEmail.trim() || undefined,
          additionalCharges: chargesAmt || undefined,
          roundOff: roundOff || undefined,
          orderType,
          salesmanId,
          attendedById: attendedById || undefined,
          notes: billNotes.trim() || undefined,
          payments,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        toast.error(d.error ?? "Update failed");
        if (d.insufficient) toast.error("Not enough stock for the new quantities");
        return;
      }
      const updatedId = editOrderId;
      toast.success(`Bill ${editOrderNum} updated`);
      setEditOrderId(null);
      setEditOrderNum("");
      setEditCreatedAt("");
      clearCart();
      setSplitAmounts({ CASH: "", UPI: "", CARD: "", CREDIT: "" });
      setWalletBalance(0);
      setApplyWallet(false);
      loadProducts();
      window.history.replaceState(null, "", "/pos");
      window.open(`/invoice/${updatedId}?autoprint=1`, "_blank");
    } catch {
      toast.error("Network error — please retry");
    } finally {
      setIsProcessing(false);
    }
  };

  const submitOrder = async (payments: { cash: number; upi: number; card: number; credit: number }) => {
    // Editing an existing bill → update in place instead of creating a new one.
    if (editOrderId) {
      await updateBill(payments);
      return;
    }
    // Email is optional at POS — used only for customer identification + loyalty.
    // If one is entered, it must be valid.
    const email = customerEmail.trim().toLowerCase();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("That email doesn't look valid");
      return;
    }
    setIsProcessing(true);
    try {
      const billValue = parseFloat(billDiscountValue) || 0;
      const items = cart.map((i) => ({
        variantId: i.variantId,
        productId: i.productId,
        quantity: i.quantity,
        unitPrice: i.price, // list price; server applies the discount
        name: i.name,
        discountType: i.discountType,
        discountValue: i.discountValue || 0,
        salesmanId: i.salesmanId || null,
      }));
      const res = await fetch("/api/pos/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          salesmanId,
          attendedById: attendedById || undefined,
          items,
          payments,
          customerName: customerName.trim() || undefined,
          customerPhone: customerPhone.trim() || undefined,
          customerEmail: email || undefined,
          billDiscountType: billDiscountType,
          billDiscountValue: billValue || undefined,
          couponCode: couponCode.trim() || undefined,
          additionalCharges: chargesAmt || undefined,
          roundOff: roundOff || undefined,
          orderType,
          walletRedeem: walletApplied || undefined,
          notes: billNotes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Order failed");
        return;
      }
      const salesman = salesmen.find((s) => s.id === salesmanId);
      const billForReceipt = billValue > 0 ? { type: billDiscountType, value: billValue } : undefined;
      const totals = calcCartTotals(cart, billForReceipt);
      // Build a readable payment label: single method name, or a split breakdown.
      const parts: string[] = [];
      if (payments.cash > 0) parts.push(`Cash ${formatCurrency(payments.cash)}`);
      if (payments.upi > 0) parts.push(`UPI ${formatCurrency(payments.upi)}`);
      if (payments.card > 0) parts.push(`Card ${formatCurrency(payments.card)}`);
      if (payments.credit > 0) parts.push(`Credit ${formatCurrency(payments.credit)}`);
      const methodLabel = parts.length === 1 ? parts[0].split(" ")[0].toUpperCase() : parts.join("  ·  ") || "—";
      const printD: PrintData = {
        orderNumber: data.posOrderNum,
        date: new Date().toISOString(),
        salesmanName: salesman?.name ?? "Unknown",
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        items: cart.map((i) => ({
          name: i.name,
          variant: i.variantLabel,
          quantity: i.quantity,
          unitPrice: i.price,
          taxPercent: i.taxPercent,
          total: lineGross(i) - lineDiscount(i),
        })),
        subtotal: data.subtotal ?? totals.subtotal,
        // Server is authoritative — its discount/total include the auto spend tier.
        discount: data.discount ?? totals.totalDiscount,
        taxAmount: data.taxAmount ?? totals.taxAmount,
        total: data.total ?? totals.total,
        paymentMethod: methodLabel,
      };
      setPrintData(printD);
      setLastOrderNum(data.posOrderNum);
      setLastOrderId(data.orderId ?? "");
      setCart([]);
      setBillDiscountValue("");
      setCustomerName("");
      setCustomerPhone("");
      setCustomerEmail("");
      setBillNotes("");
      setAdditionalCharges("");
      setRoundOff(false);
      setCouponCode("");
      setCouponDiscount(0);
      setCouponMsg(null);
      setSplitAmounts({ CASH: "", UPI: "", CARD: "", CREDIT: "" });
      setWalletBalance(0);
      setApplyWallet(false);
      setShowReceipt(true);
      // Refresh the grid so stock reflects the just-committed deductions
      // (sold-out items drop off automatically).
      loadProducts();
      // Print the STANDARD A5 GST bill (same template everywhere) rather than
      // the old inline thermal slip. Opening the invoice with ?autoprint=1 fires
      // the print dialog on load. If the browser blocks the pop-up, the staff
      // can use the "Print A5 bill" button on the success toast.
      if (data.orderId) {
        window.open(`/invoice/${data.orderId}?autoprint=1`, "_blank");
      }
      toast.success("Sale completed!");
    } catch {
      toast.error("Network error — please retry");
    } finally {
      setIsProcessing(false);
    }
  };

  // The bill discount value is passed through as-is; calcCartTotals applies it
  // per line and caps each at that item's own max-discount (so an uncapped item
  // keeps the full %, a capped one only up to its cap).
  const billArg: BillDiscount | undefined =
    parseFloat(billDiscountValue) > 0
      ? { type: billDiscountType, value: parseFloat(billDiscountValue) }
      : undefined;
  const { subtotal, totalDiscount: manualDiscount, total: baseTotal } = calcCartTotals(cart, billArg);

  // Per-line and bill-level discounts are mutually exclusive. Once any single
  // line carries a manual discount, the overall bill discount is disabled (the
  // cashier must then discount each product individually), and vice-versa.
  const hasLineDiscount = cart.some((i) => (i.discountValue || 0) > 0);
  const hasBillDiscount = parseFloat(billDiscountValue) > 0;

  // Best automatic spend tier for this cart — qualified on each line's NET
  // (post line-discount) value, so it stacks cleanly with manual discounts.
  const autoLines: DiscountLine[] = cart.map((i) => {
    const gross = i.price * i.quantity;
    const dAmt =
      i.discountValue > 0
        ? Math.min(gross, i.discountType === "FIXED" ? i.discountValue : (gross * i.discountValue) / 100)
        : 0;
    const netUnit = i.quantity > 0 ? (gross - dAmt) / i.quantity : 0;
    return {
      productId: i.productId,
      categoryId: "",
      unitPrice: netUnit,
      quantity: i.quantity,
      // Honour the item's max-discount cap for auto spend-tier coupons too.
      productMaxDiscountPct: i.maxDiscountPct,
      categoryMaxDiscountPct: null,
    };
  });
  // Manual discounting takes over: if the cashier set any per-line discount (or
  // a bill-level discount), the automatic spend-tier offer is suppressed and
  // they discount by hand.
  const hasManualDiscount =
    cart.some((i) => i.discountValue > 0) || (parseFloat(billDiscountValue) || 0) > 0;
  const autoTier = cart.length && !hasManualDiscount ? bestAutoTier(autoCoupons, autoLines) : null;
  const autoDiscount = autoTier?.result.discountTotal ?? 0;

  // Promo = the better of the auto spend tier and an entered coupon (the server
  // applies the same rule). Both are suppressed when a manual discount is set.
  const promoDiscount = hasManualDiscount ? 0 : Math.max(autoDiscount, couponDiscount);
  const promoLabel =
    promoDiscount <= 0
      ? null
      : couponDiscount > autoDiscount
      ? `Coupon${couponCode ? ` (${couponCode.toUpperCase()})` : ""}`
      : `Spend offer${autoTier ? ` (${autoTier.coupon.code})` : ""}`;
  // Ad-hoc adjustment: positive adds a charge, negative deducts (e.g. round a
  // ₹10,105 bill down to ₹10,000 → enter −105). Bill can't drop below zero.
  const chargesAmt = parseFloat(additionalCharges) || 0;
  const preRound = Math.max(0, Math.max(0, baseTotal - promoDiscount) + chargesAmt);
  // Round-off snaps to the nearest rupee; the signed delta is shown + stored.
  const roundOffAmt = roundOff ? Math.round(preRound) - preRound : 0;
  const total = Math.round((preRound + roundOffAmt) * 100) / 100;
  // Store credit applied to this bill — capped at the bill total and balance.
  const walletApplied = applyWallet ? Math.min(walletBalance, total) : 0;
  const amountDue = Math.max(0, total - walletApplied);
  // Split-tender running totals.
  const splitEntered =
    (parseFloat(splitAmounts.CASH) || 0) +
    (parseFloat(splitAmounts.UPI) || 0) +
    (parseFloat(splitAmounts.CARD) || 0) +
    (parseFloat(splitAmounts.CREDIT) || 0);
  const splitRemaining = Math.round((amountDue - splitEntered) * 100) / 100;
  const salesmanName = salesmen.find((s) => s.id === salesmanId)?.name ?? "";

  // ─── Keyboard shortcuts (Vasy-style F-keys) ─────────────────────────────────
  // A ref always holds the latest handlers so the once-mounted listener never
  // fires a stale closure (amount due / cart change every render).
  const shortcutsRef = useRef({ cash: () => {}, card: () => {}, upi: () => {}, hold: () => {} });
  shortcutsRef.current = {
    cash: () => chargeRemaining("CASH"),
    card: () => chargeRemaining("CARD"),
    upi: () => chargeRemaining("UPI"),
    hold: () => holdBill(),
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const map: Record<string, "cash" | "card" | "upi" | "hold"> = { F4: "cash", F3: "card", F5: "upi", F6: "hold" };
      const action = map[e.key];
      if (!action) return;
      e.preventDefault();
      shortcutsRef.current[action]();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

        @media print {
          body * { visibility: hidden; }
          #pos-receipt, #pos-receipt * { visibility: visible; }
          #pos-receipt {
            position: fixed;
            left: 0;
            top: 0;
            width: 203px;
            font-family: 'Courier New', monospace !important;
          }
          @page { size: 80mm auto; margin: 0; }
        }

        .product-card {
          transition: all 0.15s ease;
        }
        .product-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        .product-card:active {
          transform: translateY(0);
        }
        .cart-row:hover { background: rgba(0,0,0,0.03); }
        .pos-btn:active { transform: scale(0.97); }
        .pos-btn { transition: all 0.1s ease; }
        .topbar-btn:hover { background: rgba(255,255,255,0.1); }
        .scrollbar-thin::-webkit-scrollbar { width: 4px; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: #555; border-radius: 2px; }
        .modal-overlay {
          backdrop-filter: blur(2px);
        }
      `}</style>

      <Toaster
        position="top-center"
        toastOptions={{
          duration: 2500,
          style: {
            background: "#1F2E22",
            color: "#F4F1E8",
            fontFamily: "Inter, sans-serif",
            fontSize: "13px",
            border: "1px solid #4F4A39",
          },
        }}
      />

      {/* Hidden barcode input */}
      <input
        ref={barcodeRef}
        type="text"
        autoFocus
        className="sr-only"
        onChange={handleBarcodeScan}
        onKeyDown={(e) => {
          if (e.key === "Escape") barcodeRef.current?.blur();
        }}
        tabIndex={-1}
        aria-label="Barcode scanner input"
      />

      {/* Hidden receipt for print */}
      {printData && (
        <div style={{ display: showReceipt ? "block" : "none", position: "fixed", left: -9999, top: 0 }}>
          <Receipt printData={printData} salesmanName={salesmanName} />
        </div>
      )}

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100vh",
          background: "#F4F1E8",
          fontFamily: "Inter, sans-serif",
          overflow: "hidden",
        }}
      >
        {/* ─── Navigation drawer (opened from the SS logo) — mirrors the admin
              dashboard sidebar; every link opens in a NEW TAB so the POS stays
              open behind it. ─────────────────────────────────────────────── */}
        {navOpen && (
          <div
            onClick={() => setNavOpen(false)}
            className="fixed inset-0 z-[200]"
            style={{ background: "rgba(0,0,0,0.45)" }}
          >
            <aside
              onClick={(e) => e.stopPropagation()}
              className="absolute top-0 left-0 bottom-0 w-64 bg-nate-grey-800 text-white flex flex-col shadow-2xl"
            >
              {/* Logo */}
              <div className="p-6 border-b border-nate-grey-700 flex items-start justify-between">
                <div>
                  <span className="text-xl font-serif">Farmyzest</span>
                  <p className="text-xs text-nate-grey-400 mt-1">Admin Panel</p>
                </div>
                <button type="button" onClick={() => setNavOpen(false)} aria-label="Close menu" className="text-nate-grey-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Nav — identical items to the dashboard, opened in new tabs */}
              <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                {adminNavItems.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors text-nate-grey-400 hover:bg-white/10 hover:text-white"
                  >
                    <item.icon className="w-4 h-4 flex-shrink-0" />
                    {item.label}
                  </a>
                ))}
              </nav>

              {/* Footer */}
              <div className="p-4 border-t border-nate-grey-700">
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: "/auth/login" })}
                  className="flex w-full items-center gap-3 px-3 py-2 rounded-lg text-sm text-nate-grey-400 hover:bg-white/10 hover:text-white transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </button>
              </div>
            </aside>
          </div>
        )}

        {/* ─── Top Bar ─────────────────────────────────────────────────────── */}
        <div
          style={{
            background: "#1F2E22",
            color: "#F4F1E8",
            display: "flex",
            alignItems: "center",
            padding: "0 20px",
            height: 56,
            gap: 16,
            flexShrink: 0,
            borderBottom: "1px solid #4F4A39",
            zIndex: 10,
          }}
        >
          {/* Logo — click the SS mark to open the navigation drawer */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              onClick={() => setNavOpen(true)}
              title="Menu"
              aria-label="Open menu"
              className="pos-btn"
              style={{
                width: 32,
                height: 32,
                background: "#F4F1E8",
                borderRadius: 4,
                border: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <span style={{ color: "#1F2E22", fontWeight: 700, fontSize: 14 }}>SS</span>
            </button>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: "-0.3px" }}>
                Farmyzest
              </div>
              <div style={{ fontSize: 10, color: "#A89F86" }}>Point of Sale</div>
            </div>
          </div>

          {/* Separator */}
          <div style={{ width: 1, height: 32, background: "#4F4A39", margin: "0 4px" }} />

          {/* Billed by + Attended by */}
          {(() => {
            const selCls: React.CSSProperties = {
              background: "#2F3A2B",
              color: "#F4F1E8",
              border: "1px solid #4F4A39",
              borderRadius: 6,
              padding: "5px 10px",
              fontSize: 13,
              fontFamily: "Inter, sans-serif",
              cursor: "pointer",
              outline: "none",
              minWidth: 140,
            };
            return (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <User size={14} color="#A89F86" />
                  <span style={{ fontSize: 10, color: "#A89F86" }}>Billed</span>
                  <select value={salesmanId} onChange={(e) => setSalesmanId(e.target.value)} style={selCls}>
                    <option value="">Billed by…</option>
                    {salesmen.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 10, color: "#A89F86" }}>Attended</span>
                  <select value={attendedById} onChange={(e) => setAttendedById(e.target.value)} style={selCls}>
                    <option value="">Attended by…</option>
                    {salesmen.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </>
            );
          })()}

          {/* Order type — Walk-in vs Delivery */}
          <div style={{ display: "flex", border: "1px solid #4F4A39", borderRadius: 6, overflow: "hidden" }}>
            {(["WALK_IN", "DELIVERY"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setOrderType(t)}
                className="pos-btn"
                style={{
                  background: orderType === t ? "#F4F1E8" : "transparent",
                  color: orderType === t ? "#1F2E22" : "#A89F86",
                  border: "none",
                  padding: "6px 12px",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                {t === "WALK_IN" ? "Walk-in" : "Delivery"}
              </button>
            ))}
          </div>

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Held bills button */}
          <button
            onClick={openHeldModal}
            className="topbar-btn pos-btn"
            style={{
              background: "transparent",
              border: "1px solid #4F4A39",
              borderRadius: 6,
              color: "#F4F1E8",
              padding: "5px 12px",
              fontSize: 12,
              display: "flex",
              alignItems: "center",
              gap: 5,
              cursor: "pointer",
              fontFamily: "Inter, sans-serif",
            }}
          >
            <Pause size={13} />
            Held
          </button>

          {/* Time */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              minWidth: 120,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.3px" }}>
              {currentTime.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </div>
            <div style={{ fontSize: 10, color: "#A89F86" }}>
              {currentTime.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
            </div>
          </div>
        </div>

        {/* ─── Body + right sidebar ─────────────────────────────────────────── */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* Left: bill workspace */}
        <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>

          {/* ── Top: scan / search strip (product browse grid removed) ─────── */}
          <div
            style={{
              flexShrink: 0,
              display: "flex",
              flexDirection: "column",
              background: "#fff",
            }}
          >
            {/* Search bar */}
            <div
              style={{
                padding: "12px 16px",
                background: "#fff",
                borderBottom: "1px solid #E7E1D0",
                display: "flex",
                gap: 10,
                alignItems: "center",
                flexShrink: 0,
              }}
            >
              <div style={{ position: "relative", flex: 1 }}>
                <Search
                  size={15}
                  color="#7C735C"
                  style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }}
                />
                <input
                  ref={searchRef}
                  type="text"
                  placeholder="Search, or type a variant code + Enter…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    const code = search.trim();
                    if (!code) return;
                    const codeUpper = code.toUpperCase();

                    // A barcode/SKU maps to exactly ONE variant, so a scan must
                    // add that variant directly and NEVER open the variant
                    // picker. Check for an exact code match first (a scan lands
                    // its text here because the search box holds focus). We scan
                    // the live results AND the base product cache so a fast scan
                    // resolves even if the search fetch hasn't landed yet. Only
                    // if the text isn't an exact code do we treat it as a name
                    // search and fall through to the top-result behaviour.
                    for (const pool of [visibleProducts, products]) {
                      let matched = false;
                      for (const product of pool) {
                        const exact = product.variants.find(
                          (v) => v.barcode?.toUpperCase() === codeUpper || v.sku?.toUpperCase() === codeUpper
                        );
                        if (exact) {
                          if (exact.stock <= 0) {
                            toast.error(`${product.name} is out of stock`);
                            speakOutOfStock();
                          } else {
                            addVariantToCart(product, exact);
                            toast.success(`Added: ${product.name} ${getVariantLabel(exact)}`);
                          }
                          setSearch("");
                          matched = true;
                          break;
                        }
                      }
                      if (matched) return;
                    }

                    // No exact code match → name / number search. Enter adds the
                    // TOP result, opening the picker when it has >1 variants to
                    // choose from (a genuine "which size?" case, not a scan).
                    const top = visibleProducts[0];
                    if (top) {
                      const variant = top.variants.find((v) => v.stock > 0) ?? top.variants[0];
                      if (variant) {
                        if (top.variants.length > 1) setPickerProduct(top);
                        else addVariantToCart(top, variant);
                        setSearch("");
                        return;
                      }
                    }
                    // Nothing listed — treat the text as a barcode / SKU (server
                    // lookup covers codes not in the local search cache).
                    const added = await addByCode(code);
                    if (added) setSearch(""); // clear on a successful add
                  }}
                  style={{
                    width: "100%",
                    padding: "8px 12px 8px 34px",
                    border: "1px solid #E7E1D0",
                    borderRadius: 8,
                    fontSize: 13,
                    fontFamily: "Inter, sans-serif",
                    outline: "none",
                    background: "#F4F1E8",
                    color: "#2F3A2B",
                  }}
                />
                {isSearching && (
                  <div
                    style={{
                      position: "absolute",
                      right: 10,
                      top: "50%",
                      transform: "translateY(-50%)",
                      width: 14,
                      height: 14,
                      border: "2px solid #A89F86",
                      borderTopColor: "#2F3A2B",
                      borderRadius: "50%",
                      animation: "spin 0.6s linear infinite",
                    }}
                  />
                )}
                {/* Search-results dropdown — replaces the removed browse grid so
                    name search still works (click to add; scan/code+Enter as before). */}
                {search.trim() && visibleProducts.length > 0 && (
                  <div
                    className="scrollbar-thin"
                    style={{
                      position: "absolute",
                      top: "calc(100% + 4px)",
                      left: 0,
                      right: 0,
                      zIndex: 60,
                      background: "#fff",
                      border: "1px solid #E7E1D0",
                      borderRadius: 8,
                      boxShadow: "0 10px 28px rgba(0,0,0,0.14)",
                      maxHeight: 340,
                      overflowY: "auto",
                    }}
                  >
                    {visibleProducts.slice(0, 15).map((product) => {
                      const variant = product.variants.find((v) => v.stock > 0) ?? product.variants[0];
                      if (!variant) return null;
                      const multiVariant = product.variants.length > 1;
                      const avail = availableStock(variant);
                      return (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() => {
                            if (multiVariant) setPickerProduct(product);
                            else addVariantToCart(product, variant);
                            setSearch("");
                          }}
                          className="pos-btn"
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            width: "100%",
                            textAlign: "left",
                            padding: "8px 12px",
                            border: "none",
                            borderBottom: "1px solid #F1EDE1",
                            background: "#fff",
                            cursor: "pointer",
                            fontFamily: "Inter, sans-serif",
                          }}
                        >
                          {/* Thumbnail */}
                          <span
                            style={{
                              width: 38,
                              height: 38,
                              flexShrink: 0,
                              borderRadius: 6,
                              overflow: "hidden",
                              background: "#F4F1E8",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            {getVariantImage(variant) ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={getVariantImage(variant)}
                                alt=""
                                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                              />
                            ) : (
                              <Package size={16} color="#D3CAB2" />
                            )}
                          </span>
                          <span style={{ minWidth: 0, flex: 1 }}>
                            <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#2F3A2B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {product.name}
                            </span>
                            <span style={{ display: "block", fontSize: 11, color: "#7C735C" }}>
                              {multiVariant ? `${product.variants.length} variants` : getVariantLabel(variant)} · {avail} left
                            </span>
                          </span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#2F3A2B", whiteSpace: "nowrap" }}>
                            {formatCurrency(getVariantPrice(variant))}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              {/* Cash item shortcut */}
              <button
                onClick={() => setShowCashItemModal(true)}
                className="pos-btn"
                style={{
                  background: "#2F3A2B",
                  color: "#F4F1E8",
                  border: "none",
                  borderRadius: 8,
                  padding: "8px 14px",
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: "Inter, sans-serif",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  whiteSpace: "nowrap",
                }}
              >
                <Banknote size={14} />
                Cash Item
              </button>
              {/* Scan a past bill number to reprint it */}
              <input
                value={scanInvoice}
                onChange={(e) => setScanInvoice(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") scanInvoiceLookup(scanInvoice);
                }}
                placeholder="Scan Sales Invoice"
                title="Type/scan a bill number + Enter to reprint it"
                style={{
                  width: 170,
                  padding: "9px 12px",
                  border: "1px solid #E7E1D0",
                  borderRadius: 8,
                  outline: "none",
                  fontSize: 13,
                  fontFamily: "Inter, sans-serif",
                  flexShrink: 0,
                }}
              />
            </div>


            {/* Barcode scan hint */}
            <div
              style={{
                padding: "8px 16px",
                background: "#2F3A2B",
                color: "#A89F86",
                fontSize: 11,
                textAlign: "center",
                borderTop: "1px solid #4F4A39",
                flexShrink: 0,
              }}
            >
              Click the barcode input (focus) then scan — or type a barcode and press Enter
              <button
                onClick={() => barcodeRef.current?.focus()}
                style={{
                  marginLeft: 12,
                  background: "#4F4A39",
                  color: "#F4F1E8",
                  border: "none",
                  borderRadius: 4,
                  padding: "2px 8px",
                  fontSize: 10,
                  cursor: "pointer",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                Focus scanner
              </button>
            </div>
          </div>

          {/* ── Cart (now full width — product grid removed) ───────────────── */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              background: "#fff",
              overflow: "hidden",
            }}
          >
            {/* Cart header */}
            <div
              style={{
                padding: "12px 16px",
                borderBottom: "1px solid #E7E1D0",
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexShrink: 0,
                background: "#fff",
              }}
            >
              <ShoppingCart size={16} color="#2F3A2B" />
              <span style={{ fontWeight: 700, fontSize: 14, color: "#2F3A2B" }}>
                Current Sale
              </span>
              <span
                style={{
                  background: "#1F2E22",
                  color: "#F4F1E8",
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "1px 7px",
                  borderRadius: 10,
                  marginLeft: 4,
                }}
              >
                {cart.reduce((s, i) => s + i.quantity, 0)}
              </span>
              <div style={{ flex: 1 }} />
              {cart.length > 0 && (
                <button
                  onClick={clearCart}
                  className="pos-btn"
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#7C735C",
                    fontSize: 11,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  <RotateCcw size={11} />
                  Clear
                </button>
              )}
            </div>

            {/* Cart items */}
            <div
              className="scrollbar-thin"
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "8px 0",
              }}
            >
              {cart.length === 0 ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100%",
                    color: "#D3CAB2",
                    gap: 10,
                  }}
                >
                  <ShoppingCart size={36} />
                  <p style={{ margin: 0, fontSize: 13, color: "#A89F86" }}>
                    No items in cart
                  </p>
                  <p style={{ margin: 0, fontSize: 11, color: "#D3CAB2" }}>
                    Search products or scan barcode
                  </p>
                </div>
              ) : (
                cart.map((item, idx) => (
                  <div
                    key={item.variantId}
                    className="cart-row"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      padding: "8px 16px",
                      gap: 10,
                      borderBottom: "1px solid #F4F1E8",
                    }}
                  >
                    {/* Serial number */}
                    <div
                      style={{
                        width: 22,
                        flexShrink: 0,
                        textAlign: "center",
                        fontSize: 13,
                        fontWeight: 700,
                        color: "#7C735C",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {idx + 1}
                    </div>

                    {/* Image */}
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 6,
                        background: "#F4F1E8",
                        flexShrink: 0,
                        overflow: "hidden",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {item.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <Package size={16} color="#D3CAB2" />
                      )}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: "#2F3A2B",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {item.name}
                      </div>
                      <div style={{ fontSize: 10, color: "#7C735C", marginTop: 1 }}>
                        {item.variantLabel}
                      </div>
                      {(item.sku || item.barcode) && (
                        <div style={{ fontSize: 10, color: "#A89F86", marginTop: 1, fontFamily: "monospace" }}>
                          {item.sku || item.barcode}
                        </div>
                      )}
                      <div style={{ fontSize: 11, color: "#4F4A39", marginTop: 1 }}>
                        {formatCurrency(item.price)} × {item.quantity}
                      </div>
                      {/* Per-line discount: value + %/₹ toggle. Disabled while a
                          bill-level discount is set (mutually exclusive). */}
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, opacity: hasBillDiscount ? 0.45 : 1 }}>
                        <span style={{ fontSize: 11, color: "#A89F86", fontWeight: 600 }}>Disc</span>
                        <input
                          type="text" inputMode="decimal"
                          min="0"
                          step="any"
                          disabled={hasBillDiscount}
                          value={item.discountValue || ""}
                          onChange={(e) =>
                            setLineDiscount(item.variantId, {
                              discountValue: parseFloat(e.target.value) || 0,
                            })
                          }
                          placeholder="0"
                          title={hasBillDiscount ? "Remove the bill discount to discount items individually" : undefined}
                          style={{
                            width: 70,
                            fontSize: 14,
                            padding: "6px 9px",
                            border: "1px solid #D3CAB2",
                            borderRadius: 6,
                            outline: "none",
                            color: "#2F3A2B",
                            cursor: hasBillDiscount ? "not-allowed" : "text",
                            background: hasBillDiscount ? "#F1EDE1" : "#fff",
                          }}
                        />
                        <div style={{ display: "flex", border: "1px solid #D3CAB2", borderRadius: 6, overflow: "hidden" }}>
                          {(["PERCENT", "FIXED"] as DiscountType[]).map((t) => (
                            <button
                              key={t}
                              onClick={() => setLineDiscount(item.variantId, { discountType: t })}
                              disabled={hasBillDiscount}
                              className="pos-btn"
                              style={{
                                fontSize: 15,
                                fontWeight: 600,
                                padding: "6px 13px",
                                border: "none",
                                cursor: hasBillDiscount ? "not-allowed" : "pointer",
                                background: item.discountType === t ? "#2F3A2B" : "#fff",
                                color: item.discountType === t ? "#fff" : "#7C735C",
                                fontFamily: "Inter, sans-serif",
                              }}
                            >
                              {t === "PERCENT" ? "%" : "₹"}
                            </button>
                          ))}
                        </div>
                        {item.maxDiscountPct != null && (
                          <span
                            style={{ fontSize: 10, color: "#A89F86", fontWeight: 600, whiteSpace: "nowrap" }}
                            title="Maximum discount allowed on this item"
                          >
                            max {item.maxDiscountPct}%
                          </span>
                        )}
                      </div>
                      {/* Per-line (article-wise) salesman. Blank = the bill
                          salesman gets this line's commission. Picking someone
                          moves this article's commission to them instead. */}
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
                        <span style={{ fontSize: 11, color: "#A89F86", fontWeight: 600 }}>Sales</span>
                        <select
                          value={item.salesmanId ?? ""}
                          onChange={(e) => setLineSalesman(item.variantId, e.target.value)}
                          title="Article-wise salesman (optional) — overrides the bill salesman for this item's commission"
                          style={{
                            fontSize: 12,
                            padding: "5px 8px",
                            border: "1px solid #D3CAB2",
                            borderRadius: 6,
                            outline: "none",
                            color: item.salesmanId ? "#2F3A2B" : "#A89F86",
                            background: item.salesmanId ? "#FFF7ED" : "#fff",
                            maxWidth: 150,
                          }}
                        >
                          <option value="">Bill salesman</option>
                          {salesmen.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Line total (net of line discount) */}
                    <div
                      style={{
                        minWidth: 70,
                        textAlign: "right",
                        flexShrink: 0,
                      }}
                    >
                      {lineDiscount(item) > 0 && (
                        <div style={{ fontSize: 10, color: "#A89F86", textDecoration: "line-through" }}>
                          {formatCurrency(lineGross(item))}
                        </div>
                      )}
                      <div style={{ fontSize: 13, fontWeight: 700, color: lineDiscount(item) > 0 ? "#15803D" : "#2F3A2B" }}>
                        {formatCurrency(lineGross(item) - lineDiscount(item))}
                      </div>
                    </div>

                    {/* Quantity controls */}
                    <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                      <button
                        onClick={() => updateQty(item.variantId, -1)}
                        className="pos-btn"
                        style={{
                          width: 26,
                          height: 26,
                          border: "1px solid #E7E1D0",
                          borderRadius: 5,
                          background: "#F4F1E8",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          padding: 0,
                        }}
                      >
                        <Minus size={12} color="#4F4A39" />
                      </button>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          minWidth: 22,
                          textAlign: "center",
                          color: "#2F3A2B",
                        }}
                      >
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQty(item.variantId, 1)}
                        className="pos-btn"
                        style={{
                          width: 26,
                          height: 26,
                          border: "1px solid #E7E1D0",
                          borderRadius: 5,
                          background: "#F4F1E8",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          padding: 0,
                        }}
                      >
                        <Plus size={12} color="#4F4A39" />
                      </button>
                      <button
                        onClick={() => removeItem(item.variantId)}
                        className="pos-btn"
                        style={{
                          width: 26,
                          height: 26,
                          border: "none",
                          borderRadius: 5,
                          background: "#FEE2E2",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          padding: 0,
                          marginLeft: 2,
                        }}
                      >
                        <Trash2 size={11} color="#DC2626" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Split-tender balance hint (only once a partial amount is typed) */}
            {splitEntered > 0.01 && (
              <div
                style={{
                  padding: "8px 16px 0",
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 11,
                  fontWeight: 600,
                  color: splitRemaining < -0.01 ? "#C0392B" : "#7C735C",
                  flexShrink: 0,
                }}
              >
                <span>Allocated {formatCurrency(splitEntered)}</span>
                <span>
                  {splitRemaining > 0.01
                    ? `Balance ${formatCurrency(splitRemaining)} — tap a method to charge the rest`
                    : splitRemaining < -0.01
                    ? `Over by ${formatCurrency(-splitRemaining)}`
                    : "Fully allocated — tap any method to complete"}
                </span>
              </div>
            )}

            {/* Payment tiles — type an amount above a method to split, or just
                tap a method to charge the whole remaining balance to it. */}
            <div
              style={{
                padding: "10px 16px",
                borderTop: "1px solid #E7E1D0",
                display: "flex",
                gap: 8,
                flexShrink: 0,
                alignItems: "flex-end",
              }}
            >
              {([
                { key: "CASH", label: "CASH (F4)", Icon: Banknote },
                { key: "UPI", label: "UPI (F5)", Icon: Smartphone },
                { key: "CARD", label: "CARD (F3)", Icon: CreditCard },
                { key: "CREDIT", label: "CREDIT", Icon: Clock },
              ] as const).map(({ key, label, Icon }) => (
                <div key={key} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={splitAmounts[key]}
                    onChange={(e) => setSplitAmounts((p) => ({ ...p, [key]: e.target.value }))}
                    placeholder="Amount"
                    style={{
                      width: "100%",
                      textAlign: "center",
                      padding: "5px 2px",
                      fontSize: 12,
                      border: "1px solid #E7E1D0",
                      borderRadius: 6,
                      outline: "none",
                      fontFamily: "Inter, sans-serif",
                      boxSizing: "border-box",
                    }}
                  />
                  <button
                    onClick={() => chargeRemaining(key)}
                    disabled={cart.length === 0 || isProcessing}
                    className="pos-btn"
                    style={{
                      padding: "8px 6px",
                      borderRadius: 8,
                      border: "2px solid #E7E1D0",
                      background: "#fff",
                      color: "#2F3A2B",
                      fontWeight: 600,
                      fontSize: 11,
                      cursor: cart.length === 0 || isProcessing ? "not-allowed" : "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 3,
                      fontFamily: "Inter, sans-serif",
                    }}
                  >
                    <Icon size={16} />
                    {label}
                  </button>
                </div>
              ))}

              {/* Hold */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ height: 28 }} />
                <button
                  onClick={holdBill}
                  disabled={cart.length === 0}
                  className="pos-btn"
                  style={{
                    padding: "8px 6px",
                    borderRadius: 8,
                    border: "2px solid #E7E1D0",
                    background: "#fff",
                    color: cart.length === 0 ? "#D3CAB2" : "#2F3A2B",
                    fontWeight: 600,
                    fontSize: 11,
                    cursor: cart.length === 0 ? "not-allowed" : "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 3,
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  <Pause size={16} />
                  HOLD (F6)
                </button>
              </div>

              {/* Exchange — phone-based lookup, independent of the cart */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ height: 28 }} />
                <button
                  onClick={() => setShowExchange(true)}
                  className="pos-btn"
                  style={{
                    padding: "8px 6px",
                    borderRadius: 8,
                    border: "2px solid #E7E1D0",
                    background: "#fff",
                    color: "#2F3A2B",
                    fontWeight: 600,
                    fontSize: 11,
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 3,
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  <RotateCcw size={16} />
                  EXCHANGE
                </button>
              </div>
            </div>

            {/* Editing banner */}
            {editOrderId && (
              <div style={{ margin: "0 16px 8px", padding: "8px 12px", borderRadius: 8, background: "#FEF3C7", border: "1px solid #FCD34D", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexShrink: 0 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#92400E" }}>
                  Editing bill {editOrderNum}
                  {editCreatedAt ? ` · ${formatDate(editCreatedAt)}` : ""}
                  <span style={{ fontWeight: 400 }}> — date/time kept</span>
                </span>
                <button
                  onClick={() => { setEditOrderId(null); setEditOrderNum(""); setEditCreatedAt(""); clearCart(); setSplitAmounts({ CASH: "", UPI: "", CARD: "", CREDIT: "" }); window.history.replaceState(null, "", "/pos"); }}
                  className="pos-btn"
                  style={{ border: "none", background: "transparent", color: "#92400E", fontSize: 11, fontWeight: 600, cursor: "pointer", textDecoration: "underline" }}
                >
                  Cancel edit
                </button>
              </div>
            )}

            {/* Complete Sale */}
            <div style={{ padding: "0 16px 14px", flexShrink: 0 }}>
              <button
                onClick={() => chargeRemaining("CASH")}
                disabled={cart.length === 0 || isProcessing}
                className="pos-btn"
                style={{
                  width: "100%",
                  padding: "13px",
                  borderRadius: 10,
                  border: "none",
                  background:
                    cart.length === 0 ? "#D3CAB2" : isProcessing ? "#A89F86" : "#14231A",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 15,
                  cursor: cart.length === 0 || isProcessing ? "not-allowed" : "pointer",
                  fontFamily: "Inter, sans-serif",
                  letterSpacing: "0.3px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  transition: "all 0.15s ease",
                }}
              >
                {isProcessing ? (
                  <>
                    <div
                      style={{
                        width: 16,
                        height: 16,
                        border: "2px solid rgba(255,255,255,0.4)",
                        borderTopColor: "#fff",
                        borderRadius: "50%",
                        animation: "spin 0.7s linear infinite",
                      }}
                    />
                    Processing…
                  </>
                ) : (
                  <>
                    <Printer size={16} />
                    {editOrderId ? "Update Bill" : "Complete Sale"} — {formatCurrency(total)}
                  </>
                )}
              </button>
              {lastOrderNum && (
                <p
                  style={{
                    textAlign: "center",
                    fontSize: 10,
                    color: "#A89F86",
                    margin: "6px 0 0",
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  Last order: <strong style={{ color: "#4F4A39" }}>{lastOrderNum}</strong>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right: customer + totals + actions ─────────────────────────────── */}
        <div
          className="scrollbar-thin"
          style={{
            width: 340,
            flexShrink: 0,
            background: "#fff",
            borderLeft: "1px solid #E7E1D0",
            display: "flex",
            flexDirection: "column",
            overflowY: "auto",
          }}
        >
          {/* Customer — typeahead + editable fields */}
          <div style={{ padding: 12, borderBottom: "1px solid #E7E1D0" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#2F3A2B", marginBottom: 8 }}>Customer</div>
            {/* Find customer (name / phone / email) */}
            <div style={{ position: "relative", marginBottom: 6 }}>
              <Search size={13} color="#A89F86" style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)" }} />
              <input
                value={custQuery}
                onChange={(e) => { setCustQuery(e.target.value); setShowSuggest(true); setCustHighlight(-1); }}
                onFocus={() => setShowSuggest(true)}
                onBlur={() => setTimeout(() => setShowSuggest(false), 150)}
                onKeyDown={(e) => {
                  if (custQuery.trim().length < 2) return;
                  // Rows: 0..custSuggest.length-1 = matches, custSuggest.length = "Create new".
                  const lastIdx = custSuggest.length; // the create-new row
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setShowSuggest(true);
                    setCustHighlight((h) => Math.min(lastIdx, h + 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setCustHighlight((h) => Math.max(-1, h - 1));
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    // Highlighted create-row, or highlighted match, or (no highlight) the top match.
                    if (custHighlight === lastIdx) createCustomer();
                    else if (custHighlight >= 0 && custSuggest[custHighlight]) selectCustomer(custSuggest[custHighlight]);
                    else if (custSuggest[0]) selectCustomer(custSuggest[0]);
                    else createCustomer();
                  } else if (e.key === "Escape") {
                    setShowSuggest(false);
                  }
                }}
                placeholder="Find by name, phone or email"
                style={{ width: "100%", fontSize: 12, padding: "8px 8px 8px 26px", border: "1px solid #D3CAB2", borderRadius: 6, outline: "none", color: "#2F3A2B" }}
              />
              {showSuggest && custQuery.trim().length >= 2 && (
                <div className="scrollbar-thin" style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 2, background: "#fff", border: "1px solid #D3CAB2", borderRadius: 6, boxShadow: "0 6px 18px rgba(0,0,0,0.12)", zIndex: 30, maxHeight: 220, overflowY: "auto" }}>
                  {custSuggest.map((c, i) => (
                    <button
                      key={i}
                      onMouseDown={(e) => { e.preventDefault(); selectCustomer(c); }}
                      onMouseEnter={() => setCustHighlight(i)}
                      style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 10px", border: "none", borderBottom: "1px solid #F1EDE1", background: custHighlight === i ? "#EDEBE7" : "#fff", cursor: "pointer", fontFamily: "Inter, sans-serif" }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#2F3A2B" }}>{c.name || c.phone || c.email}</div>
                      <div style={{ fontSize: 10, color: "#A89F86" }}>{[c.phone, c.email].filter(Boolean).join(" · ")}</div>
                    </button>
                  ))}
                  {/* No match → create the customer directly. */}
                  <button
                    onMouseDown={(e) => { e.preventDefault(); createCustomer(); }}
                    onMouseEnter={() => setCustHighlight(custSuggest.length)}
                    style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", textAlign: "left", padding: "9px 10px", border: "none", background: custHighlight === custSuggest.length ? "#EAE7E2" : "#F4F2EF", cursor: "pointer", fontFamily: "Inter, sans-serif" }}
                  >
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#2F3A2B" }}>＋</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#2F3A2B" }}>
                      Create new customer{custSuggest.length === 0 ? ` “${custQuery.trim()}”` : ""}
                    </span>
                  </button>
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
              <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Name" style={{ flex: 1, fontSize: 12, padding: "7px 8px", border: "1px solid #E7E1D0", borderRadius: 5, outline: "none", color: "#2F3A2B" }} />
              <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="Phone" inputMode="tel" style={{ flex: 1, fontSize: 12, padding: "7px 8px", border: "1px solid #E7E1D0", borderRadius: 5, outline: "none", color: "#2F3A2B" }} />
            </div>
            <input
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              onBlur={async () => {
                const em = customerEmail.trim().toLowerCase();
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return;
                try {
                  const res = await fetch(`/api/customer/lookup?email=${encodeURIComponent(em)}`);
                  const d = await res.json();
                  if (d.found) {
                    if (d.name) setCustomerName((prev) => (prev.trim() ? prev : d.name));
                    if (d.phone) setCustomerPhone((prev) => (prev.trim() ? prev : d.phone));
                  }
                } catch { /* best-effort */ }
              }}
              placeholder="Email (optional)"
              inputMode="email"
              type="email"
              style={{ width: "100%", fontSize: 12, padding: "7px 8px", border: "1px solid #E7E1D0", borderRadius: 5, outline: "none", color: "#2F3A2B", marginBottom: 6 }}
            />
            <textarea
              value={billNotes}
              onChange={(e) => setBillNotes(e.target.value)}
              placeholder="Internal remark (staff only — not printed)"
              rows={2}
              maxLength={2000}
              style={{ width: "100%", fontSize: 11, padding: "6px 8px", border: "1px solid #E7E1D0", borderRadius: 5, outline: "none", color: "#2F3A2B", background: "#FFFBEB", resize: "none", fontFamily: "inherit" }}
            />
            {/* History snapshot */}
            {custSummary && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10, paddingTop: 10, borderTop: "1px dashed #E7E1D0" }}>
                <SbRow label="Last Visited" value={custSummary.lastVisited ? formatDate(custSummary.lastVisited) : "—"} />
                <SbRow label="Last Bill" value={formatCurrency(custSummary.lastBillAmount)} />
                <SbRow label="Most Bought" value={custSummary.mostPurchasedItem ?? "—"} />
                <SbRow label="Due Payment" value={formatCurrency(custSummary.duePayment)} strong={custSummary.duePayment > 0} />
                <SbRow label="Total Purchase" value={formatCurrency(custSummary.totalPurchase)} />
                <SbRow label="Loyalty Points" value={String(Math.round(custSummary.loyaltyPoints))} />
                {(custSummary.creditNoteTotal ?? 0) > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 4, padding: "6px 8px", background: "#FEF3C7", border: "1px solid #FDE68A", borderRadius: 6 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: "#92400E", fontWeight: 600 }}>
                        Credit Note{(custSummary.creditNotes?.length ?? 0) > 1 ? ` (${custSummary.creditNotes!.length})` : ""}
                      </div>
                      <div style={{ fontSize: 13, color: "#92400E", fontWeight: 700 }}>
                        {formatCurrency(custSummary.creditNoteTotal!)}
                      </div>
                    </div>
                    <button
                      onClick={redeemCreditToWallet}
                      disabled={redeemingCredit}
                      style={{ fontSize: 11, fontWeight: 600, color: "#fff", background: "#92400E", border: "none", borderRadius: 6, padding: "6px 10px", cursor: redeemingCredit ? "default" : "pointer", opacity: redeemingCredit ? 0.6 : 1, whiteSpace: "nowrap" }}
                    >
                      {redeemingCredit ? "…" : "Use credit"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Totals (moved here to free the cart list) */}
          <div style={{ padding: "12px 14px", background: "#FAF8F2", borderBottom: "1px solid #E7E1D0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
              <span style={{ fontSize: 12, color: "#7C735C" }}>Subtotal</span>
              <span style={{ fontSize: 12, color: "#2F3A2B", fontWeight: 500 }}>{formatCurrency(subtotal)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: hasLineDiscount ? 2 : 8, opacity: hasLineDiscount ? 0.45 : 1 }}>
              <span style={{ fontSize: 13, color: "#4F4A39", fontWeight: 600 }}>Bill discount</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input type="text" inputMode="decimal" min="0" step="any" disabled={hasLineDiscount} value={billDiscountValue} onChange={(e) => setBillDiscountValue(e.target.value)} placeholder="0" style={{ width: 70, fontSize: 14, padding: "6px 8px", border: "1px solid #D3CAB2", borderRadius: 6, outline: "none", textAlign: "right", color: "#2F3A2B", cursor: hasLineDiscount ? "not-allowed" : "text", background: hasLineDiscount ? "#F1EDE1" : "#fff" }} />
                <div style={{ display: "flex", border: "1px solid #D3CAB2", borderRadius: 6, overflow: "hidden" }}>
                  {(["PERCENT", "FIXED"] as DiscountType[]).map((t) => (
                    <button key={t} onClick={() => setBillDiscountType(t)} disabled={hasLineDiscount} className="pos-btn" style={{ fontSize: 15, fontWeight: 600, padding: "6px 12px", border: "none", cursor: hasLineDiscount ? "not-allowed" : "pointer", background: billDiscountType === t ? "#2F3A2B" : "#fff", color: billDiscountType === t ? "#fff" : "#7C735C", fontFamily: "Inter, sans-serif" }}>
                      {t === "PERCENT" ? "%" : "₹"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {hasLineDiscount && <div style={{ fontSize: 10, color: "#A89F86", marginBottom: 8 }}>Per-product discount in use — discount each item.</div>}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: couponMsg ? 2 : 8, opacity: hasManualDiscount ? 0.45 : 1 }}>
              <span style={{ fontSize: 12, color: "#7C735C" }}>Coupon</span>
              <input value={couponCode} disabled={hasManualDiscount} onChange={(e) => setCouponCode(e.target.value.toUpperCase())} placeholder="Code" style={{ width: 120, fontSize: 13, padding: "5px 8px", border: "1px solid #D3CAB2", borderRadius: 6, outline: "none", textTransform: "uppercase", color: "#2F3A2B", cursor: hasManualDiscount ? "not-allowed" : "text", background: hasManualDiscount ? "#F1EDE1" : "#fff" }} />
            </div>
            {couponCode.trim() && couponMsg && !hasManualDiscount && (
              <div style={{ fontSize: 10, color: couponDiscount > 0 ? "#15803D" : "#A89F86", marginBottom: 8, textAlign: "right" }}>{couponMsg}</div>
            )}
            {promoDiscount > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: "#15803D" }}>{promoLabel}</span>
                <span style={{ fontSize: 12, color: "#15803D", fontWeight: 600 }}>-{formatCurrency(promoDiscount)}</span>
              </div>
            )}
            {manualDiscount > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: "#15803D" }}>Discount</span>
                <span style={{ fontSize: 12, color: "#15803D", fontWeight: 600 }}>-{formatCurrency(manualDiscount)}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: "#7C735C" }}>Add. charges</span>
              <input type="text" inputMode="text" step="any" value={additionalCharges} onChange={(e) => setAdditionalCharges(e.target.value)} placeholder="0" title="Positive adds a charge; negative deducts (e.g. −105)" style={{ width: 70, fontSize: 13, padding: "5px 8px", border: "1px solid #D3CAB2", borderRadius: 6, outline: "none", textAlign: "right", color: "#2F3A2B" }} />
            </div>
            <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, cursor: "pointer" }}>
              <span style={{ fontSize: 12, color: "#7C735C", display: "flex", alignItems: "center", gap: 6 }}>
                <input type="checkbox" checked={roundOff} onChange={(e) => setRoundOff(e.target.checked)} style={{ width: 14, height: 14, accentColor: "#2F3A2B", cursor: "pointer" }} />
                Round off
              </span>
              {roundOff && Math.abs(roundOffAmt) >= 0.005 && (
                <span style={{ fontSize: 12, color: roundOffAmt < 0 ? "#15803D" : "#7C735C", fontWeight: 600 }}>{roundOffAmt < 0 ? "-" : "+"}{formatCurrency(Math.abs(roundOffAmt))}</span>
              )}
            </label>
            <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #E7E1D0", paddingTop: 8, marginTop: 4 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#2F3A2B" }}>Total</span>
              <span style={{ fontSize: 18, fontWeight: 800, color: "#1F2E22" }}>{formatCurrency(total)}</span>
            </div>
            {walletBalance > 0 && (
              <>
                <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, padding: "7px 9px", borderRadius: 7, border: `1px solid ${applyWallet ? "#2F3A2B" : "#E7E1D0"}`, background: applyWallet ? "#F4F2EF" : "#fff", cursor: "pointer" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#4F4A39", fontWeight: 600 }}>
                    <Wallet size={14} color="#2F3A2B" /> Use store credit
                    <span style={{ fontSize: 11, color: "#7C735C", fontWeight: 500 }}>({formatCurrency(walletBalance)})</span>
                  </span>
                  <input type="checkbox" checked={applyWallet} onChange={(e) => setApplyWallet(e.target.checked)} style={{ width: 16, height: 16, accentColor: "#2F3A2B", cursor: "pointer" }} />
                </label>
                {walletApplied > 0 && (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                      <span style={{ fontSize: 12, color: "#15803D" }}>Store credit</span>
                      <span style={{ fontSize: 12, color: "#15803D", fontWeight: 600 }}>-{formatCurrency(walletApplied)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#2F3A2B" }}>Amount due</span>
                      <span style={{ fontSize: 16, fontWeight: 800, color: "#1F2E22" }}>{formatCurrency(amountDue)}</span>
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          {/* Quick actions grid */}
          <div style={{ padding: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, borderBottom: "1px solid #E7E1D0" }}>
            {([
              { label: "Cash Control", Icon: Wallet, onClick: () => setShowCashControl(true) },
              { label: "Held Bills", Icon: Pause, onClick: openHeldModal },
              { label: "Exchange", Icon: RotateCcw, onClick: () => setShowExchange(true) },
              { label: "Orders", Icon: Package, onClick: () => window.open("/admin/orders", "_blank") },
            ] as const).map(({ label, Icon, onClick }) => (
              <button
                key={label}
                onClick={onClick}
                className="pos-btn"
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
                  padding: "12px 6px", border: "1px solid #E7E1D0", borderRadius: 8,
                  background: "#FAF8F2", cursor: "pointer", color: "#2F3A2B",
                  fontSize: 11, fontWeight: 600, fontFamily: "Inter, sans-serif",
                }}
              >
                <Icon size={18} color="#2F3A2B" />
                {label}
              </button>
            ))}
          </div>

          {/* Last bill + reprint */}
          <div style={{ padding: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#2F3A2B", marginBottom: 8 }}>Last Bill</div>
            {lastBill ? (
              <>
                <SbRow label="Bill No." value={lastBill.orderNumber} />
                <SbRow label="Amount" value={formatCurrency(lastBill.total)} strong />
                <button
                  onClick={() => window.open(`/invoice/${lastBill.orderId}?autoprint=1`, "_blank")}
                  className="pos-btn"
                  style={{
                    marginTop: 10, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    padding: "9px", border: "none", borderRadius: 8, background: "#2F3A2B", color: "#fff",
                    fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "Inter, sans-serif",
                  }}
                >
                  <Printer size={14} /> Reprint Last Bill
                </button>
              </>
            ) : (
              <p style={{ fontSize: 12, color: "#A89F86", margin: 0 }}>No bills yet today.</p>
            )}
          </div>
        </div>
        </div>
      </div>

      {/* ─── Cash Control Modal ───────────────────────────────────────────── */}
      {showCashControl && <CashControlModal onClose={() => setShowCashControl(false)} />}

      {/* ─── Held Bills Modal ─────────────────────────────────────────────── */}
      {showHeldModal && (
        <div
          className="modal-overlay"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
          }}
          onClick={(e) => e.target === e.currentTarget && setShowHeldModal(false)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 14,
              width: 420,
              maxHeight: "80vh",
              display: "flex",
              flexDirection: "column",
              fontFamily: "Inter, sans-serif",
              overflow: "hidden",
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid #E7E1D0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Pause size={18} color="#2F3A2B" />
                <span style={{ fontWeight: 700, fontSize: 16, color: "#2F3A2B" }}>
                  Held Bills
                </span>
                <span
                  style={{
                    background: "#E7E1D0",
                    color: "#4F4A39",
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "1px 7px",
                    borderRadius: 10,
                  }}
                >
                  {heldBills.length}
                </span>
              </div>
              <button
                onClick={() => setShowHeldModal(false)}
                className="pos-btn"
                style={{
                  background: "#F4F1E8",
                  border: "none",
                  borderRadius: 6,
                  width: 28,
                  height: 28,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <X size={14} color="#4F4A39" />
              </button>
            </div>

            {/* Body */}
            <div
              className="scrollbar-thin"
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "8px 0",
              }}
            >
              {heldBills.length === 0 ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    padding: "40px 20px",
                    color: "#A89F86",
                    gap: 8,
                  }}
                >
                  <Clock size={32} color="#D3CAB2" />
                  <p style={{ margin: 0, fontSize: 13 }}>No held bills</p>
                </div>
              ) : (
                heldBills.map((bill) => (
                  <div
                    key={bill.billNumber}
                    style={{
                      padding: "12px 20px",
                      borderBottom: "1px solid #F4F1E8",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#2F3A2B" }}>
                        {bill.billNumber}
                      </div>
                      <div style={{ fontSize: 11, color: "#7C735C", marginTop: 2 }}>
                        {bill.salesmanName} · {bill.items.reduce((s, i) => s + i.quantity, 0)} items
                      </div>
                      <div style={{ fontSize: 10, color: "#A89F86", marginTop: 1 }}>
                        {formatDate(bill.savedAt)}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: "#2F3A2B" }}>
                        {formatCurrency(bill.total)}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        onClick={() => retrieveBill(bill)}
                        className="pos-btn"
                        style={{
                          padding: "6px 12px",
                          background: "#1F2E22",
                          color: "#F4F1E8",
                          border: "none",
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: "pointer",
                          fontFamily: "Inter, sans-serif",
                        }}
                      >
                        Retrieve
                      </button>
                      <button
                        onClick={() => discardHeldBill(bill.id)}
                        className="pos-btn"
                        style={{
                          padding: "6px 10px",
                          background: "#FEE2E2",
                          color: "#DC2626",
                          border: "none",
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          fontFamily: "Inter, sans-serif",
                        }}
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Variant Picker Modal ──────────────────────────────────────────── */}
      {pickerProduct && (
        <div
          className="modal-overlay"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
          }}
          onClick={(e) => e.target === e.currentTarget && setPickerProduct(null)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 14,
              width: 400,
              maxHeight: "80vh",
              display: "flex",
              flexDirection: "column",
              fontFamily: "Inter, sans-serif",
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid #E7E1D0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "#1F2E22",
                color: "#F4F1E8",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <Package size={18} />
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: 15,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {pickerProduct.name}
                </span>
              </div>
              <button
                onClick={() => setPickerProduct(null)}
                className="pos-btn"
                style={{
                  background: "#4F4A39",
                  border: "none",
                  borderRadius: 6,
                  width: 28,
                  height: 28,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                <X size={14} color="#F4F1E8" />
              </button>
            </div>

            <div style={{ padding: 16, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#4F4A39", marginBottom: 2 }}>
                SELECT SIZE / VARIANT
              </div>
              {pickerProduct.variants.map((v) => {
                const vAvail = availableStock(v);
                const oos = vAvail <= 0;
                return (
                  <button
                    key={v.id}
                    disabled={oos}
                    onClick={() => {
                      addVariantToCart(pickerProduct, v);
                      setPickerProduct(null);
                    }}
                    className="pos-btn"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 12px",
                      border: "1px solid #E7E1D0",
                      borderRadius: 10,
                      background: oos ? "#F1EDE1" : "#fff",
                      cursor: oos ? "not-allowed" : "pointer",
                      opacity: oos ? 0.55 : 1,
                      textAlign: "left",
                      width: "100%",
                    }}
                  >
                    {v.colorHex && (
                      <span
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: "50%",
                          background: v.colorHex,
                          border: "1px solid #D3CAB2",
                          flexShrink: 0,
                        }}
                      />
                    )}
                    <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#2F3A2B" }}>
                        {getVariantLabel(v) || "Default"}
                      </span>
                      {(v.sku || v.barcode) && (
                        <span style={{ fontSize: 10, color: "#A89F86", fontFamily: "monospace" }}>
                          {v.sku || v.barcode}
                        </span>
                      )}
                    </span>
                    <span style={{ fontSize: 11, color: oos ? "#C0392B" : "#7C735C" }}>
                      {oos ? "Out of stock" : `${vAvail} left`}
                    </span>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: "#2F3A2B",
                        minWidth: 64,
                        textAlign: "right",
                      }}
                    >
                      {formatCurrency(getVariantPrice(v))}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ─── Cash Item Modal ─────────────────────────────────────────────── */}
      {showCashItemModal && (
        <div
          className="modal-overlay"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
          }}
          onClick={(e) => e.target === e.currentTarget && setShowCashItemModal(false)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 14,
              width: 340,
              fontFamily: "Inter, sans-serif",
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid #E7E1D0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "#1F2E22",
                color: "#F4F1E8",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Banknote size={18} />
                <span style={{ fontWeight: 700, fontSize: 15 }}>Add Cash Item</span>
              </div>
              <button
                onClick={() => {
                  setShowCashItemModal(false);
                  setCashItemName("");
                  setCashItemPrice("");
                  setCashItemQty(1);
                }}
                className="pos-btn"
                style={{
                  background: "#4F4A39",
                  border: "none",
                  borderRadius: 6,
                  width: 28,
                  height: 28,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <X size={14} color="#F4F1E8" />
              </button>
            </div>

            <div style={{ padding: "20px" }}>
              {/* Item name */}
              <div style={{ marginBottom: 14 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#4F4A39",
                    marginBottom: 6,
                  }}
                >
                  ITEM NAME
                </label>
                <input
                  type="text"
                  placeholder="e.g. Alteration, Gift Wrap"
                  value={cashItemName}
                  onChange={(e) => setCashItemName(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: "1px solid #E7E1D0",
                    borderRadius: 8,
                    fontSize: 13,
                    fontFamily: "Inter, sans-serif",
                    outline: "none",
                    color: "#1F2E22",
                    background: "#FAF8F2",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Price */}
              <div style={{ marginBottom: 14 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#4F4A39",
                    marginBottom: 6,
                  }}
                >
                  PRICE (₹)
                </label>
                <input
                  type="text" inputMode="decimal"
                  min="0"
                  step="1"
                  placeholder="0.00"
                  value={cashItemPrice}
                  onChange={(e) => setCashItemPrice(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: "1px solid #E7E1D0",
                    borderRadius: 8,
                    fontSize: 16,
                    fontWeight: 700,
                    fontFamily: "Inter, sans-serif",
                    textAlign: "center",
                    outline: "none",
                    color: "#1F2E22",
                    background: "#FAF8F2",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Quantity */}
              <div style={{ marginBottom: 20 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#4F4A39",
                    marginBottom: 6,
                  }}
                >
                  QUANTITY
                </label>
                <input
                  type="text" inputMode="decimal"
                  min="1"
                  placeholder="1"
                  value={cashItemQty}
                  onChange={(e) => setCashItemQty(Math.max(1, parseInt(e.target.value) || 1))}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: "1px solid #E7E1D0",
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: 600,
                    fontFamily: "Inter, sans-serif",
                    textAlign: "center",
                    outline: "none",
                    color: "#1F2E22",
                    background: "#FAF8F2",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Confirm */}
              <button
                onClick={addCashItemToCart}
                className="pos-btn"
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: 10,
                  border: "none",
                  background: "#1F2E22",
                  color: "#F4F1E8",
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: "pointer",
                  fontFamily: "Inter, sans-serif",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  transition: "all 0.15s ease",
                }}
              >
                <Plus size={15} />
                Add to Cart
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Receipt Printed Notice ──────────────────────────────────────── */}
      {showReceipt && (
        <div
          style={{
            position: "fixed",
            bottom: 20,
            right: 20,
            background: "#DCFCE7",
            border: "1px solid #86EFAC",
            borderRadius: 10,
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            zIndex: 200,
            fontFamily: "Inter, sans-serif",
            boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
            animation: "fadeIn 0.3s ease",
          }}
        >
          <Printer size={16} color="#166534" />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#166534" }}>
              A5 bill opened for printing
            </div>
            <div style={{ fontSize: 11, color: "#166534" }}>
              Order: <strong>{lastOrderNum}</strong>
            </div>
          </div>
          {lastOrderId && (
            <button
              onClick={() => window.open(`/invoice/${lastOrderId}?autoprint=1`, "_blank")}
              style={{
                background: "#166534",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
                color: "#fff",
                fontSize: 11,
                fontWeight: 600,
                padding: "5px 9px",
                marginLeft: 4,
              }}
            >
              Print A5 bill
            </button>
          )}
          <button
            onClick={() => setShowReceipt(false)}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "#166534",
              display: "flex",
              marginLeft: 4,
            }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Exchange flow (phone-based) */}
      {showExchange && (
        <ExchangeFlow
          mode="pos"
          initialPhone={customerPhone}
          onClose={() => setShowExchange(false)}
        />
      )}

      {/* Spin animation */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}