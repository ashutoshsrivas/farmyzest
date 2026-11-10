import { db } from "@/lib/db";
import GoodsReturnForm from "../GoodsReturnForm";

export const dynamic = "force-dynamic";

export default async function SupplierReturnPage() {
  const suppliers = await db.supplier.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return <GoodsReturnForm kind="SUPPLIER" suppliers={suppliers} />;
}
