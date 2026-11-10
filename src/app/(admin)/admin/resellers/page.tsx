"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";

interface Reseller {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
}

const EMPTY = { name: "", email: "", phone: "", password: "" };

export default function ResellersPage() {
  const [resellers, setResellers] = useState<Reseller[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<typeof EMPTY | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    fetch("/api/admin/resellers")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.resellers) setResellers(d.resellers);
      })
      .catch(() => toast.error("Failed to load resellers"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    if (!form) return;
    if (!form.name.trim() || !form.email.trim() || !form.password) {
      return toast.error("Name, email and password are required");
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/resellers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || undefined,
          password: form.password,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to create");
        return;
      }
      toast.success("Reseller created");
      setForm(null);
      load();
    } catch {
      toast.error("Failed to create");
    } finally {
      setSaving(false);
    }
  };

  const update = async (id: string, body: { isActive?: boolean; password?: string }) => {
    const res = await fetch("/api/admin/resellers", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...body }),
    });
    if (!res.ok) {
      const d = await res.json();
      toast.error(d.error ?? "Failed");
      return;
    }
    toast.success("Updated");
    load();
  };

  const resetPassword = (r: Reseller) => {
    const pw = prompt(`New password for ${r.name} (min 6 chars):`);
    if (!pw) return;
    if (pw.length < 6) return toast.error("Password too short");
    update(r.id, { password: pw });
  };

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-serif">Resellers</h1>
          <p className="text-sm text-nate-grey-500 mt-1">
            Reseller accounts log in and see your <strong>reseller price</strong> in place of retail.
            Set each product&apos;s reseller price on its product page.
          </p>
        </div>
        {!form && (
          <button
            onClick={() => setForm({ ...EMPTY })}
            className="px-4 py-2 bg-nate-grey-800 text-white rounded-lg text-sm font-medium hover:bg-nate-grey-700"
          >
            + New reseller
          </button>
        )}
      </div>

      {form && (
        <div className="bg-white rounded-lg p-6 mb-6 border border-nate-grey-200">
          <h2 className="text-lg font-semibold mb-4">New reseller account</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Name">
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="Reseller name / business"
              />
            </Field>
            <Field label="Login email">
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="reseller@example.com"
              />
            </Field>
            <Field label="Phone (optional)">
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Password">
              <input
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="Share this with the reseller"
              />
            </Field>
          </div>
          <div className="flex justify-end gap-2 mt-5">
            <button onClick={() => setForm(null)} className="px-4 py-2 text-sm border rounded-lg hover:bg-nate-grey-50">
              Cancel
            </button>
            <button
              onClick={create}
              disabled={saving}
              className="px-4 py-2 text-sm bg-nate-grey-800 text-white rounded-lg hover:bg-nate-grey-700 disabled:opacity-60"
            >
              {saving ? "Creating…" : "Create reseller"}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-nate-grey-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-nate-grey-500">Loading…</div>
        ) : resellers.length === 0 ? (
          <div className="p-8 text-center text-sm text-nate-grey-500">No resellers yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-nate-grey-50 text-nate-grey-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {resellers.map((r) => (
                <tr key={r.id} className="border-t border-nate-grey-100">
                  <td className="px-4 py-3 font-medium">{r.name}</td>
                  <td className="px-4 py-3">{r.email}</td>
                  <td className="px-4 py-3">{r.phone ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        r.isActive
                          ? "text-green-700 bg-green-50 px-2 py-0.5 rounded text-xs"
                          : "text-nate-grey-500 bg-nate-grey-100 px-2 py-0.5 rounded text-xs"
                      }
                    >
                      {r.isActive ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      onClick={() => resetPassword(r)}
                      className="text-nate-grey-600 hover:text-nate-grey-900 mr-3"
                    >
                      Reset password
                    </button>
                    <button
                      onClick={() => update(r.id, { isActive: !r.isActive })}
                      className={r.isActive ? "text-red-600 hover:text-red-700" : "text-green-700 hover:text-green-800"}
                    >
                      {r.isActive ? "Disable" : "Enable"}
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
