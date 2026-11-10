"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Truck, Loader2, ExternalLink } from "lucide-react";
import toast from "react-hot-toast";

// Book a QuikShipX courier shipment for an order, or show the AWB once booked.
// The dialog pre-fills sensible package defaults (orders don't store weight or
// dimensions) which the admin can adjust before booking.
export function ShipOrderButton({
  orderId,
  awb,
  trackingUrl,
}: {
  orderId: string;
  awb: string | null;
  trackingUrl: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    weightGrams: "500",
    lengthCm: "10",
    widthCm: "20",
    heightCm: "30",
    packageType: "1",
    shippingMode: "1",
  });

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  // Already shipped — show the AWB + tracking link instead of the button.
  if (awb) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium bg-green-50 text-green-700 border border-green-200">
        <Truck className="w-3.5 h-3.5" />
        AWB {awb}
        {trackingUrl && (
          <a href={trackingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center hover:underline">
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </span>
    );
  }

  async function book() {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/ship`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error ?? `Failed to book (${res.status})`);
        setBusy(false);
        return;
      }
      toast.success(data.awb ? `Shipment booked · AWB ${data.awb}` : "Shipment booked");
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Network error — please retry.");
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-nate-grey-700 border border-nate-grey-300 rounded-lg hover:bg-nate-grey-50 transition-colors"
      >
        <Truck className="w-3.5 h-3.5" />
        Book delivery
      </button>

      {open && (
        <div className="fixed inset-0 z-[90] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-medium text-nate-grey-900 flex items-center gap-2">
              <Truck className="w-5 h-5" /> Book delivery (QuikShipX)
            </h3>
            <p className="text-sm text-nate-grey-500 mt-1">
              Confirm the package details — the customer address and amounts come from the order.
            </p>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <Labeled label="Weight (grams)">
                <input value={form.weightGrams} onChange={(e) => set("weightGrams", e.target.value)} inputMode="decimal" className={inputCls} />
              </Labeled>
              <Labeled label="Package">
                <select value={form.packageType} onChange={(e) => set("packageType", e.target.value)} className={inputCls}>
                  <option value="1">Flyer</option>
                  <option value="2">Cardboard</option>
                </select>
              </Labeled>
              <Labeled label="Length (cm)">
                <input value={form.lengthCm} onChange={(e) => set("lengthCm", e.target.value)} inputMode="decimal" className={inputCls} />
              </Labeled>
              <Labeled label="Width (cm)">
                <input value={form.widthCm} onChange={(e) => set("widthCm", e.target.value)} inputMode="decimal" className={inputCls} />
              </Labeled>
              <Labeled label="Height (cm)">
                <input value={form.heightCm} onChange={(e) => set("heightCm", e.target.value)} inputMode="decimal" className={inputCls} />
              </Labeled>
              <Labeled label="Mode">
                <select value={form.shippingMode} onChange={(e) => set("shippingMode", e.target.value)} className={inputCls}>
                  <option value="1">Surface</option>
                  <option value="2">Express</option>
                </select>
              </Labeled>
            </div>

            <div className="flex items-center justify-end gap-2 mt-6">
              <button onClick={() => setOpen(false)} disabled={busy} className="px-4 py-2 text-sm font-medium text-nate-grey-700 hover:text-black disabled:opacity-50">
                Cancel
              </button>
              <button onClick={book} disabled={busy} className="inline-flex items-center gap-2 px-5 py-2 bg-nate-grey-900 text-white rounded-lg text-sm font-medium hover:bg-black disabled:opacity-50">
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                {busy ? "Booking…" : "Book shipment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const inputCls =
  "w-full border border-nate-grey-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-accent focus:border-transparent outline-none";

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs text-nate-grey-600 mb-1">{label}</span>
      {children}
    </label>
  );
}
