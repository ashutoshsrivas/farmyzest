import Link from "next/link";

interface Product {
  id: string;
  slug: string;
  name: string;
  onlinePrice: number;
  comparePrice: number | null;
  imageUrl: string;
  categoryName?: string;
  isNew?: boolean;
}

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  return (
    <Link href={`/shop/${product.slug}`} className="group">
      <div className="aspect-square bg-nate-grey-200 rounded-lg overflow-hidden mb-4 relative">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-nate-grey-400">
            No Image
          </div>
        )}
        {product.isNew && (
          <span className="absolute top-3 left-3 bg-nate-grey-800 text-white text-xs px-2 py-1 rounded">
            New
          </span>
        )}
      </div>
      <div>
        {product.categoryName && (
          <p className="text-xs text-nate-grey-500 uppercase tracking-wide mb-1">
            {product.categoryName}
          </p>
        )}
        <h3 className="font-medium text-nate-grey-700 group-hover:text-accent transition-colors">
          {product.name}
        </h3>
        <div className="flex items-center gap-2 mt-2">
          <span
            className={`font-semibold ${
              product.comparePrice && product.comparePrice > product.onlinePrice
                ? "price-special"
                : ""
            }`}
          >
            ₹{product.onlinePrice.toFixed(2)}
          </span>
          {product.comparePrice && product.comparePrice > product.onlinePrice && (
            <span className="text-sm text-nate-grey-400 line-through">
              ₹{product.comparePrice.toFixed(2)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}