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
  // Nidhi Enterprises catalogue: one tree, each node tagged for the Garden or
  // Farm storefront (BOTH = shown in either). `nav` places a category in that
  // segment's quick menu, in the given order.
  type Seg = "GARDEN" | "FARM" | "BOTH";
  type Node = { name: string; slug: string; segment?: Seg; nav?: [Seg, number] };
  const CATALOG: (Node & { children: Node[] })[] = [
    {
      name: "Plants", slug: "plants", segment: "GARDEN", nav: ["GARDEN", 3],
      children: [
        { name: "Indoor Plants", slug: "indoor-plants" },
        { name: "Outdoor Plants", slug: "outdoor-plants" },
        { name: "Flowering Plants", slug: "flowering-plants" },
        { name: "Fruit Plants", slug: "fruit-plants" },
        { name: "Succulents & Cacti", slug: "succulents-cacti" },
      ],
    },
    {
      name: "Seeds", slug: "seeds", segment: "BOTH", nav: ["GARDEN", 4],
      children: [
        { name: "Vegetable Seeds", slug: "vegetable-seeds" },
        { name: "Flower Seeds", slug: "flower-seeds", segment: "GARDEN" },
        { name: "Herb Seeds", slug: "herb-seeds", segment: "GARDEN" },
        { name: "Lawn & Grass Seeds", slug: "lawn-grass-seeds" },
        { name: "Field Crop Seeds", slug: "field-crop-seeds", segment: "FARM" },
      ],
    },
    {
      name: "Pots & Planters", slug: "pots-planters", segment: "GARDEN",
      children: [
        { name: "Plastic Pots", slug: "plastic-pots" },
        { name: "Ceramic Pots", slug: "ceramic-pots" },
        { name: "Terracotta Pots", slug: "terracotta-pots" },
        { name: "Hanging Planters", slug: "hanging-planters" },
        { name: "Plant Stands", slug: "pot-stands", nav: ["GARDEN", 5] },
      ],
    },
    {
      name: "Manures & Fertilisers", slug: "fertilizers-manures", segment: "BOTH", nav: ["GARDEN", 1],
      children: [
        { name: "Organic Manures", slug: "organic-manures" },
        { name: "Vermicompost", slug: "vermicompost" },
        { name: "Chemical Fertilisers", slug: "chemical-fertilizers" },
        { name: "Plant Growth Promoters", slug: "growth-promoters" },
        { name: "Potting Mix & Soil", slug: "potting-mix-soil", segment: "GARDEN" },
      ],
    },
    {
      name: "Pesticides & Medicines", slug: "crop-protection", segment: "BOTH", nav: ["FARM", 4],
      children: [
        { name: "Pesticides", slug: "pesticides" },
        { name: "Insecticides", slug: "insecticides" },
        { name: "Fungicides", slug: "fungicides" },
        { name: "Herbicides & Weedicides", slug: "herbicides-weedicides" },
        { name: "Organic Pest Control", slug: "organic-pest-control" },
      ],
    },
    {
      name: "Spray Pumps", slug: "spray-pumps", segment: "BOTH",
      children: [
        { name: "Hand Sprayers (1–2 L)", slug: "hand-sprayers", segment: "GARDEN" },
        { name: "Pressure Pumps (5–8 L)", slug: "pressure-pumps" },
        { name: "Knapsack Sprayers (16 L)", slug: "knapsack-sprayers", segment: "FARM" },
        { name: "Battery Sprayers", slug: "battery-sprayers" },
      ],
    },
    {
      name: "Garden & Farm Machinery", slug: "garden-machinery", segment: "FARM",
      children: [
        { name: "Lawn Mowers", slug: "lawn-mowers", nav: ["FARM", 1] },
        { name: "Tea Harvesters", slug: "tea-harvesters", nav: ["FARM", 2] },
        { name: "Hedge Trimmers", slug: "hedge-trimmers" },
        { name: "Grass Cutters", slug: "grass-cutters" },
        { name: "Brushcutters", slug: "brush-cutters" },
        { name: "Chainsaws", slug: "chainsaws" },
      ],
    },
    {
      name: "Garden Tools", slug: "garden-tools", segment: "BOTH",
      children: [
        { name: "Hand Tools", slug: "hand-tools", segment: "GARDEN", nav: ["GARDEN", 2] },
        { name: "Pruners & Shears", slug: "pruners-shears" },
        { name: "Digging Tools", slug: "digging-tools" },
        { name: "Watering Cans", slug: "watering-cans", nav: ["FARM", 3] },
        { name: "Hoses & Watering", slug: "watering" },
        { name: "Gloves & Accessories", slug: "garden-accessories" },
      ],
    },
    {
      name: "Pigeon Nets & Spikes", slug: "bird-control", segment: "BOTH", nav: ["FARM", 5],
      children: [
        { name: "Pigeon Nets", slug: "pigeon-nets" },
        { name: "Bird Spikes", slug: "bird-spikes" },
      ],
    },
  ];

  const segFields = (n: Node, inherited: Seg) => ({
    segment: n.segment ?? inherited,
    quickNav: n.nav?.[0] ?? null,
    quickNavOrder: n.nav?.[1] ?? 0,
  });

  for (const [i, dept] of CATALOG.entries()) {
    const deptFields = { name: dept.name, sortOrder: i + 1, ...segFields(dept, "BOTH") };
    const parent = await prisma.category.upsert({
      where: { slug: dept.slug },
      update: deptFields,
      create: { slug: dept.slug, ...deptFields },
    });
    for (const [j, child] of dept.children.entries()) {
      const childFields = { name: child.name, parentId: parent.id, sortOrder: j + 1, ...segFields(child, deptFields.segment) };
      await prisma.category.upsert({
        where: { slug: child.slug },
        update: childFields,
        create: { slug: child.slug, ...childFields },
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