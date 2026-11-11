import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {



  console.log("🌱 Seeding database...\n");

  // ── Tax Slabs ──────────────────────────────────────
  // Indian GST on garden/agri goods spans several slabs (seeds/plants are
  // typically exempt, fertilisers 5%, machinery 12%, pesticides/pots 18%).
  // Confirm each product's HSN rate with the accountant.
  for (const [id, name, percentage] of [
    ["tax-0", "0%", 0],
    ["tax-5", "5%", 5],
    ["tax-12", "12%", 12],
    ["tax-18", "18%", 18],
  ] as const) {
    await prisma.taxSlab.upsert({ where: { id }, update: {}, create: { id, name, percentage } });
  }

  console.log("✓ Tax slabs created");

  // ── Categories ──────────────────────────────────────
  // Nidhi Enterprises catalogue: top-level departments with sub-categories.
  const CATALOG: { name: string; slug: string; children: [string, string][] }[] = [
    {
      name: "Plants", slug: "plants",
      children: [["Indoor Plants", "indoor-plants"], ["Outdoor Plants", "outdoor-plants"], ["Flowering Plants", "flowering-plants"], ["Fruit Plants", "fruit-plants"], ["Succulents & Cacti", "succulents-cacti"]],
    },
    {
      name: "Seeds", slug: "seeds",
      children: [["Vegetable Seeds", "vegetable-seeds"], ["Flower Seeds", "flower-seeds"], ["Herb Seeds", "herb-seeds"], ["Lawn & Grass Seeds", "lawn-grass-seeds"], ["Field Crop Seeds", "field-crop-seeds"]],
    },
    {
      name: "Pots & Planters", slug: "pots-planters",
      children: [["Plastic Pots", "plastic-pots"], ["Ceramic Pots", "ceramic-pots"], ["Terracotta Pots", "terracotta-pots"], ["Hanging Planters", "hanging-planters"], ["Pot Stands", "pot-stands"]],
    },
    {
      name: "Fertilizers & Manures", slug: "fertilizers-manures",
      children: [["Organic Manures", "organic-manures"], ["Vermicompost", "vermicompost"], ["Chemical Fertilizers", "chemical-fertilizers"], ["Plant Growth Promoters", "growth-promoters"], ["Potting Mix & Soil", "potting-mix-soil"]],
    },
    {
      name: "Crop Protection", slug: "crop-protection",
      children: [["Pesticides", "pesticides"], ["Insecticides", "insecticides"], ["Fungicides", "fungicides"], ["Herbicides & Weedicides", "herbicides-weedicides"], ["Organic Pest Control", "organic-pest-control"]],
    },
    {
      name: "Spray Pumps", slug: "spray-pumps",
      children: [["Hand Sprayers (1–2 L)", "hand-sprayers"], ["Pressure Pumps (5–8 L)", "pressure-pumps"], ["Knapsack Sprayers (16 L)", "knapsack-sprayers"], ["Battery Sprayers", "battery-sprayers"]],
    },
    {
      name: "Garden Machinery", slug: "garden-machinery",
      children: [["Lawn Mowers", "lawn-mowers"], ["Hedge Trimmers", "hedge-trimmers"], ["Grass Cutters", "grass-cutters"], ["Brush Cutters", "brush-cutters"], ["Chainsaws", "chainsaws"]],
    },
    {
      name: "Garden Tools", slug: "garden-tools",
      children: [["Hand Tools", "hand-tools"], ["Pruners & Shears", "pruners-shears"], ["Digging Tools", "digging-tools"], ["Watering", "watering"], ["Gloves & Accessories", "garden-accessories"]],
    },
  ];

  for (const [i, dept] of CATALOG.entries()) {
    const parent = await prisma.category.upsert({
      where: { slug: dept.slug },
      update: { name: dept.name, sortOrder: i + 1 },
      create: { name: dept.name, slug: dept.slug, sortOrder: i + 1 },
    });
    for (const [j, [name, slug]] of dept.children.entries()) {
      await prisma.category.upsert({
        where: { slug },
        update: { name, parentId: parent.id, sortOrder: j + 1 },
        create: { name, slug, parentId: parent.id, sortOrder: j + 1 },
      });
    }
  }

  console.log("✓ Categories created");

  // ── Collections ─────────────────────────────────────
  for (const [i, c] of [
    { name: "Monsoon Planting", slug: "monsoon-planting", rankOnHome: true },
    { name: "Kitchen Garden", slug: "kitchen-garden", rankOnHome: false },
    { name: "Bestsellers", slug: "bestsellers", rankOnHome: false },
    { name: "New Arrivals", slug: "new-arrivals", rankOnHome: false },
  ].entries()) {
    await prisma.collection.upsert({
      where: { slug: c.slug },
      update: {},
      create: { ...c, type: "SEASONAL", isActive: true, sortOrder: i + 1 },
    });
  }

  console.log("✓ Collections created");

  // ── Locations ──────────────────────────────────────
  await prisma.location.upsert({
    where: { id: "loc-showroom" },
    update: {},
    create: { id: "loc-showroom", name: "Nidhi Enterprises Store", type: "SHOWROOM" },
  });
  await prisma.location.upsert({
    where: { id: "loc-warehouse" },
    update: {},
    create: { id: "loc-warehouse", name: "Warehouse", type: "WAREHOUSE" },
  });




  console.log("✓ Locations created");

  // ── Loyalty Config ──────────────────────────────────
  await prisma.loyaltyConfig.upsert({
    where: { id: "loyalty-config" },
    update: {},
    create: {
      id: "loyalty-config",
      pointsPer100Rupees: 1,
      rupeeValuePerPoint: 0.25,
      minRedeemAmount: 100,
      isActive: true,
    },
  });




  console.log("✓ Loyalty config created");

  // ── Admin User ─────────────────────────────────────
  // Set SEED_ADMIN_PASSWORD when seeding a real database; admin123 is for local dev only.
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "admin123";
  const hashedPassword = await bcrypt.hash(adminPassword, 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@farmyzest.com" },
    update: {},
    create: {
      email: "admin@farmyzest.com",
      password: hashedPassword,
      name: "Admin",
      role: "ADMIN",
    },
  });




  console.log(`✓ Admin user created: ${admin.email}`);

  // ── Sample Salesmen ────────────────────────────────
  await prisma.salesman.upsert({
    where: { id: "salesman-1" },
    update: {},
    create: { id: "salesman-1", name: "Rajesh Kumar", commissionRate: 2.5 },
  });
  await prisma.salesman.upsert({
    where: { id: "salesman-2" },
    update: {},
    create: { id: "salesman-2", name: "Priya Sharma", commissionRate: 3.0 },
  });
  await prisma.salesman.upsert({
    where: { id: "salesman-3" },
    update: {},
    create: { id: "salesman-3", name: "Amit Singh", commissionRate: 2.0 },
  });




  console.log("✓ Salesmen created");




  console.log("\n✅ Seed complete!");



  console.log("\nLogin credentials:");



  console.log("  Admin: admin@farmyzest.com (password: SEED_ADMIN_PASSWORD or admin123)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });