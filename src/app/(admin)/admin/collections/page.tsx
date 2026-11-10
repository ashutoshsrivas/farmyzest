export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { CollectionsTable } from "./_components/CollectionsTable";

export default async function CollectionsPage() {
  const session = await auth();
  if (!session) redirect("/auth/login");

  const [collections, categories] = await Promise.all([
    db.collection.findMany({
      orderBy: [{ rankOnHome: "desc" }, { sortOrder: "asc" }],
      include: {
        categories: { select: { categoryId: true, exclusive: true } },
        _count: { select: { products: true, categories: true } },
      },
    }),
    db.category.findMany({
      orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, slug: true, parentId: true },
    }),
  ]);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-serif text-nate-grey-800">Collections</h1>
      </div>

      <CollectionsTable collections={collections} categories={categories} />
    </div>
  );
}