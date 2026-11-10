"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Loader2, CalendarX } from "lucide-react";
import toast from "react-hot-toast";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const pad = (n: number) => String(n).padStart(2, "0");
const dateStr = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`; // m = 0-11

export function AttendanceCalendar({ salesmanId, salesmanName }: { salesmanId: string; salesmanName: string }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-11
  const [absent, setAbsent] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/salesmen/${salesmanId}/absences?year=${year}&month=${month + 1}`);
      const data = res.ok ? await res.json() : null;
      setAbsent(new Set<string>(data?.dates ?? []));
    } catch {
      setAbsent(new Set());
    } finally {
      setLoading(false);
    }
  }, [salesmanId, year, month]);

  useEffect(() => {
    load();
  }, [load]);

  const shift = (delta: number) => {
    let m = month + delta;
    let y = year;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setMonth(m);
    setYear(y);
  };

  async function toggle(ds: string) {
    const wasAbsent = absent.has(ds);
    setBusy(ds);
    // Optimistic.
    setAbsent((prev) => {
      const next = new Set(prev);
      if (wasAbsent) next.delete(ds);
      else next.add(ds);
      return next;
    });
    try {
      const res = await fetch(`/api/admin/salesmen/${salesmanId}/absences`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dates: [ds], absent: !wasAbsent }),
      });
      if (!res.ok) throw new Error();
    } catch {
      toast.error("Couldn't update — reverting");
      setAbsent((prev) => {
        const next = new Set(prev);
        if (wasAbsent) next.add(ds);
        else next.delete(ds);
        return next;
      });
    } finally {
      setBusy(null);
    }
  }

  const firstDow = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayDs = dateStr(now.getFullYear(), now.getMonth(), now.getDate());

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="bg-white rounded-xl border border-nate-grey-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CalendarX className="w-5 h-5 text-nate-grey-500" />
          <h2 className="text-lg font-medium text-nate-grey-800">Attendance</h2>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="border border-nate-grey-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-nate-grey-400"
          >
            {MONTHS.map((m, i) => (
              <option key={m} value={i}>{m}</option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="border border-nate-grey-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-nate-grey-400"
          >
            {Array.from({ length: 7 }, (_, i) => now.getFullYear() - 4 + i).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <div className="flex">
            <button onClick={() => shift(-1)} aria-label="Previous month" className="w-8 h-8 grid place-items-center rounded-l-lg border border-nate-grey-200 text-nate-grey-600 hover:bg-nate-grey-100">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={() => shift(1)} aria-label="Next month" className="w-8 h-8 grid place-items-center rounded-r-lg border border-l-0 border-nate-grey-200 text-nate-grey-600 hover:bg-nate-grey-100">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <p className="text-xs text-nate-grey-500 mb-3">
        <span className="font-semibold text-red-600">{absent.size}</span> day{absent.size === 1 ? "" : "s"} absent in {MONTHS[month]} {year}. Tap a day to toggle.
      </p>

      <div className="relative">
        {loading && (
          <div className="absolute inset-0 bg-white/60 grid place-items-center z-10">
            <Loader2 className="w-5 h-5 animate-spin text-nate-grey-400" />
          </div>
        )}
        <div className="grid grid-cols-7 gap-1.5">
          {WEEKDAYS.map((w) => (
            <div key={w} className="text-center text-[10px] uppercase tracking-wide text-nate-grey-400 font-medium py-1">{w}</div>
          ))}
          {cells.map((d, i) => {
            if (d === null) return <div key={`b${i}`} />;
            const ds = dateStr(year, month, d);
            const isAbsent = absent.has(ds);
            const isToday = ds === todayDs;
            return (
              <button
                key={ds}
                onClick={() => toggle(ds)}
                disabled={busy === ds}
                title={isAbsent ? "Absent — tap to mark present" : "Present — tap to mark absent"}
                className={`aspect-square rounded-lg text-sm font-medium flex items-center justify-center transition-colors disabled:opacity-50 ${
                  isAbsent
                    ? "bg-red-600 text-white hover:bg-red-700"
                    : "bg-nate-grey-50 text-nate-grey-700 hover:bg-nate-grey-200"
                } ${isToday ? "ring-2 ring-nate-grey-900 ring-offset-1" : ""}`}
              >
                {d}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-4 mt-4 text-[11px] text-nate-grey-500">
        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-600 inline-block" /> Absent</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-nate-grey-50 border border-nate-grey-200 inline-block" /> Present</span>
        <span className="text-nate-grey-400">· {salesmanName}</span>
      </div>
    </div>
  );
}
