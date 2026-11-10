import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { SuppliersTable } from "./_components/SuppliersTable";
import AdminPagination from "@/components/admin/Pagination";

const PAGE_SIZE = 25;

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/auth/login");

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const skip = (page - 1) * PAGE_SIZE;

  const [suppliers, total, bills] = await Promise.all([
    db.supplier.findMany({
      orderBy: { name: "asc" },
      skip,
      take: PAGE_SIZE,
      include: { _count: { select: { bills: true } } },
    }),
    db.supplier.count(),
    db.supplierBill.aggregate({
      where: { status: { not: "PAID" } },
      _sum: { total: true },
    }),
  ]);

  const totalPayable = bills._sum.total || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-serif text-nate-grey-800">Suppliers</h1>
        <span className="text-sm text-nate-grey-500">
          {total} suppliers ·{" "}
          <span className="text-red-600 font-medium">
            Rs.{totalPayable.toLocaleString("en-IN")} payable
          </span>
        </span>
      </div>

      <SuppliersTable suppliers={suppliers} totalPayable={totalPayable} />
      <AdminPagination page={page} totalPages={totalPages} total={total} pageSize={PAGE_SIZE} />
    </div>
  );
}