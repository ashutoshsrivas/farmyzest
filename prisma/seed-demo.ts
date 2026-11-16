// Sample catalogue for design review — LOCAL ONLY.
//
//   npx tsx prisma/seed-demo.ts            # add/refresh samples
//   npx tsx prisma/seed-demo.ts --remove   # delete every sample row
//
// Every row is flagged `isDemo` (shown with a "Sample" tag), has no brand, no
// photos and no dosage or efficacy claims. Prices are indicative only.
// Refuses to run against a non-local database.

import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

type Spec = { label: string; value: string; unit?: string };
interface Sample {
  name: string;
  category: string; // category slug
  mrp: number;
  price: number;
  tax: "tax-0" | "tax-5" | "tax-12" | "tax-18";
  description: string;
  specs: Spec[];
}

const SAMPLES: Sample[] = [
  // Garden
  { name: "Glazed ceramic planter, 8 inch", category: "ceramic-pots", mrp: 799, price: 649, tax: "tax-18",
    description: "Glazed ceramic pot with a drainage hole and saucer. Suits indoor plants and small shrubs.",
    specs: [{ label: "Diameter", value: "8", unit: "in" }, { label: "Height", value: "7.5", unit: "in" }, { label: "Drainage", value: "Yes" }] },
  { name: "Vermicompost, 5 kg bag", category: "vermicompost", mrp: 299, price: 249, tax: "tax-5",
    description: "Earthworm compost for pots, beds and kitchen gardens. Mix into potting soil or top-dress existing plants.",
    specs: [{ label: "Pack", value: "5", unit: "kg" }, { label: "Type", value: "Organic" }] },
  { name: "Tomato seeds, hybrid, 50 seeds", category: "vegetable-seeds", mrp: 120, price: 99, tax: "tax-0",
    description: "Hybrid tomato for pots and beds. Raise in a nursery tray and transplant at four to five leaves.",
    specs: [{ label: "Seeds", value: "50" }, { label: "Sowing", value: "Nursery" }] },
  { name: "Three-tier metal plant stand", category: "pot-stands", mrp: 1899, price: 1599, tax: "tax-18",
    description: "Powder-coated steel stand with three staggered shelves for balcony and corner displays.",
    specs: [{ label: "Tiers", value: "3" }, { label: "Height", value: "92", unit: "cm" }, { label: "Material", value: "Steel" }] },
  { name: "Hand trowel and fork set", category: "hand-tools", mrp: 449, price: 379, tax: "tax-12",
    description: "Stainless steel trowel and three-prong fork with hardwood handles.",
    specs: [{ label: "Pieces", value: "2" }, { label: "Blade", value: "Stainless steel" }] },
  { name: "Potting mix, 10 kg", category: "potting-mix-soil", mrp: 399, price: 349, tax: "tax-5",
    description: "Ready-to-use mix of soil, cocopeat and compost for containers.",
    specs: [{ label: "Pack", value: "10", unit: "kg" }, { label: "Use", value: "Containers" }] },
  // Farm
  { name: "Petrol brushcutter, 4-stroke", category: "brush-cutters", mrp: 17990, price: 14990, tax: "tax-12",
    description: "Shoulder-strap brushcutter with a straight shaft, nylon head and three-tooth blade.",
    specs: [{ label: "Engine", value: "35.8", unit: "cc" }, { label: "Tank", value: "0.65", unit: "L" }, { label: "Cut", value: "415", unit: "mm" }, { label: "Weight", value: "7.6", unit: "kg" }] },
  { name: "Manual knapsack sprayer, 16 L", category: "knapsack-sprayers", mrp: 1650, price: 1390, tax: "tax-12",
    description: "Side-lever knapsack sprayer with an adjustable brass nozzle and padded straps.",
    specs: [{ label: "Tank", value: "16", unit: "L" }, { label: "Power", value: "Manual" }, { label: "Nozzle", value: "Brass" }] },
  { name: "Battery sprayer, 16 L", category: "battery-sprayers", mrp: 4290, price: 3690, tax: "tax-12",
    description: "Rechargeable knapsack sprayer with pressure control and two nozzles.",
    specs: [{ label: "Tank", value: "16", unit: "L" }, { label: "Battery", value: "12V 8Ah" }, { label: "Power", value: "Battery" }] },
  { name: "Electric lawn mower, 32 cm", category: "lawn-mowers", mrp: 9990, price: 8490, tax: "tax-12",
    description: "Corded rotary mower with a 30 L grass box and five cutting heights.",
    specs: [{ label: "Motor", value: "1200", unit: "W" }, { label: "Cut", value: "32", unit: "cm" }, { label: "Box", value: "30", unit: "L" }] },
  { name: "Tea harvester, single-operator", category: "tea-harvesters", mrp: 32500, price: 29900, tax: "tax-12",
    description: "Petrol tea plucking machine with a curved blade and collection bag.",
    specs: [{ label: "Engine", value: "25.4", unit: "cc" }, { label: "Blade", value: "600", unit: "mm" }, { label: "Weight", value: "9.5", unit: "kg" }] },
  { name: "Pigeon net, 10 × 10 ft", category: "pigeon-nets", mrp: 899, price: 749, tax: "tax-18",
    description: "UV-stabilised nylon netting for balconies and ducts. Fixing hooks sold separately.",
    specs: [{ label: "Size", value: "10 × 10", unit: "ft" }, { label: "Mesh", value: "50", unit: "mm" }, { label: "Material", value: "Nylon" }] },
];

const slugify = (s: string) =>
  "sample-" + s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  const host = url.match(/@([^:/?]+)/)?.[1] ?? "";
  if (!["localhost", "127.0.0.1"].includes(host) || /:15432\//.test(url)) {
    throw new Error(`Refusing to touch sample data on a non-local database (${host || "unknown host"}).`);
  }

  if (process.argv.includes("--remove")) {
    const { count } = await prisma.product.deleteMany({ where: { isDemo: true } });
    console.log(`Removed ${count} sample products.`);
    return;
  }

  for (const [i, s] of SAMPLES.entries()) {
    const category = await prisma.category.findUnique({ where: { slug: s.category }, select: { id: true } });
    if (!category) {
      console.warn(`skip ${s.name}: category ${s.category} missing (run db:seed first)`);
      continue;
    }
    const slug = slugify(s.name);
    const sku = `FZ-SAMPLE-${String(i + 1).padStart(3, "0")}`;
    const data = {
      name: s.name,
      description: s.description,
      categoryId: category.id,
      mrp: s.mrp,
      sellingPrice: s.price,
      onlinePrice: s.price,
      taxSlabId: s.tax,
      status: "ACTIVE" as const,
      showOnWebsite: true,
      isDemo: true,
      sortOrder: SAMPLES.length - i,
      specs: s.specs as unknown as Prisma.InputJsonValue,
    };
    const product = await prisma.product.upsert({ where: { slug }, update: data, create: { slug, ...data } });
    await prisma.productVariant.upsert({
      where: { sku },
      update: { productId: product.id, stock: 10 },
      create: { productId: product.id, sku, barcode: sku, stock: 10 },
    });
  }
  console.log(`Seeded ${SAMPLES.length} sample products (isDemo = true).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
