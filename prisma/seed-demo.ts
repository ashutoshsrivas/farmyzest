// Sample catalogue for previewing the store.
//
//   npx tsx prisma/seed-demo.ts                  # add/refresh samples (local DB)
//   npx tsx prisma/seed-demo.ts --remove         # delete every sample product
//   npx tsx prisma/seed-demo.ts --allow-remote   # same, against a non-local DB
//
// Every row is flagged `isDemo`: shown with a "Sample" tag and a notice on the
// product page, and refused by checkout (api/orders). No brands, no dosage or
// efficacy claims; prices are indicative. Photos are scene photos (Unsplash).
// Remove them with --remove once real products are added.

import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

const img = (id: string) => `https://images.unsplash.com/photo-${id}?w=1200&q=75&auto=format&fit=crop`;

type Spec = { label: string; value: string; unit?: string };
interface Sample {
  name: string;
  category: string; // category slug
  mrp: number;
  price: number;
  tax: "tax-0" | "tax-5" | "tax-12" | "tax-18";
  description: string;
  specs: Spec[];
  photo: string; // Unsplash photo id
}

const SAMPLES: Sample[] = [
  // ── Garden ──
  { name: "Glazed ceramic planter, 8 inch", category: "ceramic-pots", mrp: 799, price: 649, tax: "tax-18", photo: "1528789386055-75c4b717bad1",
    description: "Glazed ceramic pot with a drainage hole and saucer. Suits indoor plants and small shrubs.",
    specs: [{ label: "Diameter", value: "8", unit: "in" }, { label: "Height", value: "7.5", unit: "in" }, { label: "Drainage", value: "Yes" }] },
  { name: "Vermicompost, 5 kg bag", category: "vermicompost", mrp: 299, price: 249, tax: "tax-5", photo: "1763844599737-be3850c60cea",
    description: "Earthworm compost for pots, beds and kitchen gardens. Mix into potting soil or top-dress existing plants.",
    specs: [{ label: "Pack", value: "5", unit: "kg" }, { label: "Type", value: "Organic" }] },
  { name: "Tomato seeds, hybrid, 50 seeds", category: "vegetable-seeds", mrp: 120, price: 99, tax: "tax-0", photo: "1632770464350-e73ae4aaa11c",
    description: "Hybrid tomato for pots and beds. Raise in a nursery tray and transplant at four to five leaves.",
    specs: [{ label: "Seeds", value: "50" }, { label: "Sowing", value: "Nursery" }] },
  { name: "Three-tier metal plant stand", category: "pot-stands", mrp: 1899, price: 1599, tax: "tax-18", photo: "1620293106076-ad27d651efe3",
    description: "Powder-coated steel stand with three staggered shelves for balcony and corner displays.",
    specs: [{ label: "Tiers", value: "3" }, { label: "Height", value: "92", unit: "cm" }, { label: "Material", value: "Steel" }] },
  { name: "Hand trowel and fork set", category: "hand-tools", mrp: 449, price: 379, tax: "tax-12", photo: "1416879595882-3373a0480b5b",
    description: "Stainless steel trowel and three-prong fork with hardwood handles.",
    specs: [{ label: "Pieces", value: "2" }, { label: "Blade", value: "Stainless steel" }] },
  { name: "Potting mix, 10 kg", category: "potting-mix-soil", mrp: 399, price: 349, tax: "tax-5", photo: "1611843467160-25afb8df1074",
    description: "Ready-to-use mix of soil, cocopeat and compost for containers.",
    specs: [{ label: "Pack", value: "10", unit: "kg" }, { label: "Use", value: "Containers" }] },
  { name: "Indoor foliage plant, 6 inch pot", category: "indoor-plants", mrp: 499, price: 429, tax: "tax-0", photo: "1592150621744-aca64f48394a",
    description: "Easy-care indoor foliage plant supplied in a 6 inch nursery pot. Bright indirect light; water when the top soil is dry.",
    specs: [{ label: "Pot", value: "6", unit: "in" }, { label: "Light", value: "Indirect" }] },
  { name: "Vegetable seedling tray, 50 cells", category: "garden-accessories", mrp: 199, price: 159, tax: "tax-18", photo: "1530836369250-ef72a3f5cda8",
    description: "Reusable plastic nursery tray for raising vegetable and flower seedlings.",
    specs: [{ label: "Cells", value: "50" }, { label: "Material", value: "Plastic" }] },
  // ── Farm ──
  { name: "Petrol brushcutter, 4-stroke", category: "brush-cutters", mrp: 17990, price: 14990, tax: "tax-12", photo: "1793440890401-5aed5b9d7a15",
    description: "Shoulder-strap brushcutter with a straight shaft, nylon head and three-tooth blade.",
    specs: [{ label: "Engine", value: "35.8", unit: "cc" }, { label: "Tank", value: "0.65", unit: "L" }, { label: "Cut", value: "415", unit: "mm" }, { label: "Weight", value: "7.6", unit: "kg" }] },
  { name: "Manual knapsack sprayer, 16 L", category: "knapsack-sprayers", mrp: 1650, price: 1390, tax: "tax-12", photo: "1615811361523-6bd03d7748e7",
    description: "Side-lever knapsack sprayer with an adjustable brass nozzle and padded straps.",
    specs: [{ label: "Tank", value: "16", unit: "L" }, { label: "Power", value: "Manual" }, { label: "Nozzle", value: "Brass" }] },
  { name: "Battery sprayer, 16 L", category: "battery-sprayers", mrp: 4290, price: 3690, tax: "tax-12", photo: "1515150144380-bca9f1650ed9",
    description: "Rechargeable knapsack sprayer with pressure control and two nozzles.",
    specs: [{ label: "Tank", value: "16", unit: "L" }, { label: "Battery", value: "12V 8Ah" }, { label: "Power", value: "Battery" }] },
  { name: "Electric lawn mower, 32 cm", category: "lawn-mowers", mrp: 9990, price: 8490, tax: "tax-12", photo: "1458245201577-fc8a130b8829",
    description: "Corded rotary mower with a 30 L grass box and five cutting heights.",
    specs: [{ label: "Motor", value: "1200", unit: "W" }, { label: "Cut", value: "32", unit: "cm" }, { label: "Box", value: "30", unit: "L" }] },
  { name: "Tea harvester, single-operator", category: "tea-harvesters", mrp: 32500, price: 29900, tax: "tax-12", photo: "1533268722164-c7323ba5690c",
    description: "Petrol tea plucking machine with a curved blade and collection bag.",
    specs: [{ label: "Engine", value: "25.4", unit: "cc" }, { label: "Blade", value: "600", unit: "mm" }, { label: "Weight", value: "9.5", unit: "kg" }] },
  { name: "Galvanised watering can, 10 L", category: "watering-cans", mrp: 1199, price: 999, tax: "tax-18", photo: "1786459558726-2b672982ba55",
    description: "Galvanised steel watering can with a removable brass rose.",
    specs: [{ label: "Capacity", value: "10", unit: "L" }, { label: "Material", value: "Galvanised steel" }] },
  { name: "Pigeon net, 10 × 10 ft", category: "pigeon-nets", mrp: 899, price: 749, tax: "tax-18", photo: "1534695941753-73cf13435eb4",
    description: "UV-stabilised nylon netting for balconies and ducts. Fixing hooks sold separately.",
    specs: [{ label: "Size", value: "10 × 10", unit: "ft" }, { label: "Mesh", value: "50", unit: "mm" }, { label: "Material", value: "Nylon" }] },
  { name: "Bird spikes, 10 strips", category: "bird-spikes", mrp: 649, price: 549, tax: "tax-18", photo: "1786223252518-db0026329748",
    description: "Polycarbonate spike strips for ledges, parapets and AC units. Each strip is 30 cm long.",
    specs: [{ label: "Strips", value: "10" }, { label: "Length", value: "30", unit: "cm" }, { label: "Material", value: "Polycarbonate" }] },
];

const slugify = (s: string) =>
  "sample-" + s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  const host = url.match(/@([^:/?]+)/)?.[1] ?? "";
  const local = ["localhost", "127.0.0.1"].includes(host) && !/:15432\//.test(url);
  if (!local && !process.argv.includes("--allow-remote")) {
    throw new Error(`Refusing to touch a non-local database (${host || "unknown host"}). Pass --allow-remote to confirm.`);
  }

  if (process.argv.includes("--remove")) {
    const { count } = await prisma.product.deleteMany({ where: { isDemo: true } });
    console.log(`Removed ${count} sample products.`);
    return;
  }

  let done = 0;
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
    await prisma.productImage.deleteMany({ where: { productId: product.id } });
    await prisma.productImage.create({
      data: { productId: product.id, url: img(s.photo), alt: `${s.name} (sample photo)`, isPrimary: true, sortOrder: 0 },
    });
    done++;
  }
  console.log(`Seeded ${done} sample products with photos (isDemo = true).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
