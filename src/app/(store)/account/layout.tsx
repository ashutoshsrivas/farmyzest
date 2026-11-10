import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { AccountSidebar } from "@/components/account/AccountSidebar";

// Shared layout for every route under (store)/account/.
//
// Before this layout existed, the sidebar nav was hand-rolled into
// `account/page.tsx` only — so /account/orders, /account/addresses, and
// /account/orders/[id] rendered with no sidebar and no consistent shell.
// Pages below render only their main-content portion; this layout owns:
//   - the auth redirect to /auth/login
//   - the page background
//   - the max-width container
//   - the sidebar column
//
// Defense-in-depth: child pages keep their own auth() checks so a future
// refactor that drops this layout doesn't silently open up account data.

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true },
  });

  if (!user) redirect("/auth/login");

  return (
    <div className="min-h-screen bg-nate-grey-100 py-12 px-4">
      <div className="container mx-auto max-w-6xl">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <aside className="md:col-span-1">
            <AccountSidebar userName={user.name} userEmail={user.email} />
          </aside>
          <main className="md:col-span-3 space-y-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
