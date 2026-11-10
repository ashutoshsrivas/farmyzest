// Stock placeholder photography (Unsplash, whitelisted in next.config.ts) used
// until the admin uploads Farmyzest's own banners / category images.
const u = (id: string, w = 1600) => `https://images.unsplash.com/photo-${id}?w=${w}&q=75&auto=format&fit=crop`;

export const PLACEHOLDER = {
  hero: u("1585320806297-9794b3e4eeae", 2000), // garden path in bloom
  story: u("1622383563227-04401ab4e5ea", 1200), // gloved hands planting
  featuredMain: u("1592150621744-aca64f48394a", 1600), // indoor plant collection
  featuredThumbs: [
    u("1523348837708-15d4a09cfac2", 600), // seedlings in pots
    u("1466692476868-aef1dfb1e735", 600), // seed tray
    u("1591857177580-dc82b9ac4e1e", 600), // raised vegetable bed
  ],
} as const;

// Category tile images keyed by category slug (see prisma/seed.ts).
export const CATEGORY_IMAGES: Record<string, string> = {
  plants: u("1592150621744-aca64f48394a", 900),
  seeds: u("1530836369250-ef72a3f5cda8", 900),
  "pots-planters": u("1459411552884-841db9b3cc2a", 900),
  "fertilizers-manures": u("1416879595882-3373a0480b5b", 900),
  "crop-protection": u("1625246333195-78d9c38ad449", 900),
  "spray-pumps": u("1615811361523-6bd03d7748e7", 900),
  "garden-machinery": u("1558904541-efa843a96f01", 900),
  "garden-tools": u("1622383563227-04401ab4e5ea", 900),
};
