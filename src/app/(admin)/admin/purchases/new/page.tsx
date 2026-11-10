export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { NewBillForm } from "../_components/NewBillForm";

// Server wrapper: pre-loads the supplier list + category/tax-slab lookups
// (small) so the client form renders instantly. Products are still fetched
// on demand from /api/pos/products via the picker. Categories + tax slabs
// are passed through so the embedded "Quick-create product" modal has the
// dropdowns it needs without a second round-trip.

export default async function NewSupplierBillPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/auth/login");

  const [suppliers, categories, taxSlabs] = await Promise.all([
    db.supplier.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        address: true,
        gstin: true,
      },
    }),
    db.category.findMany({
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
    db.taxSlab.findMany({
      where: { isActive: true },
      orderBy: { percentage: "asc" },
      select: { id: true, name: true, percentage: true },
    }),
  ]);

  return (
    <NewBillForm
      suppliers={suppliers}
      categories={categories}
      taxSlabs={taxSlabs}
    />
  );
}
