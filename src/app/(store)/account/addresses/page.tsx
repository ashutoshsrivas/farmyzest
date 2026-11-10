import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { AddressManager } from "@/components/account/AddressManager";

export default async function AddressesPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");

  const addresses = await db.address.findMany({
    where: { userId: session.user.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });

  return (
    <>
      {/* The (store)/account layout provides the page background, max-width
          container, and sidebar. We render only the content column here. */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-serif text-nate-grey-800">Saved Addresses</h1>
        <Link
          href="/account"
          className="text-sm text-nate-grey-500 hover:text-accent transition-colors"
        >
          ← Back to Account
        </Link>
      </div>

      <AddressManager
        initialAddresses={addresses.map((a) => ({
          id: a.id,
          name: a.name,
          phone: a.phone,
          line1: a.line1,
          line2: a.line2,
          city: a.city,
          state: a.state,
          pincode: a.pincode,
          isDefault: a.isDefault,
        }))}
      />
    </>
  );
}