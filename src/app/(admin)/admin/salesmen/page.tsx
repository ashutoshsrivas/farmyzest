export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { SalesmenTable } from "./_components/SalesmenTable";
import { AttendanceModal } from "./_components/AttendanceModal";
import AdminPagination from "@/components/admin/Pagination";
import { earningsBySalesman } from "@/lib/salesman-earnings";

const PAGE_SIZE = 25;

export default async function SalesmenPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/auth/login");

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const skip = (page - 1) * PAGE_SIZE;

  const [salesmen, total, totalOrders, earnings, paidGroups] = await Promise.all([
    db.salesman.findMany({
      orderBy: { name: "asc" },
      skip,
      take: PAGE_SIZE,
      include: { _count: { select: { orders: true } } },
    }),
    db.salesman.count(),
    db.order.aggregate({ _count: true, where: { source: "POS" } }),
    earningsBySalesman(),
    db.salesmanPayment.groupBy({ by: ["salesmanId"], _sum: { amount: true } }),
  ]);

  const paidBy = new Map(paidGroups.map((g) => [g.salesmanId, g._sum.amount ?? 0]));
  // Augment each row with its outstanding (earned − paid).
  const rows = salesmen.map((s) => {
    const earned = earnings.get(s.id)?.earned ?? 0;
    const pending = Math.round((earned - (paidBy.get(s.id) ?? 0)) * 100) / 100;
    return { ...s, pending };
  });

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-serif text-nate-grey-800">Salesmen</h1>
        <div className="flex items-center gap-3">
          <AttendanceModal />
          <span className="text-sm text-nate-grey-500">{total} salesmen</span>
        </div>
      </div>

      <SalesmenTable salesmen={rows} totalPosOrders={totalOrders._count} />
      <AdminPagination page={page} totalPages={totalPages} total={total} pageSize={PAGE_SIZE} />
    </div>
  );
}