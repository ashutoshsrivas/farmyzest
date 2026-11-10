import { Header1 } from "@/components/layout/Header1";
import { Footer1 } from "@/components/layout/Footer1";
import { CartDrawer } from "@/components/store/CartDrawer";
import { SiteAnalytics } from "@/components/analytics/SiteAnalytics";
import { db } from "@/lib/db";

// Render the storefront dynamically (per request) instead of prerendering at
// build time. The build runs on a CI runner with no access to the private RDS,
// so build-time DB queries here (nav taxonomy) fail. Dynamic rendering also
// keeps catalog/stock fresh. Pages under (store) inherit this mode.
export const dynamic = "force-dynamic";

// Server layout: fetches the nav taxonomy once (top-level categories with
// children + active collections) and hands it to the client header so the
// mega-menu dropdown has data without a client round-trip.
export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [categories, collections, navLinks] = await Promise.all([
    db.category.findMany({
      where: { parentId: null },
      orderBy: { sortOrder: "asc" },
      select: {
        name: true,
        slug: true,
        showInMenu: true,
        menuHighlight: true,
        menuImageUrl: true,
        children: { orderBy: { sortOrder: "asc" }, select: { name: true, slug: true } },
      },
    }),
    db.collection.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: {
        name: true,
        slug: true,
        showInHeader: true,
        showInFooter: true,
        rankOnHome: true,
      },
    }),
    db.navLink.findMany({
      where: { enabled: true },
      orderBy: { sortOrder: "asc" },
      select: { label: true, href: true, newTab: true },
    }),
  ]);

  // "Special Prices" preview tile shown in the bottom-right of the Shop mega
  // menu. Match the dedicated Special-Prices category (by slug/name), falling
  // back to any category that carries a flat discount.
  const specialCat = await db.category.findFirst({
    where: {
      OR: [
        { slug: "special-prices" },
        { slug: "special" },
        { name: { contains: "Special Price", mode: "insensitive" } },
      ],
    },
    select: { slug: true, name: true, discountPct: true, menuImageUrl: true, imageUrl: true },
  });
  let specialPreview: {
    slug: string;
    name: string;
    discountPct: number;
    imageUrl: string | null;
  } | null = null;
  if (specialCat) {
    let img = specialCat.menuImageUrl ?? specialCat.imageUrl ?? null;
    if (!img) {
      // Borrow a product photo from the category so the tile always has an image.
      const p = await db.product.findFirst({
        where: {
          images: { some: {} },
          OR: [
            { category: { slug: specialCat.slug } },
            { categories: { some: { slug: specialCat.slug } } },
          ],
        },
        orderBy: { createdAt: "desc" },
        select: { images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } } },
      });
      img = p?.images[0]?.url ?? null;
    }
    specialPreview = {
      slug: specialCat.slug,
      name: specialCat.name,
      discountPct: specialCat.discountPct && specialCat.discountPct > 0 ? specialCat.discountPct : 35,
      imageUrl: img,
    };
  }

  return (
    <>
      <Header1 categories={categories} collections={collections} navLinks={navLinks} specialPreview={specialPreview} />
      <main className="flex-1 pt-[108px] md:pt-[116px]">{children}</main>
      <Footer1 collections={collections} />
      <CartDrawer />
      <SiteAnalytics />
    </>
  );
}
