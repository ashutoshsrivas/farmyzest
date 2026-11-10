export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { CategoriesTree } from "./_components/CategoriesTree";

export default async function CategoriesPage() {
  const session = await auth();
  if (!session) redirect("/auth/login");

  const categories = await db.category.findMany({
    orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }],
    include: { _count: { select: { products: true, taggedProducts: true } } },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-serif text-nate-grey-800">Categories</h1>
      </div>

      <CategoriesTree categories={categories} />
    </div>
  );
}