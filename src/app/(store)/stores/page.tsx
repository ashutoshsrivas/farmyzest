export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { db } from "@/lib/db";
import { STORE_ADDRESS, STORE_PHONE } from "@/lib/company";

export const metadata: Metadata = { title: "Our Stores — Farmyzest" };

// Reads showroom locations from db.location (type SHOWROOM, isPublic true).
// Falls back to two placeholder rows if the table is empty — admin can flip
// `isPublic` on real rows and the editorial defaults disappear.

const FALLBACK_STORES = [
  {
    id: "fallback-1",
    name: "Nidhi Enterprises — Main Store",
    address: STORE_ADDRESS,
    city: null,
    state: null,
    pincode: null,
    phone: STORE_PHONE,
    hours: "9:30 AM – 7:30 PM, Mon–Sat",
  },
];

function googleMapsLink(store: {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
}) {
  const q = [store.address, store.city, store.state, store.pincode]
    .filter(Boolean)
    .join(", ");
  if (!q) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

export default async function StoresPage() {
  const dbStores = await db.location.findMany({
    where: { type: "SHOWROOM", isActive: true, isPublic: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      address: true,
      city: true,
      state: true,
      pincode: true,
      phone: true,
      hours: true,
    },
  });

  const stores = dbStores.length > 0 ? dbStores : FALLBACK_STORES;

  return (
    <div className="min-h-screen">
      <div className="bg-nate-grey-800 text-white py-16">
        <div className="w-full px-6 md:px-12 lg:px-20 xl:px-24">
          <h1 className="text-4xl md:text-5xl font-serif">Our Stores</h1>
        </div>
      </div>

      <div className="w-full px-6 md:px-12 lg:px-20 xl:px-24 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl">
          {stores.map((store) => {
            const maps = googleMapsLink(store);
            return (
              <div key={store.id} className="bg-white rounded-lg p-8">
                <h2 className="text-xl font-serif mb-4">{store.name}</h2>
                <div className="space-y-2 text-nate-grey-600">
                  {store.address && <p>{store.address}</p>}
                  {(store.city || store.state || store.pincode) && (
                    <p>
                      {[store.city, store.state, store.pincode]
                        .filter(Boolean)
                        .join(", ")
                        .replace(/, ([0-9]{6})$/, " — $1")}
                    </p>
                  )}
                  {store.phone && (
                    <p className="pt-2">
                      <span className="font-medium">Phone:</span>{" "}
                      <a href={`tel:${store.phone}`} className="hover:text-accent">
                        {store.phone}
                      </a>
                    </p>
                  )}
                  {store.hours && (
                    <p>
                      <span className="font-medium">Hours:</span> {store.hours}
                    </p>
                  )}
                </div>
                {maps && (
                  <a
                    href={maps}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-6 inline-block text-accent hover:underline"
                  >
                    Get Directions →
                  </a>
                )}
              </div>
            );
          })}
        </div>

        {dbStores.length === 0 && (
          <p className="mt-12 text-xs text-nate-grey-400 max-w-4xl">
            Displaying placeholder locations. Admins can add real stores via the
            Locations table (set <code>isPublic=true</code> to surface them here).
          </p>
        )}
      </div>
    </div>
  );
}
