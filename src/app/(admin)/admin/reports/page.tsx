export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ReportsExplorer } from "./_components/ReportsExplorer";

export default async function ReportsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/auth/login");

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-serif text-nate-grey-800">Reports</h1>
        <p className="text-sm text-nate-grey-500 mt-1">
          Live data across every part of the business. Pick a report, set a date range, view it, and download CSV.
        </p>
      </div>
      <ReportsExplorer />
    </div>
  );
}
