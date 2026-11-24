import { db } from "@/lib/db";

export interface ShopNeedCard {
  id: string;
  title: string;
  body: string;
  href: string;
  imageUrl: string | null;
}

/** Enabled "Shop by need" cards for the homepage, in admin order. */
export async function getShopNeeds(): Promise<ShopNeedCard[]> {
  return db.shopNeed.findMany({
    where: { enabled: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, title: true, body: true, href: true, imageUrl: true },
  });
}
