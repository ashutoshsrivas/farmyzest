export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { BrandsManager } from "./_components/BrandsManager";

export default async function BrandsPage() {
  const session = await auth();
  if (!session) redirect("/auth/login");

  const brands = await db.brand.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { products: true } } },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-serif text-nate-grey-800">Brands</h1>
      </div>

      <BrandsManager brands={brands} />
    </div>
  );
}
