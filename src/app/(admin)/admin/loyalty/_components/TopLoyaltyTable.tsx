"use client";

import { Award } from "lucide-react";

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  loyaltyPoints: number;
  _count: { orders: number };
}

export function TopLoyaltyTable({ customers }: { customers: Customer[] }) {
  return (
    <div>
      {customers.length === 0 ? (
        <p className="text-sm text-nate-grey-500 text-center py-8">No customers with loyalty points yet.</p>
      ) : (
        <div className="space-y-1">
          {customers.map((c, i) => (
            <div
              key={c.id}
              className="flex items-center justify-between px-4 py-3 rounded-lg hover:bg-nate-grey-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  i === 0 ? "bg-yellow-100 text-yellow-700" :
                  i === 1 ? "bg-gray-100 text-gray-600" :
                  i === 2 ? "bg-orange-100 text-orange-700" :
                  "bg-nate-grey-100 text-nate-grey-500"
                }`}>
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-medium text-nate-grey-800">{c.name}</p>
                  <p className="text-xs text-nate-grey-400">{c._count.orders} orders</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-accent" />
                <span className="text-sm font-bold text-nate-grey-800">
                  {Math.floor(c.loyaltyPoints).toLocaleString("en-IN")}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}