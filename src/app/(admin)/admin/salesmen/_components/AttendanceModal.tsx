"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Loader2, CalendarCheck, Plus } from "lucide-react";
import toast from "react-hot-toast";

interface Salesman {
  id: string;
  name: string;
  isActive: boolean;
}

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const prettyDate = (s: string) =>
  new Date(s + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export function AttendanceModal() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"date" | "bulk">("date");
  const [salesmen, setSalesmen] = useState<Salesman[]>([]);
  const [loading, setLoading] = useState(false);

  // Load the (active) roster once the modal opens.
  useEffect(() => {
    if (!open || salesmen.length) return;
    setLoading(true);
    fetch("/api/admin/salesmen")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setSalesmen((d?.salesmen ?? []).filter((s: Salesman) => s.isActive)))
      .catch(() => setSalesmen([]))
      .finally(() => setLoading(false));
  }, [open, salesmen.length]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-nate-grey-200 text-nate-grey-700 hover:bg-nate-grey-100 transition-colors"
      >
        <CalendarCheck className="w-4 h-4" /> Attendance
      </button>

      {open && (
        <div className="fixed inset-0 z-[90] bg-black/50 flex items-start justify-center p-4 overflow-y-auto" onClick={() => setOpen(false)}>
          <div className="bg-white w-full max-w-2xl rounded-xl shadow-xl my-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-nate-grey-100">
              <div>
                <h2 className="font-serif text-lg text-nate-grey-900">Attendance</h2>
                <p className="text-xs text-nate-grey-500 mt-0.5">Everyone is present by default — only mark who's absent.</p>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close" className="text-nate-grey-400 hover:text-nate-grey-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="px-6 pt-4 flex gap-2">
              <TabBtn active={tab === "date"} onClick={() => setTab("date")}>Mark a day</TabBtn>
              <TabBtn active={tab === "bulk"} onClick={() => setTab("bulk")}>Multi-day absence</TabBtn>
            </div>

            <div className="p-6">
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-12 text-nate-grey-400">
                  <Loader2 className="w-5 h-5 animate-spin" /> Loading…
                </div>
              ) : tab === "date" ? (
                <ByDate salesmen={salesmen} />
              ) : (
                <BulkAbsence salesmen={salesmen} />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-sm font-medium rounded-lg ${active ? "bg-nate-grey-900 text-white" : "text-nate-grey-600 hover:bg-nate-grey-100"}`}
    >
      {children}
    </button>
  );
}

/* ── Tab 1: mark a single day ──────────────────────────────────────────── */
function ByDate({ salesmen }: { salesmen: Salesman[] }) {
  const [date, setDate] = useState(todayStr());
  const [absent, setAbsent] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (d: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/salesmen/attendance?date=${d}`);
      const data = res.ok ? await res.json() : null;
      setAbsent(new Set<string>(data?.absentIds ?? []));
    } catch {
      setAbsent(new Set());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(date);
  }, [date, load]);

  const toggle = (id: string) =>
    setAbsent((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/salesmen/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, absentIds: [...absent] }),
      });
      if (!res.ok) return toast.error("Couldn't save");
      toast.success(`Saved — ${absent.size} absent on ${prettyDate(date)}`);
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-end justify-between gap-3 mb-4">
        <div>
          <label className="block text-[11px] uppercase tracking-wide text-nate-grey-400 mb-1">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="border border-nate-grey-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-nate-grey-400"
          />
        </div>
        <div className="text-sm text-nate-grey-500">
          <span className="font-semibold text-nate-grey-900">{absent.size}</span> absent ·{" "}
          <span className="font-semibold text-green-600">{Math.max(0, salesmen.length - absent.size)}</span> present
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-nate-grey-400">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading…
        </div>
      ) : salesmen.length === 0 ? (
        <p className="py-10 text-center text-sm text-nate-grey-400">No active salesmen.</p>
      ) : (
        <div className="max-h-[45vh] overflow-y-auto divide-y divide-nate-grey-100 border border-nate-grey-200 rounded-lg">
          {salesmen.map((s) => {
            const isAbsent = absent.has(s.id);
            return (
              <div key={s.id} className="flex items-center justify-between px-4 py-2.5">
                <span className="text-sm text-nate-grey-800">{s.name}</span>
                <div className="flex rounded-lg overflow-hidden border border-nate-grey-200">
                  <button
                    onClick={() => isAbsent && toggle(s.id)}
                    className={`px-3 py-1 text-xs font-medium ${!isAbsent ? "bg-green-600 text-white" : "bg-white text-nate-grey-500"}`}
                  >
                    Present
                  </button>
                  <button
                    onClick={() => !isAbsent && toggle(s.id)}
                    className={`px-3 py-1 text-xs font-medium ${isAbsent ? "bg-red-600 text-white" : "bg-white text-nate-grey-500"}`}
                  >
                    Absent
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 flex justify-end">
        <button
          onClick={save}
          disabled={saving || loading}
          className="px-5 py-2 rounded-lg bg-nate-grey-900 text-white text-sm font-medium hover:bg-black disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save attendance"}
        </button>
      </div>
    </div>
  );
}

/* ── Tab 2: mark one salesman absent (or present) across many days ─────── */
function BulkAbsence({ salesmen }: { salesmen: Salesman[] }) {
  const [salesmanId, setSalesmanId] = useState("");
  const [pickDate, setPickDate] = useState(todayStr());
  const [dates, setDates] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const addDate = () => {
    if (!pickDate) return;
    setDates((prev) => (prev.includes(pickDate) ? prev : [...prev, pickDate].sort()));
  };
  const removeDate = (d: string) => setDates((prev) => prev.filter((x) => x !== d));

  async function submit(absent: boolean) {
    if (!salesmanId) return toast.error("Pick a salesman");
    if (dates.length === 0) return toast.error("Add at least one date");
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/salesmen/${salesmanId}/absences`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dates, absent }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) return toast.error(data?.error ?? "Couldn't save");
      toast.success(`${dates.length} day(s) marked ${absent ? "absent" : "present"}`);
      setDates([]);
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="grid sm:grid-cols-2 gap-3 mb-3">
        <div>
          <label className="block text-[11px] uppercase tracking-wide text-nate-grey-400 mb-1">Salesman</label>
          <select
            value={salesmanId}
            onChange={(e) => setSalesmanId(e.target.value)}
            className="w-full border border-nate-grey-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nate-grey-400"
          >
            <option value="">Select…</option>
            {salesmen.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] uppercase tracking-wide text-nate-grey-400 mb-1">Add dates (future allowed)</label>
          <div className="flex gap-2">
            <input
              type="date"
              value={pickDate}
              onChange={(e) => setPickDate(e.target.value)}
              className="flex-1 border border-nate-grey-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nate-grey-400"
            />
            <button onClick={addDate} className="px-3 py-2 rounded-lg border border-nate-grey-200 text-nate-grey-700 hover:bg-nate-grey-100 text-sm inline-flex items-center gap-1">
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>
        </div>
      </div>

      {/* Chosen dates */}
      <div className="min-h-[3rem] border border-nate-grey-200 rounded-lg p-2 flex flex-wrap gap-2 mb-4">
        {dates.length === 0 ? (
          <span className="text-sm text-nate-grey-400 px-1 py-1">No dates added yet.</span>
        ) : (
          dates.map((d) => (
            <span key={d} className="inline-flex items-center gap-1 bg-nate-grey-100 text-nate-grey-700 text-xs font-medium px-2 py-1 rounded-full">
              {prettyDate(d)}
              <button onClick={() => removeDate(d)} className="text-nate-grey-400 hover:text-red-600">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))
        )}
      </div>

      <div className="flex justify-end gap-2">
        <button
          onClick={() => submit(false)}
          disabled={saving}
          className="px-4 py-2 rounded-lg border border-nate-grey-200 text-nate-grey-700 text-sm font-medium hover:bg-nate-grey-100 disabled:opacity-50"
        >
          Mark present
        </button>
        <button
          onClick={() => submit(true)}
          disabled={saving}
          className="px-5 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Mark absent"}
        </button>
      </div>
    </div>
  );
}
