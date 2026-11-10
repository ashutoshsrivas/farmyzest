export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { Plus, ReceiptText, AlertCircle } from "lucide-react";
import AdminPagination from "@/components/admin/Pagination";
import { DeleteBillButton } from "./_components/BillActions";

const PAGE_SIZE = 25;

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  PARTIAL: "bg-blue-100 text-blue-800",
  PAID: "bg-green-100 text-green-800",
  OVERDUE: "bg-red-100 text-red-800",
};

function inr(n: number) {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

export default async function PurchasesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string; supplierId?: string }>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/auth/login");

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const skip = (page - 1) * PAGE_SIZE;

  const where: Prisma.SupplierBillWhereInput = {
    ...(params.status
      ? { status: params.status as Prisma.SupplierBillWhereInput["status"] }
      : {}),
    ...(params.supplierId ? { supplierId: params.supplierId } : {}),
  };

  const [bills, total, payableAgg] = await Promise.all([
    db.supplierBill.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: PAGE_SIZE,
      include: {
        supplier: { select: { id: true, name: true } },
        _count: { select: { items: true } },
      },
    }),
    db.supplierBill.count({ where }),
    db.supplierBill.aggregate({
      _sum: { total: true },
      where: { status: { in: ["PENDING", "PARTIAL", "OVERDUE"] } },
    }),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const totalPayable = payableAgg._sum.total ?? 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-8 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-serif text-nate-grey-800">Purchases</h1>
          <p className="text-sm text-nate-grey-500 mt-1">
            Supplier bills — recording one updates stock + cost price
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-nate-grey-500">
            {total} bill{total === 1 ? "" : "s"}
          </span>
          {totalPayable > 0 && (
            <span className="text-sm text-red-700 font-medium flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              {inr(totalPayable)} payable
            </span>
          )}
          <Link
            href="/admin/purchases/new"
            className="flex items-center gap-2 px-4 py-2 bg-nate-grey-800 text-white rounded-lg text-sm font-medium hover:bg-nate-grey-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Supplier Bill
          </Link>
        </div>
      </div>

      {bills.length === 0 ? (
        <div className="bg-white rounded-xl p-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-nate-grey-100 flex items-center justify-center mx-auto mb-4">
            <ReceiptText className="w-7 h-7 text-nate-grey-400" />
          </div>
          <h2 className="font-serif text-lg text-nate-grey-800 mb-1">
            No supplier bills yet
          </h2>
          <p className="text-sm text-nate-grey-500 mb-5">
            Record a purchase to bring stock in and snapshot cost prices.
          </p>
          <Link
            href="/admin/purchases/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-nate-grey-800 text-white rounded-lg text-sm font-medium hover:bg-nate-grey-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Supplier Bill
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-nate-grey-50 border-b border-nate-grey-200">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-nate-grey-500 uppercase tracking-wide">
                  Bill #
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-nate-grey-500 uppercase tracking-wide">
                  Supplier
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-nate-grey-500 uppercase tracking-wide">
                  Ref #
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-nate-grey-500 uppercase tracking-wide">
                  Date
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-nate-grey-500 uppercase tracking-wide">
                  Items
                </th>
                <th className="text-right px-6 py-3 text-xs font-medium text-nate-grey-500 uppercase tracking-wide">
                  Total
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-nate-grey-500 uppercase tracking-wide">
                  Status
                </th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-nate-grey-100">
              {bills.map((bill) => (
                <tr
                  key={bill.id}
                  className="hover:bg-nate-grey-50 transition-colors"
                >
                  <td className="px-6 py-4 font-mono text-xs text-nate-grey-700">
                    {bill.billNumber}
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-medium text-nate-grey-800">
                      {bill.supplier.name}
                    </p>
                  </td>
                  <td className="px-6 py-4 text-nate-grey-500 text-xs font-mono">
                    {bill.refBillNo ?? "—"}
                  </td>
                  <td className="px-6 py-4 text-nate-grey-600">
                    {new Date(bill.date).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-6 py-4 text-nate-grey-600">
                    {bill._count.items}
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-nate-grey-800">
                    {inr(bill.total)}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`text-xs px-2 py-1 rounded-full font-medium ${
                        STATUS_COLORS[bill.status] ?? "bg-nate-grey-100 text-nate-grey-600"
                      }`}
                    >
                      {bill.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/admin/purchases/${bill.id}`}
                        className="text-accent hover:text-nate-grey-800 text-xs font-medium"
                      >
                        View →
                      </Link>
                      <DeleteBillButton billId={bill.id} billNumber={bill.billNumber} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <AdminPagination
            page={page}
            totalPages={totalPages}
            total={total}
            pageSize={PAGE_SIZE}
          />
        </div>
      )}
    </div>
  );
}
