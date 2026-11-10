export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { db } from "@/lib/db";
import { NavigationManager } from "./_components/NavigationManager";

export default async function NavigationPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/auth/login");

  const [links, categories] = await Promise.all([
    db.navLink.findMany({ orderBy: { sortOrder: "asc" } }),
    db.category.findMany({
      where: { parentId: null },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        showInMenu: true,
        menuHighlight: true,
        menuImageUrl: true,
      },
    }),
  ]);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-serif text-nate-grey-800">Navigation</h1>
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-nate-grey-600 hover:text-nate-grey-900 transition-colors"
        >
          View site
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      <NavigationManager links={links} categories={categories} />
    </div>
  );
}
