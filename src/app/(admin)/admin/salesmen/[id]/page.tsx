export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { earningsForSalesman } from "@/lib/salesman-earnings";
import { CommissionLedger } from "../_components/CommissionLedger";
import { SalesmanOrdersModal } from "../_components/SalesmanOrdersModal";
import { AttendanceCalendar } from "../_components/AttendanceCalendar";
import { EarningsRangeFilter } from "../_components/EarningsRangeFilter";

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

export default async function SalesmanDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/auth/login");
  const { id } = await params;
  const { from, to } = await searchParams;

  const salesman = await db.salesman.findUnique({ where: { id } });
  if (!salesman) notFound();

  // Optional date window (from/to are yyyy-mm-dd, local midnight → next-day
  // midnight exclusive). Empty = all-time. Scopes every summary figure and the
  // payments list so the whole ledger reflects the chosen period.
  const window: { gte?: Date; lt?: Date } = {};
  if (from) {
    const d = new Date(from);
    if (!isNaN(d.getTime())) { d.setHours(0, 0, 0, 0); window.gte = d; }
  }
  if (to) {
    const d = new Date(to);
    if (!isNaN(d.getTime())) { d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + 1); window.lt = d; }
  }
  const ranged = !!(window.gte || window.lt);

  const [earning, payments] = await Promise.all([
    earningsForSalesman(id, window),
    db.salesmanPayment.findMany({
      where: {
        salesmanId: id,
        ...(ranged ? { paidAt: { ...(window.gte ? { gte: window.gte } : {}), ...(window.lt ? { lt: window.lt } : {}) } } : {}),
      },
      orderBy: { paidAt: "desc" },
    }),
  ]);

  const paid = payments.reduce((s, p) => s + p.amount, 0);
  const pending = Math.round((earning.earned - paid) * 100) / 100;
  const periodNote = ranged ? "in selected period" : undefined;

  return (
    <div>
      <Link href="/admin/salesmen" className="inline-flex items-center gap-1 text-sm text-nate-grey-500 hover:text-nate-grey-800 mb-4">
        <ArrowLeft className="w-4 h-4" /> Salesmen
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-serif text-nate-grey-800">{salesman.name}</h1>
          <p className="text-sm text-nate-grey-500 mt-1">
            {salesman.phone || "—"} · {salesman.commissionRate}% commission
            {salesman.isActive ? "" : " · inactive"}
          </p>
        </div>
        <SalesmanOrdersModal salesmanId={id} salesmanName={salesman.name} />
      </div>

      <div className="mb-6">
        <AttendanceCalendar salesmanId={id} salesmanName={salesman.name} />
      </div>

      {/* Date-range selector — scopes the four figures below to a period. */}
      <EarningsRangeFilter from={from ?? ""} to={to ?? ""} />

      {/* Earnings + payout summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <SummaryCard label="Total Earned" value={inr(earning.earned)} sub={`Commission on ${inr(earning.sales)} bill value`} />
        <SummaryCard label="Total Paid" value={inr(paid)} sub={`${payments.length} payout${payments.length === 1 ? "" : "s"}${periodNote ? ` ${periodNote}` : ""}`} />
        <SummaryCard label="Pending" value={inr(pending)} tone={pending > 0 ? "amber" : "green"} sub={periodNote ?? (pending > 0 ? "Owed to salesman" : "Settled up")} />
        <SummaryCard label="POS Sales" value={inr(earning.sales)} sub={`${earning.orders} billed orders${periodNote ? ` ${periodNote}` : ""}`} />
      </div>

      <CommissionLedger
        salesmanId={id}
        salesmanName={salesman.name}
        earned={earning.earned}
        paid={paid}
        pending={pending}
        payments={payments.map((p) => ({
          id: p.id,
          amount: p.amount,
          method: p.method,
          reference: p.reference,
          note: p.note,
          paidAt: p.paidAt.toISOString(),
        }))}
      />
    </div>
  );
}

function SummaryCard({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "amber" | "green" }) {
  return (
    <div className="bg-white rounded-xl border border-nate-grey-200 p-4">
      <p className="text-[10px] uppercase tracking-wide text-nate-grey-400 font-medium">{label}</p>
      <p className={`font-serif text-xl tabular-nums mt-1 ${tone === "amber" ? "text-amber-600" : tone === "green" ? "text-green-600" : "text-nate-grey-900"}`}>
        {value}
      </p>
      {sub && <p className="text-[11px] text-nate-grey-400 mt-0.5 truncate">{sub}</p>}
    </div>
  );
}
