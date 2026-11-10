"use client";

import { useEffect, useRef, useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ShoppingBag,
  Receipt,
} from "lucide-react";

type Source = "MANUAL" | "POS" | "EXCHANGE";

interface Row {
  id: string;
  source: Source;
  kind: "CREDIT" | "DEBIT";
  amount: number;
  note: string;
  category: string | null;
  paymentMethod: string | null;
  at: string; // ISO
  orderNumber?: string;
  customer?: string;
  itemCount?: number;
}

interface Day {
  date: string; // yyyy-mm-dd
  credit: number;
  debit: number;
  net: number;
  count: number;
}

interface Totals {
  posCredit: number;
  manualCredit: number;
  debit: number;
  net: number;
  orderCount: number;
  byMethod: { cash: number; upi: number; card: number; credit: number };
}

const inr = (n: number) => "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
// Parse yyyy-mm-dd as a LOCAL date (no UTC shift).
const parseLocal = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const addDays = (s: string, n: number) => {
  const d = parseLocal(s);
  d.setDate(d.getDate() + n);
  const y = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
};
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function RegisterClient({
  selectedDate,
  today,
  timeline,
  rows,
  totals,
}: {
  selectedDate: string;
  today: string;
  timeline: Day[];
  rows: Row[];
  totals: Totals;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const go = useCallback(
    (date: string) => {
      if (date > today) return;
      startTransition(() => router.push(`/admin/register?date=${date}`));
    },
    [router, today]
  );

  const sel = parseLocal(selectedDate);
  const isToday = selectedDate === today;
  const prev = addDays(selectedDate, -1);
  const next = addDays(selectedDate, 1);
  const longDate = sel.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="mb-4">
        <h1 className="text-2xl font-serif text-nate-grey-800">Daily Register</h1>
        <p className="text-sm text-nate-grey-500 mt-0.5">
          Your day-book. POS sales drop in automatically; add any other cash in/out below. The day rolls over at 12:00 AM.
        </p>
      </div>

      {/* ── Timeline scrubber ──────────────────────────────────────── */}
      <Timeline
        timeline={timeline}
        selectedDate={selectedDate}
        today={today}
        onPick={go}
        pending={pending}
      />

      {/* ── Selected-day panel ─────────────────────────────────────── */}
      <div className={`mt-5 transition-opacity ${pending ? "opacity-60" : "opacity-100"}`}>
        {/* Day title + day stepper */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h2 className="font-serif text-xl text-nate-grey-900">
              {longDate}
              {isToday && (
                <span className="ml-2 align-middle text-[10px] uppercase tracking-wider font-sans font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                  Today
                </span>
              )}
            </h2>
          </div>
          <div className="flex items-center gap-1">
            <StepBtn dir="prev" onClick={() => go(prev)} />
            <input
              type="date"
              value={selectedDate}
              max={today}
              onChange={(e) => e.target.value && go(e.target.value)}
              className="border border-nate-grey-200 rounded-lg px-3 py-1.5 text-sm text-nate-grey-700 focus:outline-none focus:ring-1 focus:ring-nate-grey-400"
            />
            <StepBtn dir="next" onClick={() => go(next)} disabled={isToday} />
            {!isToday && (
              <button
                onClick={() => go(today)}
                className="ml-1 text-xs font-medium text-nate-grey-500 hover:text-nate-grey-900 px-2 py-1.5"
              >
                Today
              </button>
            )}
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
          <SummaryCard
            label="Money In"
            value={inr(totals.posCredit + totals.manualCredit)}
            tone="green"
            sub={`POS ${inr(totals.posCredit)}${totals.manualCredit ? ` · Manual ${inr(totals.manualCredit)}` : ""}`}
          />
          <SummaryCard label="Money Out" value={inr(totals.debit)} tone="red" sub="Manual debits" />
          <SummaryCard
            label="Net"
            value={inr(totals.net)}
            tone={totals.net >= 0 ? "dark" : "red"}
            sub={`${totals.orderCount} POS sale${totals.orderCount === 1 ? "" : "s"}`}
          />
        </div>

        {/* Money in, by payment method */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <SummaryCard label="Cash" value={inr(totals.byMethod.cash)} tone="green" />
          <SummaryCard label="UPI" value={inr(totals.byMethod.upi)} tone="dark" />
          <SummaryCard label="Card" value={inr(totals.byMethod.card)} tone="dark" />
          <SummaryCard
            label="On credit (owed)"
            value={inr(totals.byMethod.credit)}
            tone={totals.byMethod.credit > 0 ? "red" : "dark"}
            sub="Khata / balance"
          />
        </div>

        {/* Add-entry panel — always open for quick entry */}
        <AddEntry entryDate={selectedDate} onDone={() => startTransition(() => router.refresh())} />

        {/* Ledger */}
        <Ledger rows={rows} onChanged={() => startTransition(() => router.refresh())} />
      </div>
    </div>
  );
}

/* ── Timeline scrubber ──────────────────────────────────────────────── */
function Timeline({
  timeline,
  selectedDate,
  today,
  onPick,
  pending,
}: {
  timeline: Day[];
  selectedDate: string;
  today: string;
  onPick: (d: string) => void;
  pending: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const selRef = useRef<HTMLButtonElement>(null);
  const maxNet = Math.max(1, ...timeline.map((d) => Math.abs(d.net)));

  // Keep the selected chip in view.
  useEffect(() => {
    selRef.current?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [selectedDate]);

  const nudge = (dir: -1 | 1) => {
    scrollRef.current?.scrollBy({ left: dir * 320, behavior: "smooth" });
  };

  return (
    <div className="relative bg-white rounded-xl border border-nate-grey-200 px-2 py-3">
      <button
        onClick={() => nudge(-1)}
        aria-label="Scroll back"
        className="absolute left-1 top-1/2 -translate-y-1/2 z-10 w-7 h-7 grid place-items-center rounded-full bg-white border border-nate-grey-200 text-nate-grey-500 hover:text-nate-grey-900 shadow-sm"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <div
        ref={scrollRef}
        className="flex gap-1.5 overflow-x-auto scrollbar-thin px-8 scroll-smooth"
        style={{ scrollbarWidth: "thin" }}
      >
        {timeline.map((d) => {
          const isSel = d.date === selectedDate;
          const isToday = d.date === today;
          const dt = parseLocal(d.date);
          const barH = d.net !== 0 ? Math.max(3, Math.round((Math.abs(d.net) / maxNet) * 26)) : 0;
          const pos = d.net >= 0;
          return (
            <button
              key={d.date}
              ref={isSel ? selRef : undefined}
              onClick={() => onPick(d.date)}
              disabled={pending}
              title={d.count ? `${d.count} entr${d.count === 1 ? "y" : "ies"} · net ${inr(d.net)}` : "No activity"}
              className={`shrink-0 w-[3.25rem] rounded-lg flex flex-col items-center pt-2 pb-1.5 transition-colors ${
                isSel
                  ? "bg-nate-grey-900 text-white shadow-md"
                  : "text-nate-grey-600 hover:bg-nate-grey-100"
              }`}
            >
              <span className={`text-[10px] uppercase tracking-wide ${isSel ? "text-white/70" : "text-nate-grey-400"}`}>
                {WEEKDAY[dt.getDay()]}
              </span>
              <span className="text-base font-serif leading-tight tabular-nums">{dt.getDate()}</span>
              {/* activity bar */}
              <span className="mt-1.5 h-[28px] w-full flex items-end justify-center">
                {barH > 0 ? (
                  <span
                    className={`block w-1.5 rounded-full ${
                      isSel ? "bg-white" : pos ? "bg-green-500" : "bg-red-400"
                    }`}
                    style={{ height: `${barH}px` }}
                  />
                ) : (
                  <span className={`block w-1 h-1 rounded-full mb-1 ${isSel ? "bg-white/40" : "bg-nate-grey-200"}`} />
                )}
              </span>
              {isToday && !isSel && <span className="w-1 h-1 rounded-full bg-green-500" />}
              {isToday && isSel && <span className="w-1 h-1 rounded-full bg-white" />}
            </button>
          );
        })}
      </div>
      <button
        onClick={() => nudge(1)}
        aria-label="Scroll forward"
        className="absolute right-1 top-1/2 -translate-y-1/2 z-10 w-7 h-7 grid place-items-center rounded-full bg-white border border-nate-grey-200 text-nate-grey-500 hover:text-nate-grey-900 shadow-sm"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

function StepBtn({ dir, onClick, disabled }: { dir: "prev" | "next"; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === "prev" ? "Previous day" : "Next day"}
      className="w-9 h-9 grid place-items-center rounded-lg border border-nate-grey-200 text-nate-grey-600 hover:bg-nate-grey-100 disabled:opacity-30 disabled:cursor-not-allowed"
    >
      {dir === "prev" ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
    </button>
  );
}

function SummaryCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: "green" | "red" | "dark";
}) {
  const valCls = tone === "green" ? "text-green-600" : tone === "red" ? "text-red-600" : "text-nate-grey-900";
  return (
    <div className="bg-white rounded-xl border border-nate-grey-200 p-4">
      <p className="text-[10px] uppercase tracking-wide text-nate-grey-400 font-medium">{label}</p>
      <p className={`font-serif text-2xl tabular-nums mt-1 ${valCls}`}>{value}</p>
      {sub && <p className="text-[11px] text-nate-grey-400 mt-0.5 truncate">{sub}</p>}
    </div>
  );
}

/* ── Add-entry panel ────────────────────────────────────────────────── */
const PAY_METHODS = ["Cash", "UPI", "Card", "Bank", "Cheque", "Other"];

function AddEntry({ entryDate, onDone }: { entryDate: string; onDone: () => void }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    kind: "DEBIT" as "CREDIT" | "DEBIT",
    amount: "",
    note: "",
    paymentMethod: "Cash",
    category: "",
  });
  const inputCls =
    "w-full border border-nate-grey-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nate-grey-400";

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseFloat(form.amount);
    if (!amount || amount <= 0) return toast.error("Enter an amount");
    if (!form.note.trim()) return toast.error("Add a note");
    setSaving(true);
    try {
      const res = await fetch("/api/admin/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: form.kind,
          amount,
          note: form.note.trim(),
          paymentMethod: form.paymentMethod || undefined,
          category: form.category.trim() || undefined,
          entryDate, // record against the day being viewed
        }),
      });
      const data = await res.json();
      if (!res.ok) return toast.error(data.error ?? "Couldn't save");
      toast.success(`${form.kind === "CREDIT" ? "Money in" : "Money out"} recorded`);
      // Stay open for the next entry — keep type + method, clear the rest.
      setForm((f) => ({ ...f, amount: "", note: "", category: "" }));
      onDone();
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={add} className="bg-nate-grey-50 border border-nate-grey-200 rounded-xl px-5 py-4 mb-4">
      <div className="grid grid-cols-2 md:grid-cols-7 gap-3 items-end">
        <div className="col-span-2 md:col-span-1">
          <label className="block text-[10px] uppercase tracking-wide text-nate-grey-400 font-medium mb-1">Type</label>
          <div className="flex rounded-lg overflow-hidden border border-nate-grey-200">
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, kind: "DEBIT" }))}
              className={`flex-1 py-2 text-xs font-medium ${form.kind === "DEBIT" ? "bg-red-600 text-white" : "bg-white text-nate-grey-600"}`}
            >
              Out
            </button>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, kind: "CREDIT" }))}
              className={`flex-1 py-2 text-xs font-medium ${form.kind === "CREDIT" ? "bg-green-600 text-white" : "bg-white text-nate-grey-600"}`}
            >
              In
            </button>
          </div>
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wide text-nate-grey-400 font-medium mb-1">Amount ₹</label>
          <input type="text" inputMode="decimal" min="0" step="any" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} className={inputCls} placeholder="0" />
        </div>
        <div className="col-span-2">
          <label className="block text-[10px] uppercase tracking-wide text-nate-grey-400 font-medium mb-1">Note</label>
          <input value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} className={inputCls} placeholder="e.g. Tea / repair / owner withdrawal" />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wide text-nate-grey-400 font-medium mb-1">Payment</label>
          <select value={form.paymentMethod} onChange={(e) => setForm((f) => ({ ...f, paymentMethod: e.target.value }))} className={inputCls}>
            {PAY_METHODS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        <div className="col-span-2 md:col-span-1">
          <label className="block text-[10px] uppercase tracking-wide text-nate-grey-400 font-medium mb-1">Category</label>
          <input value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className={inputCls} placeholder="optional" />
        </div>
        <div>
          <button type="submit" disabled={saving} className="w-full bg-nate-grey-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-black disabled:opacity-50">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
      <p className="text-[11px] text-nate-grey-400 mt-2">Recording against {parseLocal(entryDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}.</p>
    </form>
  );
}

/* ── Unified ledger ─────────────────────────────────────────────────── */
function Ledger({ rows, onChanged }: { rows: Row[]; onChanged: () => void }) {
  const router = useRouter();

  async function remove(id: string) {
    if (!window.confirm("Delete this entry?")) return;
    try {
      const res = await fetch(`/api/admin/register?id=${id}`, { method: "DELETE" });
      if (!res.ok) return toast.error("Couldn't delete");
      toast.success("Entry removed");
      onChanged();
    } catch {
      toast.error("Network error");
    }
  }

  if (rows.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-nate-grey-200 py-16 text-center">
        <Receipt className="w-8 h-8 mx-auto text-nate-grey-300" />
        <p className="text-nate-grey-400 text-sm mt-3">Nothing recorded on this day yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-nate-grey-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-nate-grey-50 border-b border-nate-grey-100">
              <th className="text-left px-5 py-2.5 text-[11px] font-medium text-nate-grey-500 uppercase tracking-wide">Time</th>
              <th className="text-left px-5 py-2.5 text-[11px] font-medium text-nate-grey-500 uppercase tracking-wide">Detail</th>
              <th className="text-left px-5 py-2.5 text-[11px] font-medium text-nate-grey-500 uppercase tracking-wide">Payment</th>
              <th className="text-left px-5 py-2.5 text-[11px] font-medium text-nate-grey-500 uppercase tracking-wide">Category</th>
              <th className="text-right px-5 py-2.5 text-[11px] font-medium text-nate-grey-500 uppercase tracking-wide">In</th>
              <th className="text-right px-5 py-2.5 text-[11px] font-medium text-nate-grey-500 uppercase tracking-wide">Out</th>
              <th className="w-12"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-nate-grey-100">
            {rows.map((r) => {
              const isPos = r.source === "POS";
              const isExchange = r.source === "EXCHANGE";
              return (
                <tr
                  key={`${r.source}-${r.id}`}
                  className={`hover:bg-nate-grey-50 ${isPos ? "cursor-pointer" : ""}`}
                  onClick={isPos ? () => router.push(`/admin/orders/${r.id}`) : undefined}
                >
                  <td className="px-5 py-3 text-nate-grey-500 whitespace-nowrap tabular-nums">{fmtTime(r.at)}</td>
                  <td className="px-5 py-3 text-nate-grey-800">
                    <span className="inline-flex items-center gap-2">
                      {isPos ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-green-700 bg-green-100 px-1.5 py-0.5 rounded">
                          <ShoppingBag className="w-3 h-3" /> POS
                        </span>
                      ) : isExchange ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                          Exchange
                        </span>
                      ) : r.kind === "CREDIT" ? (
                        <ArrowDownCircle className="w-4 h-4 text-green-600 shrink-0" />
                      ) : (
                        <ArrowUpCircle className="w-4 h-4 text-red-600 shrink-0" />
                      )}
                      <span>
                        {r.note}
                        {isPos && (
                          <span className="block text-xs text-nate-grey-400">
                            #{r.orderNumber} · {r.customer} · {r.itemCount} item{r.itemCount === 1 ? "" : "s"}
                          </span>
                        )}
                      </span>
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    {r.paymentMethod ? (
                      <span className="inline-block text-[11px] font-medium text-nate-grey-600 bg-nate-grey-100 px-2 py-0.5 rounded-full">
                        {r.paymentMethod}
                      </span>
                    ) : (
                      <span className="text-nate-grey-300">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-nate-grey-500">{r.category || "—"}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-green-600">{r.kind === "CREDIT" ? inr(r.amount) : ""}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-red-600">{r.kind === "DEBIT" ? inr(r.amount) : ""}</td>
                  <td className="px-5 py-3 text-right">
                    {isPos ? (
                      <span className="text-[10px] text-nate-grey-300">auto</span>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          remove(r.id);
                        }}
                        className="text-nate-grey-400 hover:text-red-600 p-1"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
