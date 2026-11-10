export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { OnlineReportFilter } from "./_components/OnlineReportFilter";
import {
  Users,
  MousePointerClick,
  Eye,
  Timer,
  Globe,
  ShoppingBag,
  IndianRupee,
  Target,
  Smartphone,
  Repeat,
  Layers,
  TrendingUp,
} from "lucide-react";

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
const num = (n: number) => n.toLocaleString("en-IN");
const pct = (n: number) => `${(n * 100).toFixed(n >= 0.1 ? 0 : 1)}%`;
const ymd = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
function fmtDuration(ms: number) {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m < 60) return `${m}m ${rem}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export default async function OnlineReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/auth/login");

  const sp = await searchParams;
  const to = sp.to ? new Date(sp.to) : new Date();
  to.setHours(23, 59, 59, 999);
  const from = sp.from ? new Date(sp.from) : new Date(Date.now() - 29 * 86400_000);
  from.setHours(0, 0, 0, 0);
  const fromStr = ymd(from);
  const toStr = ymd(to);

  const [sessions, orderAgg, totalSessionsEver] = await Promise.all([
    db.visitSession.findMany({
      where: { startedAt: { gte: from, lte: to } },
      select: {
        visitorId: true,
        startedAt: true,
        durationMs: true,
        pageviews: true,
        device: true,
        isReturning: true,
        landingPath: true,
        referrer: true,
      },
      take: 100_000,
    }),
    db.order.aggregate({
      where: { source: "ONLINE", status: { notIn: ["CANCELLED", "RETURNED"] }, createdAt: { gte: from, lte: to } },
      _sum: { total: true },
      _count: { _all: true },
    }),
    db.visitSession.count(),
  ]);

  // ── Aggregate traffic ──────────────────────────────────────────────────
  const sessionCount = sessions.length;
  const visitorSet = new Set<string>();
  let pageviews = 0;
  let durationTotal = 0;
  let bounces = 0;
  let newSessions = 0;
  const deviceCounts: Record<string, number> = { mobile: 0, desktop: 0, tablet: 0 };
  const landingCounts = new Map<string, number>();
  const referrerCounts = new Map<string, number>();
  // Daily buckets
  const dayMap = new Map<string, { sessions: number; visitors: Set<string> }>();

  for (const s of sessions) {
    visitorSet.add(s.visitorId);
    pageviews += s.pageviews;
    durationTotal += s.durationMs;
    if (s.pageviews <= 1) bounces += 1;
    if (!s.isReturning) newSessions += 1;
    if (s.device && deviceCounts[s.device] !== undefined) deviceCounts[s.device] += 1;
    const lp = s.landingPath || "/";
    landingCounts.set(lp, (landingCounts.get(lp) ?? 0) + 1);
    const rf = s.referrer || "direct";
    referrerCounts.set(rf, (referrerCounts.get(rf) ?? 0) + 1);
    const key = ymd(new Date(s.startedAt));
    let b = dayMap.get(key);
    if (!b) { b = { sessions: 0, visitors: new Set() }; dayMap.set(key, b); }
    b.sessions += 1;
    b.visitors.add(s.visitorId);
  }

  const visitors = visitorSet.size;
  const avgDuration = sessionCount ? durationTotal / sessionCount : 0;
  const pagesPerSession = sessionCount ? pageviews / sessionCount : 0;
  const bounceRate = sessionCount ? bounces / sessionCount : 0;
  const returningSessions = sessionCount - newSessions;

  // Daily trend array (every day in range, zero-filled).
  const days: { date: string; sessions: number; visitors: number }[] = [];
  for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
    const key = ymd(d);
    const b = dayMap.get(key);
    days.push({ date: key, sessions: b?.sessions ?? 0, visitors: b?.visitors.size ?? 0 });
  }
  const maxDay = Math.max(1, ...days.map((d) => d.visitors));

  const topLanding = [...landingCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const topReferrers = [...referrerCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

  // ── Commerce ───────────────────────────────────────────────────────────
  const onlineOrders = orderAgg._count._all;
  const onlineSales = orderAgg._sum.total ?? 0;
  const onlineAOV = onlineOrders ? onlineSales / onlineOrders : 0;
  const conversion = sessionCount ? onlineOrders / sessionCount : 0;

  const noData = totalSessionsEver === 0;

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-serif text-nate-grey-800">Online Reports</h1>
        <p className="text-sm text-nate-grey-500 mt-1">
          Storefront traffic and online sales. Visitor metrics are tracked first-party and anonymous — they begin from the
          day tracking went live, so early ranges may be sparse.
        </p>
      </div>

      <OnlineReportFilter from={fromStr} to={toStr} />

      {noData && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 mb-5 text-sm">
          No visit data yet. Traffic starts accumulating as soon as customers browse the storefront — check back shortly.
          Online order figures below are historical and already accurate.
        </div>
      )}

      {/* ── Traffic ─────────────────────────────────────────────────── */}
      <SectionLabel>Site traffic</SectionLabel>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
        <Stat icon={Users} label="Visitors" value={num(visitors)} sub={`${num(newSessions)} new · ${num(returningSessions)} returning`} accent="text-blue-600" bar="bg-blue-500" />
        <Stat icon={MousePointerClick} label="Sessions" value={num(sessionCount)} sub={`${pagesPerSession.toFixed(1)} pages / session`} accent="text-indigo-600" bar="bg-indigo-500" />
        <Stat icon={Eye} label="Pageviews" value={num(pageviews)} sub="total across range" accent="text-violet-600" bar="bg-violet-500" />
        <Stat icon={Timer} label="Avg time on site" value={fmtDuration(avgDuration)} sub={`${pct(bounceRate)} bounce rate`} accent="text-teal-600" bar="bg-teal-500" />
      </div>

      {/* Daily trend + device split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-nate-grey-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] uppercase tracking-wider text-nate-grey-500 font-medium flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" /> Daily visitors
            </p>
            <p className="text-[11px] text-nate-grey-400">{days.length} days</p>
          </div>
          <TrendChart days={days} max={maxDay} />
        </div>
        <div className="bg-white rounded-xl border border-nate-grey-200 p-4">
          <p className="text-[11px] uppercase tracking-wider text-nate-grey-500 font-medium flex items-center gap-1.5 mb-3">
            <Smartphone className="w-3.5 h-3.5" /> Devices
          </p>
          <DeviceBars counts={deviceCounts} total={sessionCount} />
        </div>
      </div>

      {/* ── Online commerce ─────────────────────────────────────────── */}
      <SectionLabel>Online sales</SectionLabel>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Stat icon={ShoppingBag} label="Online Orders" value={num(onlineOrders)} sub="excl. cancelled" accent="text-nate-grey-900" bar="bg-nate-grey-900" />
        <Stat icon={IndianRupee} label="Online Sales" value={inr(onlineSales)} sub="net revenue" accent="text-green-600" bar="bg-green-500" />
        <Stat icon={Globe} label="Avg Order Value" value={inr(onlineAOV)} sub="per online order" accent="text-amber-600" bar="bg-amber-500" />
        <Stat icon={Target} label="Conversion" value={pct(conversion)} sub="orders ÷ sessions" accent="text-rose-600" bar="bg-rose-500" />
      </div>

      {/* ── Breakdown tables ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <RankTable title="Top landing pages" icon={Layers} rows={topLanding} total={sessionCount} mono />
        <RankTable title="Top referrers" icon={Repeat} rows={topReferrers} total={sessionCount} />
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] uppercase tracking-wider text-nate-grey-400 font-medium mb-2">{children}</p>;
}

function Stat({
  icon: Icon,
  label,
  value,
  sub,
  accent,
  bar,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  accent: string;
  bar: string;
}) {
  return (
    <div className="relative bg-white rounded-xl border border-nate-grey-200 p-4 overflow-hidden">
      <span className={`absolute left-0 top-0 h-full w-1 ${bar}`} />
      <div className="flex items-start justify-between">
        <p className="text-[10px] uppercase tracking-wide text-nate-grey-400 font-medium">{label}</p>
        <Icon className={`w-4 h-4 ${accent} opacity-70`} />
      </div>
      <p className={`font-serif text-2xl tabular-nums mt-1 ${accent}`}>{value}</p>
      {sub && <p className="text-[11px] text-nate-grey-400 mt-0.5 truncate">{sub}</p>}
    </div>
  );
}

function TrendChart({ days, max }: { days: { date: string; sessions: number; visitors: number }[]; max: number }) {
  // Sparse x labels (~6 across).
  const step = Math.max(1, Math.floor(days.length / 6));
  return (
    <div>
      <div className="flex items-end gap-[2px] h-32">
        {days.map((d, i) => {
          const h = d.visitors > 0 ? Math.max(3, Math.round((d.visitors / max) * 124)) : 2;
          const dt = new Date(d.date);
          return (
            <div
              key={d.date}
              className="flex-1 group relative flex flex-col justify-end"
              title={`${dt.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · ${d.visitors} visitors · ${d.sessions} sessions`}
            >
              <div
                className={`w-full rounded-t ${d.visitors > 0 ? "bg-blue-400 group-hover:bg-blue-600" : "bg-nate-grey-100"} transition-colors`}
                style={{ height: `${h}px` }}
              />
              {i % step === 0 && (
                <span className="absolute -bottom-5 left-0 text-[9px] text-nate-grey-400 whitespace-nowrap">
                  {dt.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="h-5" />
    </div>
  );
}

function DeviceBars({ counts, total }: { counts: Record<string, number>; total: number }) {
  const order: { key: string; label: string; color: string }[] = [
    { key: "mobile", label: "Mobile", color: "bg-blue-500" },
    { key: "desktop", label: "Desktop", color: "bg-indigo-500" },
    { key: "tablet", label: "Tablet", color: "bg-teal-500" },
  ];
  return (
    <div className="space-y-3">
      {order.map((d) => {
        const v = counts[d.key] ?? 0;
        const share = total ? v / total : 0;
        return (
          <div key={d.key}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-nate-grey-600">{d.label}</span>
              <span className="text-nate-grey-400 tabular-nums">{num(v)} · {pct(share)}</span>
            </div>
            <div className="h-2 rounded-full bg-nate-grey-100 overflow-hidden">
              <div className={`h-full rounded-full ${d.color}`} style={{ width: `${Math.round(share * 100)}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RankTable({
  title,
  icon: Icon,
  rows,
  total,
  mono,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  rows: [string, number][];
  total: number;
  mono?: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-nate-grey-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-nate-grey-100 flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5 text-nate-grey-400" />
        <p className="text-[11px] uppercase tracking-wider text-nate-grey-500 font-medium">{title}</p>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-nate-grey-400">No data yet.</p>
      ) : (
        <ul className="divide-y divide-nate-grey-100">
          {rows.map(([key, count]) => {
            const share = total ? count / total : 0;
            return (
              <li key={key} className="px-4 py-2.5 flex items-center gap-3">
                <span className={`flex-1 truncate text-sm text-nate-grey-700 ${mono ? "font-mono text-xs" : ""}`} title={key}>
                  {key}
                </span>
                <div className="w-20 h-1.5 rounded-full bg-nate-grey-100 overflow-hidden hidden sm:block">
                  <div className="h-full bg-nate-grey-400 rounded-full" style={{ width: `${Math.round(share * 100)}%` }} />
                </div>
                <span className="text-xs text-nate-grey-500 tabular-nums w-10 text-right">{num(count)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
