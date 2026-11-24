export const dynamic = "force-dynamic";

import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { getHomeContent } from "@/lib/home-content-server";
import { HomeContentEditor } from "./_components/HomeContentEditor";

export default async function HomepageContentPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/auth/login");
  const content = await getHomeContent();

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-serif text-nate-grey-800">Homepage content</h1>
        <a href="/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-nate-grey-600 hover:text-nate-grey-900">
          View homepage <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
      <p className="text-sm text-nate-grey-500 mb-8 max-w-3xl">
        Every heading, line of text, button and photo on the homepage, top to bottom. The photo cards under
        “Shop by need” are edited on <Link href="/admin/shop-by-need" className="underline">Shop by Need</Link>; the
        departments, collections and products come from the catalogue. The garden landscape can be switched off in{" "}
        <Link href="/admin/settings" className="underline">Settings</Link>.
      </p>
      <HomeContentEditor initial={content} />
    </div>
  );
}
