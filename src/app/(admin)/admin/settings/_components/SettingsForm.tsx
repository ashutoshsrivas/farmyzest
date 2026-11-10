"use client";

import { useState, useEffect } from "react";

interface StoreConfig {
  storeName?: string;
  gstNumber?: string;
  storeAddress?: string;
  storePhone?: string;
  storeState?: string;
  defaultGstRate?: string;
  smtpHost?: string;
  smtpPort?: string;
  smtpUser?: string;
  smtpPass?: string;
  smtpFrom?: string;
  interaktApiKey?: string;
  codEnabled?: boolean;
  partialPaymentEnabled?: boolean;
  partialPaymentPercent?: number | string;
}

export function SettingsForm() {
  const [form, setForm] = useState<StoreConfig>({});
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data && typeof data === "object") {
          setForm(data);
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setMessage({ type: "success", text: "Settings saved successfully." });
      } else {
        setMessage({ type: "error", text: "Failed to save settings." });
      }
    } catch {
      setMessage({ type: "error", text: "Network error. Please try again." });
    } finally {
      setSaving(false);
    }
  }

  function setField(key: keyof StoreConfig, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  if (!loaded) {
    return (
      <div className="max-w-2xl space-y-6">
        <div className="bg-white rounded-xl p-6 animate-pulse h-32" />
        <div className="bg-white rounded-xl p-6 animate-pulse h-48" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      {message && (
        <div className={`px-4 py-3 rounded-lg text-sm ${message.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {message.text}
        </div>
      )}

      {/* Store Info */}
      <div className="bg-white rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-medium text-nate-grey-800">Store Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-nate-grey-700 mb-1">Store Name</label>
            <input
              type="text"
              value={form.storeName || ""}
              onChange={(e) => setField("storeName", e.target.value)}
              className="w-full border border-nate-grey-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nate-grey-400"
              placeholder="Farmyzest"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-nate-grey-700 mb-1">GST Number</label>
            <input
              type="text"
              value={form.gstNumber || ""}
              onChange={(e) => setField("gstNumber", e.target.value)}
              className="w-full border border-nate-grey-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nate-grey-400 font-mono uppercase"
              placeholder="27AAAAA0000A1Z5"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-nate-grey-700 mb-1">Store Address</label>
            <input
              type="text"
              value={form.storeAddress || ""}
              onChange={(e) => setField("storeAddress", e.target.value)}
              className="w-full border border-nate-grey-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nate-grey-400"
              placeholder="Shop address — printed on the tax invoice"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-nate-grey-700 mb-1">Store Phone</label>
            <input
              type="text"
              value={form.storePhone || ""}
              onChange={(e) => setField("storePhone", e.target.value)}
              className="w-full border border-nate-grey-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nate-grey-400"
              placeholder="+91 …"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-nate-grey-700 mb-1">State (for GST)</label>
            <input
              type="text"
              value={form.storeState || ""}
              onChange={(e) => setField("storeState", e.target.value)}
              className="w-full border border-nate-grey-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nate-grey-400"
              placeholder="Uttarakhand"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-nate-grey-700 mb-1">Default GST rate %</label>
            <input
              type="text" inputMode="decimal"
              min="0"
              max="100"
              step="any"
              value={form.defaultGstRate ?? ""}
              onChange={(e) => setField("defaultGstRate", e.target.value)}
              className="w-full border border-nate-grey-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nate-grey-400"
              placeholder="5"
            />
            <p className="text-xs text-nate-grey-400 mt-1">
              Used on the tax invoice for items without their own tax slab, so the CGST/SGST breakup always shows. Prices are GST-inclusive.
            </p>
          </div>
        </div>
      </div>

      {/* SMTP */}
      <div className="bg-white rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-medium text-nate-grey-800">SMTP / SES Configuration</h2>
        <p className="text-xs text-nate-grey-400 -mt-1">
          Used for transactional emails (order confirmations, OTPs, etc.)
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-nate-grey-700 mb-1">SMTP Host</label>
            <input
              type="text"
              value={form.smtpHost || ""}
              onChange={(e) => setField("smtpHost", e.target.value)}
              className="w-full border border-nate-grey-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nate-grey-400"
              placeholder="email-smtp.ap-south-1.amazonaws.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-nate-grey-700 mb-1">SMTP Port</label>
            <input
              type="text"
              value={form.smtpPort || ""}
              onChange={(e) => setField("smtpPort", e.target.value)}
              className="w-full border border-nate-grey-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nate-grey-400"
              placeholder="587"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-nate-grey-700 mb-1">SMTP Username</label>
            <input
              type="text"
              value={form.smtpUser || ""}
              onChange={(e) => setField("smtpUser", e.target.value)}
              className="w-full border border-nate-grey-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nate-grey-400"
              placeholder="AKIA..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-nate-grey-700 mb-1">SMTP Password</label>
            <input
              type="password"
              value={form.smtpPass || ""}
              onChange={(e) => setField("smtpPass", e.target.value)}
              className="w-full border border-nate-grey-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nate-grey-400"
              placeholder="••••••••"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-nate-grey-700 mb-1">From Email</label>
            <input
              type="email"
              value={form.smtpFrom || ""}
              onChange={(e) => setField("smtpFrom", e.target.value)}
              className="w-full border border-nate-grey-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nate-grey-400"
              placeholder="noreply@farmyzest.com"
            />
          </div>
        </div>
      </div>

      {/* Interakt */}
      <div className="bg-white rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-medium text-nate-grey-800">Interakt API</h2>
        <p className="text-xs text-nate-grey-400 -mt-1">
          Used for WhatsApp and SMS notifications via Interakt platform.
        </p>
        <div>
          <label className="block text-sm font-medium text-nate-grey-700 mb-1">Interakt API Key</label>
          <input
            type="password"
            value={form.interaktApiKey || ""}
            onChange={(e) => setField("interaktApiKey", e.target.value)}
            className="w-full border border-nate-grey-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nate-grey-400"
            placeholder="ik_..."
          />
        </div>
      </div>

      {/* Checkout / Payments */}
      <div className="bg-white rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-medium text-nate-grey-800">Checkout</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-nate-grey-800">Cash on Delivery</p>
            <p className="text-xs text-nate-grey-400 mt-0.5">
              Show the Cash on Delivery option to customers at online checkout. When off, only
              online payment (PayU) is offered.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={!!form.codEnabled}
            onClick={() => setForm((prev) => ({ ...prev, codEnabled: !prev.codEnabled }))}
            className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ml-4 ${
              form.codEnabled ? "bg-accent" : "bg-nate-grey-300"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                form.codEnabled ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        <div className="border-t border-nate-grey-100 pt-4 flex items-start justify-between gap-4">
          <div className="flex-1">
            <p className="text-sm font-medium text-nate-grey-800">Partial Payment (advance)</p>
            <p className="text-xs text-nate-grey-400 mt-0.5">
              Let customers pay a percentage online now and the rest on delivery. Set the advance
              percentage, then turn it on.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <input
                type="text" inputMode="decimal"
                min={1}
                max={99}
                value={form.partialPaymentPercent ?? ""}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, partialPaymentPercent: e.target.value }))
                }
                className="w-20 border border-nate-grey-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nate-grey-400"
                placeholder="30"
              />
              <span className="text-sm text-nate-grey-500">% paid online now</span>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={!!form.partialPaymentEnabled}
            onClick={() =>
              setForm((prev) => ({ ...prev, partialPaymentEnabled: !prev.partialPaymentEnabled }))
            }
            className={`relative w-11 h-6 rounded-full transition-colors shrink-0 mt-1 ${
              form.partialPaymentEnabled ? "bg-accent" : "bg-nate-grey-300"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                form.partialPaymentEnabled ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="bg-accent text-white px-8 py-2.5 rounded-lg text-sm font-medium hover:bg-nate-grey-700 disabled:opacity-50 transition-colors"
      >
        {saving ? "Saving..." : "Save Settings"}
      </button>
    </form>
  );
}