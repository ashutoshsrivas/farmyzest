// Mood photography (Unsplash, free licence; host whitelisted in next.config.ts)
// used until Farmyzest uploads its own banners and category images. These are
// scene photos, never presented as specific products. An admin-set
// Category.imageUrl always wins over the defaults below.

/** Unsplash URL at a given width (next/image re-optimises it anyway). */
export const unsplash = (id: string, w = 1600) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&q=75&auto=format&fit=crop`;

export const PHOTO = {
  balconyTomatoes: "1632770464350-e73ae4aaa11c",
  munnarTea: "1491497895121-1334fc14d8c9",
  mistyTea: "1455157823797-3019317cbcf0",
  teaPickers: "1533268722164-c7323ba5690c",
  teaHillside: "1746175832129-fddb132c075c",
  cropRows: "1625246333195-78d9c38ad449",
  handsPlanting: "1611843467160-25afb8df1074",
  lawnMower: "1458245201577-fc8a130b8829",
  pigeon: "1534695941753-73cf13435eb4",
  pigeonClose: "1641144355850-e7991d050bdc",
  pigeonLedge: "1786223252518-db0026329748",
  tractorSpray: "1615811361523-6bd03d7748e7",
  pruning: "1617576683096-00fc8eecb3af",
  indoorPlants: "1592150621744-aca64f48394a",
  seedTray: "1530836369250-ef72a3f5cda8",
  clayPots: "1528789386055-75c4b717bad1",
  potsWithPlants: "1620293106076-ad27d651efe3",
  handsInSoil: "1763844599737-be3850c60cea",
  soilScoop: "1416879595882-3373a0480b5b",
  stringTrimmer: "1793440890401-5aed5b9d7a15",
  wheelbarrow: "1621272156568-7306716648df",
  rakes: "1774365294150-5d6051b6c53a",
  wateringCan: "1786459558726-2b672982ba55",
  wateringShower: "1515150144380-bca9f1650ed9",
  cabbageRows: "1788122046428-b333ccbca90b",
  seedlingRows: "1466692476868-aef1dfb1e735",
  oxenPlough: "1620901433789-1d2f85a93653",
} as const;

const u = unsplash;

/** Legacy home-section builder fallbacks. */
export const PLACEHOLDER = {
  hero: u(PHOTO.munnarTea, 2000),
  story: u(PHOTO.oxenPlough, 1600),
  featuredMain: u(PHOTO.indoorPlants, 1600),
  featuredThumbs: [u(PHOTO.seedlingRows, 600), u(PHOTO.seedTray, 600), u(PHOTO.clayPots, 600)],
} as const;

/** Category tile images keyed by category slug (see prisma/seed.ts). */
export const CATEGORY_IMAGES: Record<string, string> = {
  plants: u(PHOTO.indoorPlants, 1200),
  seeds: u(PHOTO.seedTray, 1200),
  "pots-planters": u(PHOTO.clayPots, 1200),
  "fertilizers-manures": u(PHOTO.handsInSoil, 1200),
  "crop-protection": u(PHOTO.tractorSpray, 1200),
  "spray-pumps": u(PHOTO.wateringShower, 1200),
  "garden-machinery": u(PHOTO.stringTrimmer, 1200),
  "garden-tools": u(PHOTO.wheelbarrow, 1200),
  "bird-control": u(PHOTO.pigeonLedge, 1200),
  // Quick-menu sub-categories
  "hand-tools": u(PHOTO.rakes, 900),
  "pot-stands": u(PHOTO.potsWithPlants, 900),
  "lawn-mowers": u(PHOTO.lawnMower, 900),
  "tea-harvesters": u(PHOTO.teaHillside, 900),
  "watering-cans": u(PHOTO.wateringCan, 900),
};
