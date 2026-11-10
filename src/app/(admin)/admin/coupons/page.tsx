"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";

type CouponType = "PERCENT" | "FLAT" | "FREE_SHIPPING";

interface Coupon {
  id: string;
  code: string;
  type: CouponType;
  value: number;
  minCartValue: number;
  maxDiscount: number | null;
  includeCategoryIds: string[];
  excludeCategoryIds: string[];
  usageLimit: number | null;
  timesUsed: number;
  validFrom: string | null;
  validUntil: string | null;
  isActive: boolean;
  autoApply: boolean;
}

interface CategoryOption {
  id: string;
  name: string;
}

type FormState = {
  id?: string;
  code: string;
  type: CouponType;
  value: string;
  minCartValue: string;
  maxDiscount: string;
  includeCategoryIds: string[];
  excludeCategoryIds: string[];
  usageLimit: string;
  validFrom: string;
  validUntil: string;
  isActive: boolean;
  autoApply: boolean;
};

const EMPTY: FormState = {
  code: "",
  type: "PERCENT",
  value: "",
  minCartValue: "0",
  maxDiscount: "",
  includeCategoryIds: [],
  excludeCategoryIds: [],
  usageLimit: "",
  validFrom: "",
  validUntil: "",
  isActive: true,
  autoApply: false,
};

const dateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);

  // Promise-chain (not async/await) so setState only happens inside callbacks —
  // keeps the mount effect free of synchronous state updates.
  const load = () => {
    Promise.all([fetch("/api/admin/coupons"), fetch("/api/categories")])
      .then(([cRes, catRes]) => Promise.all([cRes.json(), catRes.json()]))
      .then(([cData, catData]) => {
        setCoupons(cData.coupons ?? []);
        // /api/categories returns a tree of roots with children — flatten it.
        const tree = catData.categories ?? [];
        const flat: CategoryOption[] = [];
        for (const root of tree) {
          flat.push({ id: root.id, name: root.name });
          for (const child of root.children ?? []) {
            flat.push({ id: child.id, name: `${root.name} › ${child.name}` });
          }
        }
        setCategories(flat);
      })
      .catch(() => toast.error("Failed to load coupons"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const startCreate = () => setForm({ ...EMPTY });
  const startEdit = (c: Coupon) =>
    setForm({
      id: c.id,
      code: c.code,
      type: c.type,
      value: String(c.value),
      minCartValue: String(c.minCartValue),
      maxDiscount: c.maxDiscount != null ? String(c.maxDiscount) : "",
      includeCategoryIds: c.includeCategoryIds,
      excludeCategoryIds: c.excludeCategoryIds,
      usageLimit: c.usageLimit != null ? String(c.usageLimit) : "",
      validFrom: dateInput(c.validFrom),
      validUntil: dateInput(c.validUntil),
      isActive: c.isActive,
      autoApply: c.autoApply,
    });

  const save = async () => {
    if (!form) return;
    if (!form.code.trim()) return toast.error("Code is required");
    setSaving(true);
    const payload = {
      ...(form.id ? { id: form.id } : {}),
      code: form.code.trim().toUpperCase(),
      type: form.type,
      value: Number(form.value) || 0,
      minCartValue: Number(form.minCartValue) || 0,
      maxDiscount: form.maxDiscount === "" ? null : Number(form.maxDiscount),
      includeCategoryIds: form.includeCategoryIds,
      excludeCategoryIds: form.excludeCategoryIds,
      usageLimit: form.usageLimit === "" ? null : Number(form.usageLimit),
      validFrom: form.validFrom || null,
      validUntil: form.validUntil || null,
      isActive: form.isActive,
      autoApply: form.autoApply,
    };
    try {
      const res = await fetch("/api/admin/coupons", {
        method: form.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to save");
        return;
      }
      toast.success(form.id ? "Coupon updated" : "Coupon created");
      setForm(null);
      load();
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c: Coupon) => {
    if (!confirm(`Delete coupon ${c.code}?`)) return;
    try {
      const res = await fetch(`/api/admin/coupons?id=${c.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Failed to delete");
        return;
      }
      toast.success("Coupon deleted");
      load();
    } catch {
      toast.error("Failed to delete");
    }
  };

  const toggleCat = (field: "includeCategoryIds" | "excludeCategoryIds", id: string) => {
    if (!form) return;
    const has = form[field].includes(id);
    setForm({
      ...form,
      [field]: has ? form[field].filter((x) => x !== id) : [...form[field], id],
    });
  };

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-serif">Coupons</h1>
          <p className="text-sm text-nate-grey-500 mt-1">
            Discount codes for online checkout. Per-category caps come from each
            category/product&apos;s max discount %.
          </p>
        </div>
        {!form && (
          <button
            onClick={startCreate}
            className="px-4 py-2 bg-nate-grey-800 text-white rounded-lg text-sm font-medium hover:bg-nate-grey-700"
          >
            + New coupon
          </button>
        )}
      </div>

      {form && (
        <div className="bg-white rounded-lg p-6 mb-6 border border-nate-grey-200">
          <h2 className="text-lg font-semibold mb-4">{form.id ? "Edit coupon" : "New coupon"}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Code">
              <input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                className="w-full border rounded-lg px-3 py-2 text-sm uppercase"
                placeholder="FLAT10"
              />
            </Field>
            <Field label="Type">
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as CouponType })}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                <option value="PERCENT">Percent off (%)</option>
                <option value="FLAT">Flat amount off (₹)</option>
                <option value="FREE_SHIPPING">Free shipping</option>
              </select>
            </Field>
            {form.type !== "FREE_SHIPPING" && (
              <Field label={form.type === "PERCENT" ? "Discount %" : "Amount off (₹)"}>
                <input
                  type="text" inputMode="decimal"
                  value={form.value}
                  onChange={(e) => setForm({ ...form, value: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </Field>
            )}
            <Field label="Min cart value (₹)">
              <input
                type="text" inputMode="decimal"
                value={form.minCartValue}
                onChange={(e) => setForm({ ...form, minCartValue: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </Field>
            {form.type === "PERCENT" && (
              <Field label="Max discount cap (₹, optional)">
                <input
                  type="text" inputMode="decimal"
                  value={form.maxDiscount}
                  onChange={(e) => setForm({ ...form, maxDiscount: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  placeholder="No cap"
                />
              </Field>
            )}
            <Field label="Usage limit (optional)">
              <input
                type="text" inputMode="decimal"
                value={form.usageLimit}
                onChange={(e) => setForm({ ...form, usageLimit: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="Unlimited"
              />
            </Field>
            <Field label="Valid from (optional)">
              <input
                type="date"
                value={form.validFrom}
                onChange={(e) => setForm({ ...form, validFrom: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Valid until (optional)">
              <input
                type="date"
                value={form.validUntil}
                onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </Field>
          </div>

          {form.type !== "FREE_SHIPPING" && categories.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-5">
              <CategoryPicker
                title="Only these categories (leave empty = all)"
                categories={categories}
                selected={form.includeCategoryIds}
                onToggle={(id) => toggleCat("includeCategoryIds", id)}
              />
              <CategoryPicker
                title="Exclude these categories"
                categories={categories}
                selected={form.excludeCategoryIds}
                onToggle={(id) => toggleCat("excludeCategoryIds", id)}
              />
            </div>
          )}

          <div className="flex items-center gap-5 mt-5">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              />
              Active
            </label>
            <label className="flex items-center gap-2 text-sm" title="Applied automatically by cart value, no code needed">
              <input
                type="checkbox"
                checked={form.autoApply}
                onChange={(e) => setForm({ ...form, autoApply: e.target.checked })}
              />
              Auto-apply (spend tier)
            </label>
            <div className="ml-auto flex gap-2">
              <button
                onClick={() => setForm(null)}
                className="px-4 py-2 text-sm border rounded-lg hover:bg-nate-grey-50"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="px-4 py-2 text-sm bg-nate-grey-800 text-white rounded-lg hover:bg-nate-grey-700 disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save coupon"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-nate-grey-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-nate-grey-500">Loading…</div>
        ) : coupons.length === 0 ? (
          <div className="p-8 text-center text-sm text-nate-grey-500">No coupons yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-nate-grey-50 text-nate-grey-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Discount</th>
                <th className="px-4 py-3 font-medium">Min cart</th>
                <th className="px-4 py-3 font-medium">Used</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {coupons.map((c) => (
                <tr key={c.id} className="border-t border-nate-grey-100">
                  <td className="px-4 py-3 font-semibold">{c.code}</td>
                  <td className="px-4 py-3">
                    {c.type === "FREE_SHIPPING"
                      ? "Free shipping"
                      : c.type === "PERCENT"
                        ? `${c.value}%`
                        : `₹${c.value}`}
                  </td>
                  <td className="px-4 py-3">₹{c.minCartValue.toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3">
                    {c.timesUsed}
                    {c.usageLimit != null ? ` / ${c.usageLimit}` : ""}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        c.isActive
                          ? "text-green-700 bg-green-50 px-2 py-0.5 rounded text-xs"
                          : "text-nate-grey-500 bg-nate-grey-100 px-2 py-0.5 rounded text-xs"
                      }
                    >
                      {c.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      onClick={() => startEdit(c)}
                      className="text-nate-grey-600 hover:text-nate-grey-900 mr-3"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => remove(c)}
                      className="text-red-600 hover:text-red-700"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      {children}
    </div>
  );
}

function CategoryPicker({
  title,
  categories,
  selected,
  onToggle,
}: {
  title: string;
  categories: CategoryOption[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div>
      <p className="text-sm font-medium mb-2">{title}</p>
      <div className="max-h-40 overflow-y-auto border rounded-lg p-2 space-y-1">
        {categories.map((cat) => (
          <label key={cat.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={selected.includes(cat.id)}
              onChange={() => onToggle(cat.id)}
            />
            {cat.name}
          </label>
        ))}
      </div>
    </div>
  );
}
