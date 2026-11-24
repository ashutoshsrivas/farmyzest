-- CreateTable
CREATE TABLE "ShopNeed" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "href" TEXT NOT NULL,
    "imageUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopNeed_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShopNeed_enabled_sortOrder_idx" ON "ShopNeed"("enabled", "sortOrder");

-- Starter cards (same as the previous hard-coded homepage). Edit in admin.
INSERT INTO "ShopNeed" ("id", "title", "body", "href", "imageUrl", "sortOrder", "enabled", "updatedAt") VALUES
  ('need-pests',   'Pest problem?',  'Insecticides, fungicides, organic sprays', '/shop?category=crop-protection', 'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=1200&q=75&auto=format&fit=crop', 0, true, CURRENT_TIMESTAMP),
  ('need-kitchen', 'Kitchen garden', 'Vegetable seeds, potting mix, deep pots', '/shop?category=vegetable-seeds,potting-mix-soil', 'https://images.unsplash.com/photo-1611843467160-25afb8df1074?w=1200&q=75&auto=format&fit=crop', 1, true, CURRENT_TIMESTAMP),
  ('need-lawn',    'Lawn care',      'Grass seed, mowers, grass cutters', '/shop?category=lawn-grass-seeds,lawn-mowers,grass-cutters', 'https://images.unsplash.com/photo-1458245201577-fc8a130b8829?w=1200&q=75&auto=format&fit=crop', 2, true, CURRENT_TIMESTAMP),
  ('need-birds',   'Bird control',   'Pigeon nets and spikes', '/shop?category=bird-control', 'https://images.unsplash.com/photo-1534695941753-73cf13435eb4?w=1200&q=75&auto=format&fit=crop', 3, true, CURRENT_TIMESTAMP),
  ('need-spray',   'Spraying',       'Hand sprayers to 16 L knapsacks', '/shop?category=spray-pumps', 'https://images.unsplash.com/photo-1615811361523-6bd03d7748e7?w=1200&q=75&auto=format&fit=crop', 4, true, CURRENT_TIMESTAMP),
  ('need-upkeep',  'Garden upkeep',  'Pruners, shears, hoses, gloves', '/shop?category=garden-tools', 'https://images.unsplash.com/photo-1617576683096-00fc8eecb3af?w=1200&q=75&auto=format&fit=crop', 5, true, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
