export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { isStoreBoardAuthed } from "@/lib/store-board-auth";
import { StoreBoardNav } from "./_components/StoreBoardNav";
import { PackageSearch, ChevronRight } from "lucide-react";

export default async function StoreBoardDashboard() {
  if (!(await isStoreBoardAuthed())) redirect("/store-board/login");

  const productCount = await db.product.count({ where: { status: "ACTIVE" } });

  return (
    <div className="max-w-md mx-auto px-4 pt-6 pb-24">
      <div className="mb-5">
        <h1 className="text-2xl font-serif text-nate-grey-900">Store Board</h1>
        <p className="text-sm text-nate-grey-500 mt-0.5">{productCount.toLocaleString("en-IN")} active products</p>
      </div>

      <Link
        href="/store-board/products"
        className="flex items-center gap-3 bg-nate-grey-900 text-white rounded-2xl px-5 py-4 active:scale-[0.99] transition"
      >
        <PackageSearch className="w-6 h-6" />
        <div className="flex-1">
          <p className="font-semibold">Search Stock</p>
          <p className="text-xs text-white/60">Find a product by name or scan a code</p>
        </div>
        <ChevronRight className="w-5 h-5 text-white/60" />
      </Link>

      <StoreBoardNav />
    </div>
  );
}
