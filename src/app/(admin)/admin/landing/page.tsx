export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { db } from "@/lib/db";
import { LandingBuilder } from "./_components/LandingBuilder";

export default async function LandingPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/auth/login");

  const [sections, collections, categories] = await Promise.all([
    db.homeSection.findMany({ orderBy: { sortOrder: "asc" } }),
    db.collection.findMany({
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, slug: true },
    }),
    db.category.findMany({
      orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }],
      select: { id: true, name: true, slug: true, parentId: true },
    }),
  ]);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-serif text-nate-grey-800">Landing Page</h1>
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

      <LandingBuilder
        sections={sections.map((s) => ({
          id: s.id,
          type: s.type,
          enabled: s.enabled,
          sortOrder: s.sortOrder,
          config:
            s.config && typeof s.config === "object" && !Array.isArray(s.config)
              ? (s.config as Record<string, unknown>)
              : {},
        }))}
        collections={collections}
        categories={categories}
      />
    </div>
  );
}
