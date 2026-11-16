import { ProductCard, type ProductSpec } from "@/components/ui/ProductCard";
import { SectionHead, WRAP } from "./ui";

export interface RailProduct {
  id: string;
  slug: string;
  name: string;
  price: number;
  comparePrice: number | null;
  imageUrl: string;
  categoryName?: string;
  isNew: boolean;
  isDemo: boolean;
  specs: ProductSpec[];
}

/** A row of product cards. Hidden when there's nothing to show. */
export function ProductRail({
  number,
  title,
  intro,
  link,
  products,
}: {
  number: string;
  title: string;
  intro?: string;
  link?: { label: string; href: string };
  products: RailProduct[];
}) {
  if (!products.length) return null;
  return (
    <section className={`${WRAP} pb-14 md:pb-20`}>
      <SectionHead number={number} title={title} intro={intro} link={link} />
      <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 md:grid-cols-4">
        {products.slice(0, 8).map((p) => (
          <ProductCard
            key={p.id}
            id={p.id}
            slug={p.slug}
            name={p.name}
            price={p.price}
            comparePrice={p.comparePrice}
            imageUrl={p.imageUrl}
            categoryName={p.categoryName}
            isNew={p.isNew}
            isDemo={p.isDemo}
            specs={p.specs}
          />
        ))}
      </div>
    </section>
  );
}
