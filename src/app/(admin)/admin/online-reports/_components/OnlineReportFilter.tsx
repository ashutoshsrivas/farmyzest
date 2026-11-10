"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const ymd = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const PRESETS: { label: string; days: number }[] = [
  { label: "7D", days: 7 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
  { label: "1Y", days: 365 },
];

export function OnlineReportFilter({ from, to }: { from: string; to: string }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [fromLocal, setFromLocal] = useState(from);
  const [toLocal, setToLocal] = useState(to);

  function push(f: string, t: string) {
    const params = new URLSearchParams(sp.toString());
    params.set("from", f);
    params.set("to", t);
    router.push(`/admin/online-reports?${params.toString()}`);
  }

  function preset(days: number) {
    const t = new Date();
    const f = new Date();
    f.setDate(f.getDate() - (days - 1));
    setFromLocal(ymd(f));
    setToLocal(ymd(t));
    push(ymd(f), ymd(t));
  }

  const today = ymd(new Date());

  return (
    <div className="bg-white rounded-xl border border-nate-grey-200 p-3 mb-5 flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-[10px] uppercase tracking-wider text-nate-grey-500 font-medium">From</label>
        <input
          type="date"
          value={fromLocal}
          max={toLocal || today}
          onChange={(e) => setFromLocal(e.target.value)}
          onBlur={() => fromLocal && push(fromLocal, toLocal)}
          className="border border-nate-grey-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-nate-grey-400"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[10px] uppercase tracking-wider text-nate-grey-500 font-medium">To</label>
        <input
          type="date"
          value={toLocal}
          max={today}
          onChange={(e) => setToLocal(e.target.value)}
          onBlur={() => toLocal && push(fromLocal, toLocal)}
          className="border border-nate-grey-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-nate-grey-400"
        />
      </div>
      <div className="flex gap-1.5 ml-auto">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => preset(p.days)}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-nate-grey-200 text-nate-grey-600 hover:bg-nate-grey-100"
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
