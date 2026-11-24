export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { db } from "@/lib/db";
import { ShopNeedsManager } from "./_components/ShopNeedsManager";

export default async function ShopByNeedPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/auth/login");

  const needs = await db.shopNeed.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-serif text-nate-grey-800">Shop by need</h1>
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-nate-grey-600 hover:text-nate-grey-900 transition-colors"
        >
          View homepage
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
      <p className="text-sm text-nate-grey-500 mb-8 max-w-2xl">
        The photo cards near the top of the homepage. Each card links to a shop page — usually a category, like
        <code className="mx-1 font-mono text-xs bg-nate-grey-100 px-1 py-0.5 rounded">/shop?category=spray-pumps</code>.
        Hidden cards stay saved but don&apos;t show on the site.
      </p>
      <ShopNeedsManager
        initial={needs.map((n) => ({
          id: n.id,
          title: n.title,
          body: n.body,
          href: n.href,
          imageUrl: n.imageUrl,
          enabled: n.enabled,
        }))}
      />
    </div>
  );
}
