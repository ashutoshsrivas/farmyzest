// Homepage copy and images. Kept out of the components so wording, links and
// photos can change without touching layout code. Swap any `src` for a real
// Farmyzest photo (S3 or /public) when available.
//
// Facts only: nothing here should claim delivery promises, customer counts or
// history that Nidhi Enterprises hasn't confirmed.

import type { Segment } from "@/lib/segment";
import { PHOTO, unsplash } from "@/lib/placeholder-images";

export interface ImageSlotSpec {
  src: string | null;
  alt: string;
  /** Art direction shown on the placeholder if `src` is null. */
  note: string;
  ratio: string; // CSS aspect-ratio, e.g. "4 / 5"
}

export const HERO: Record<
  Segment,
  { kicker: string; headline: string; body: string; cta: string; image: string; alt: string }
> = {
  garden: {
    kicker: "Garden",
    headline: "Everything your garden needs to grow.",
    body: "Seeds, manure, pots, hand tools and stands for balconies, terraces and kitchen gardens.",
    cta: "Shop Garden",
    image: unsplash(PHOTO.balconyTomatoes, 1800),
    alt: "Cherry tomatoes ripening in a pot on a sunny balcony",
  },
  farm: {
    kicker: "Farm",
    headline: "Equipment built for demanding work.",
    body: "Mowers, tea harvesters, sprayers, crop protection and bird control for growers and estates.",
    cta: "Shop Farm",
    image: unsplash(PHOTO.munnarTea, 1800),
    alt: "Tea gardens rolling over misty hills in Munnar, Kerala",
  },
};


export const NEEDS: { title: string; body: string; href: string; image: string }[] = [
  { title: "Pest problem?", body: "Insecticides, fungicides, organic sprays", href: "/shop?category=crop-protection", image: unsplash(PHOTO.cropRows, 800) },
  { title: "Kitchen garden", body: "Vegetable seeds, potting mix, deep pots", href: "/shop?category=vegetable-seeds,potting-mix-soil", image: unsplash(PHOTO.handsPlanting, 800) },
  { title: "Lawn care", body: "Grass seed, mowers, grass cutters", href: "/shop?category=lawn-grass-seeds,lawn-mowers,grass-cutters", image: unsplash(PHOTO.lawnMower, 800) },
  { title: "Bird control", body: "Pigeon nets and spikes", href: "/shop?category=bird-control", image: unsplash(PHOTO.pigeon, 800) },
  { title: "Spraying", body: "Hand sprayers to 16 L knapsacks", href: "/shop?category=spray-pumps", image: unsplash(PHOTO.tractorSpray, 800) },
  { title: "Garden upkeep", body: "Pruners, shears, hoses, gloves", href: "/shop?category=garden-tools", image: unsplash(PHOTO.pruning, 800) },
];

// ── Sowing calendar ─────────────────────────────────────────────────────────
// Broad windows for the North Indian plains. Hill and southern sowing dates
// differ; the section says so. Months are 1–12.
export interface SowingSeason {
  name: string;
  months: number[];
  window: string;
  crops: { name: string; local?: string; how: "Direct sow" | "Nursery, then transplant"; q: string }[];
  flowers: string[];
}

export const SOWING_IMAGE = { src: unsplash(PHOTO.cabbageRows, 1400), alt: "Rows of cabbage and kale growing in a field" };

export const SOWING: SowingSeason[] = [
  {
    name: "Winter sowing",
    months: [9, 10, 11, 12, 1],
    window: "September to January",
    crops: [
      { name: "Peas", local: "matar", how: "Direct sow", q: "peas" },
      { name: "Spinach", local: "palak", how: "Direct sow", q: "spinach" },
      { name: "Fenugreek", local: "methi", how: "Direct sow", q: "methi" },
      { name: "Coriander", local: "dhania", how: "Direct sow", q: "coriander" },
      { name: "Carrot", local: "gajar", how: "Direct sow", q: "carrot" },
      { name: "Radish", local: "mooli", how: "Direct sow", q: "radish" },
      { name: "Cauliflower", local: "phool gobhi", how: "Nursery, then transplant", q: "cauliflower" },
      { name: "Cabbage", local: "patta gobhi", how: "Nursery, then transplant", q: "cabbage" },
    ],
    flowers: ["Calendula", "Petunia", "Sweet pea", "Dianthus"],
  },
  {
    name: "Summer sowing",
    months: [2, 3, 4],
    window: "February to April",
    crops: [
      { name: "Okra", local: "bhindi", how: "Direct sow", q: "okra" },
      { name: "Bottle gourd", local: "lauki", how: "Direct sow", q: "bottle gourd" },
      { name: "Cucumber", local: "kheera", how: "Direct sow", q: "cucumber" },
      { name: "Ridge gourd", local: "tori", how: "Direct sow", q: "ridge gourd" },
      { name: "Cowpea", local: "lobia", how: "Direct sow", q: "cowpea" },
      { name: "Amaranth", local: "chaulai", how: "Direct sow", q: "amaranth" },
    ],
    flowers: ["Zinnia", "Portulaca", "Sunflower", "Gomphrena"],
  },
  {
    name: "Monsoon sowing",
    months: [5, 6, 7, 8],
    window: "May to August",
    crops: [
      { name: "Brinjal", local: "baingan", how: "Nursery, then transplant", q: "brinjal" },
      { name: "Chilli", local: "mirch", how: "Nursery, then transplant", q: "chilli" },
      { name: "Tomato", local: "tamatar", how: "Nursery, then transplant", q: "tomato" },
      { name: "Bitter gourd", local: "karela", how: "Direct sow", q: "bitter gourd" },
      { name: "French beans", local: "faliyan", how: "Direct sow", q: "beans" },
      { name: "Maize", local: "makka", how: "Direct sow", q: "maize" },
    ],
    flowers: ["Balsam", "Cosmos", "Marigold", "Celosia"],
  },
];

export function seasonFor(month: number): SowingSeason {
  return SOWING.find((s) => s.months.includes(month)) ?? SOWING[0];
}

// ── Heritage ────────────────────────────────────────────────────────────────
// Add confirmed milestones (year + one line) between the first and last rows.
export const HERITAGE = {
  body: "Nidhi Enterprises has traded in gardening, agricultural and horticultural supplies since 1962. Farmyzest is its online store: the same range and the same advice, ordered from wherever you grow.",
  milestones: [
    { year: "1962", text: "Nidhi Enterprises starts trading." },
    // { year: "19xx", text: "…confirmed milestone…" },
    { year: "Today", text: "The full range goes online as Farmyzest." },
  ],
  image: unsplash(PHOTO.oxenPlough, 2000),
  imageAlt: "A farmer ploughing a field with a pair of oxen under a stormy sky",
  inset: unsplash(PHOTO.teaPickers, 900),
  insetAlt: "Workers picking tea on a hillside estate",
};

// ── Field notes (short buying guidance) ────────────────────────────────────
export const FIELD_NOTES: { title: string; body: string; image: string; link: { label: string; href: string } }[] = [
  {
    title: "Choosing a spray pump",
    body: "A 1–2 L hand sprayer covers balcony and indoor plants. A 5–8 L pressure pump suits a terrace or small garden. For fields and orchards, a 16 L knapsack saves trips to refill.",
    image: unsplash(PHOTO.wateringShower, 900),
    link: { label: "Spray pumps", href: "/shop?category=spray-pumps" },
  },
  {
    title: "Starting a kitchen garden",
    body: "Tomato, brinjal and chilli need pots at least 12 inches deep. Coriander, methi and mint manage in 6–8 inches. Use a potting mix that drains well and water when the top inch is dry.",
    image: unsplash(PHOTO.seedlingRows, 900),
    link: { label: "Vegetable seeds", href: "/shop?category=vegetable-seeds" },
  },
  {
    title: "Keeping pigeons off a balcony",
    body: "Netting closes an opening so birds can't get in. Spikes stop them landing on ledges, AC units and pipes. Most balconies need netting on the open side and spikes on the ledges.",
    image: unsplash(PHOTO.pigeonClose, 900),
    link: { label: "Nets and spikes", href: "/shop?category=bird-control" },
  },
];

export const ASK_IMAGE = { src: unsplash(PHOTO.wateringCan, 1800), alt: "A galvanised watering can in a vegetable garden" };
