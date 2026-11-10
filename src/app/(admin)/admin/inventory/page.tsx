export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { Search } from "lucide-react";
import { db } from "@/lib/db";
import { InventoryTable, InventoryAlerts } from "./_components/InventoryTable";
import AdminPagination from "@/components/admin/Pagination";

// What this page is for: a fast, editable stock ledger. Every product VARIANT
// (size/colour) is one row with its live on-hand quantity — edit numbers inline
// and Save to bulk-update stock. The top block flags everything at/below its
// low-stock threshold so you can reorder. (The Products page is for catalog
// details; this is purely stock levels.)

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200];
const DEFAULT_PAGE_SIZE = 50;

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string; q?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/auth/login");

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const pageSize = PAGE_SIZE_OPTIONS.includes(Number(params.pageSize))
    ? Number(params.pageSize)
    : DEFAULT_PAGE_SIZE;
  const skip = (page - 1) * pageSize;
  const q = params.q?.trim();

  // Search by product name, SKU or barcode.
  const where: Prisma.ProductVariantWhereInput = q
    ? {
        OR: [
          { product: { name: { contains: q, mode: "insensitive" } } },
          { sku: { contains: q, mode: "insensitive" } },
          { barcode: { contains: q, mode: "insensitive" } },
        ],
      }
    : {};

  const [variants, total, lowStockVariants] = await Promise.all([
    db.productVariant.findMany({
      where,
      orderBy: { product: { name: "asc" } },
      skip,
      take: pageSize,
      include: {
        product: { select: { name: true, status: true } },
      },
    }),
    db.productVariant.count({ where }),
    // Low-stock alerts always reflect the WHOLE catalogue, not the current page.
    db.productVariant.findMany({
      where: { stock: { lte: 5 } },
      orderBy: { stock: "asc" },
      take: 100,
      include: {
        product: { select: { name: true } },
      },
    }),
  ]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-serif text-nate-grey-800">Inventory</h1>
        <span className="text-sm text-nate-grey-500">
          {total} variant{total === 1 ? "" : "s"}
          {q ? " match" : ""} · {lowStockVariants.length} low stock
        </span>
      </div>

      {/* Search — jump straight to a product/SKU instead of paging blindly. */}
      <form action="/admin/inventory" method="get" className="relative mb-6 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-nate-grey-400" />
        <input
          type="text"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search product, SKU or barcode…"
          className="w-full bg-white border border-nate-grey-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-nate-grey-400"
        />
        {params.pageSize && <input type="hidden" name="pageSize" value={params.pageSize} />}
      </form>

      {!q && lowStockVariants.length > 0 && (
        <InventoryAlerts variants={lowStockVariants} />
      )}

      <InventoryTable variants={variants} />
      <div className="bg-white rounded-xl overflow-hidden mt-0 border-t border-nate-grey-100">
        <AdminPagination
          page={page}
          totalPages={totalPages}
          total={total}
          pageSize={pageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
        />
      </div>
    </div>
  );
}
