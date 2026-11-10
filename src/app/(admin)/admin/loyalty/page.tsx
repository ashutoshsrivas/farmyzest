import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { LoyaltyConfigForm } from "./_components/LoyaltyConfigForm";
import { TopLoyaltyTable } from "./_components/TopLoyaltyTable";

export default async function LoyaltyPage() {
  const session = await auth();
  if (!session) redirect("/auth/login");

  const [config, topCustomers] = await Promise.all([
    db.loyaltyConfig.findFirst({ take: 1 }),
    db.user.findMany({
      where: { loyaltyPoints: { gt: 0 } },
      orderBy: { loyaltyPoints: "desc" },
      take: 20,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        loyaltyPoints: true,
        _count: { select: { orders: true } },
      },
    }),
  ]);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-serif text-nate-grey-800">Loyalty Program</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6">
          <h2 className="text-lg font-medium text-nate-grey-800 mb-4">Configuration</h2>
          <LoyaltyConfigForm config={config} />
        </div>

        <div className="bg-white rounded-xl p-6">
          <h2 className="text-lg font-medium text-nate-grey-800 mb-4">Top Customers</h2>
          <TopLoyaltyTable customers={topCustomers} />
        </div>
      </div>
    </div>
  );
}