"use client";

import { useRouter } from "next/navigation";
import { ExchangeFlow } from "@/components/exchange/ExchangeFlow";

// Admin entry point for the phone-based exchange flow. The same component
// powers the POS "Exchange" button — here it opens over the admin shell.
export default function NewExchangePage() {
  const router = useRouter();
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-serif text-nate-grey-800">Exchange</h1>
      <p className="text-sm text-nate-grey-500 mt-1">
        Look up a customer by phone number to start an exchange or return.
      </p>
      <ExchangeFlow
        mode="admin"
        onClose={() => router.push("/admin/orders")}
        onDone={() => router.refresh()}
      />
    </div>
  );
}
