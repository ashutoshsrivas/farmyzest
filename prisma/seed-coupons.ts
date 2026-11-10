import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

// Threshold-tier percentage coupons. "FLAT" here is just branding — they're all
// percentage discounts that unlock at a minimum cart value.
const TIERS = [
  { code: "FLAT10", value: 10, minCartValue: 3000 },
  { code: "FLAT15", value: 15, minCartValue: 10000 },
  { code: "FLAT20", value: 20, minCartValue: 20000 },
  { code: "FLAT25", value: 25, minCartValue: 60000 },
  { code: "FLAT30", value: 30, minCartValue: 100000 },
];

async function main() {
  // Accessories are capped at 15% no matter which coupon applies. We set the cap
  // on the category itself so the discount engine enforces it everywhere.
  const accessories = await db.category.findFirst({
    where: {
      OR: [{ slug: "accessories" }, { name: { contains: "accessor", mode: "insensitive" } }],
    },
  });
  if (accessories) {
    await db.category.update({
      where: { id: accessories.id },
      data: { maxDiscountPct: 15 },
    });
    console.log(`✓ Capped "${accessories.name}" at 15% (maxDiscountPct)`);
  } else {
    console.warn(
      "⚠ No 'Accessories' category found. Create one (slug 'accessories'), set its Max discount % to 15 in the admin, and re-run — otherwise ACCESORIES15 won't be category-scoped."
    );
  }

  for (const t of TIERS) {
    await db.coupon.upsert({
      where: { code: t.code },
      // Spend tiers apply automatically by cart value — no code needed.
      update: { type: "PERCENT", value: t.value, minCartValue: t.minCartValue, isActive: true, autoApply: true },
      create: { code: t.code, type: "PERCENT", value: t.value, minCartValue: t.minCartValue, isActive: true, autoApply: true },
    });
    console.log(`✓ ${t.code} — ${t.value}% on orders over ₹${t.minCartValue.toLocaleString("en-IN")}`);
  }

  // Accessories-only flat 15%.
  await db.coupon.upsert({
    where: { code: "ACCESORIES15" },
    // Code-only (not auto): customers enter ACCESORIES15 for accessories.
    update: {
      type: "PERCENT",
      value: 15,
      minCartValue: 0,
      includeCategoryIds: accessories ? [accessories.id] : [],
      isActive: true,
      autoApply: false,
    },
    create: {
      code: "ACCESORIES15",
      type: "PERCENT",
      value: 15,
      minCartValue: 0,
      includeCategoryIds: accessories ? [accessories.id] : [],
      isActive: true,
      autoApply: false,
    },
  });
  console.log("✓ ACCESORIES15 — 15% on accessories");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
