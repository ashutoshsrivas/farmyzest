// Homepage copy and image slots. Kept out of the components so wording,
// links and photos can change without touching layout code.
//
// Images: `src: null` renders a labelled placeholder showing the intended
// shot. Set `src` to a real photo URL (S3 or /public) to replace it.
//
// Facts only: nothing here should claim delivery promises, customer counts or
// history that Nidhi Enterprises hasn't confirmed.

import type { Segment } from "@/lib/segment";

export interface ImageSlotSpec {
  src: string | null;
  alt: string;
  /** Art direction shown on the placeholder until a photo is supplied. */
  note: string;
  ratio: string; // CSS aspect-ratio, e.g. "4 / 5"
}

export const INTRO = {
  eyebrow: "01 · Nidhi Enterprises, since 1962",
  headline: "Seeds to brushcutters, from a counter growers have trusted since 1962.",
  body: "Shop for a balcony, a kitchen garden, a tea estate or a field. Pick the side that fits and we'll show you what matters there.",
};

export const SPLIT: Record<
  Segment,
  { title: string; headline: string; body: string; cta: string; secondary?: { label: string; href: string }; image: ImageSlotSpec }
> = {
  garden: {
    title: "Garden",
    headline: "Everything your garden needs to grow.",
    body: "Seeds, manure, potting mix, hand tools and plant stands for balconies, terraces and kitchen gardens.",
    cta: "Shop Garden",
    image: {
      src: null,
      alt: "Potted herbs and seedlings on a sunlit balcony ledge",
      note: "Terracotta pots of tulsi, mint and chilli seedlings on a balcony ledge. Morning side light, warm, uncluttered.",
      ratio: "2 / 1",
    },
  },
  farm: {
    title: "Farm",
    headline: "Equipment built for demanding work.",
    body: "Lawn mowers, tea harvesters, sprayers, crop protection and bird control for growers, estates and landscapers.",
    cta: "Shop Farm",
    secondary: { label: "Ask for a bulk quote", href: "/contact" },
    image: {
      src: null,
      alt: "Knapsack sprayer and brushcutter at the edge of a field",
      note: "16 L knapsack sprayer and a petrol brushcutter resting on a field bund. Overcast daylight, product in sharp focus.",
      ratio: "2 / 1",
    },
  },
};

export const NEEDS: { title: string; body: string; href: string }[] = [
  { title: "Pest problem?", body: "Insecticides, fungicides and organic sprays.", href: "/shop?category=crop-protection" },
  { title: "Starting a kitchen garden", body: "Vegetable seeds, potting mix and deep pots.", href: "/shop?category=vegetable-seeds,potting-mix-soil" },
  { title: "Lawn care", body: "Grass seed, mowers and grass cutters.", href: "/shop?category=lawn-grass-seeds,lawn-mowers,grass-cutters" },
  { title: "Bird control", body: "Pigeon nets and spikes for balconies, ledges and sheds.", href: "/shop?category=bird-control" },
  { title: "Choosing a spray pump", body: "From 1 L hand sprayers to 16 L knapsacks.", href: "/shop?category=spray-pumps" },
  { title: "Garden upkeep", body: "Pruners, shears, hoses and gloves.", href: "/shop?category=garden-tools" },
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
  image: {
    src: null,
    alt: "The Nidhi Enterprises store",
    note: "The shop front or counter today, or an archive photo if one exists. Black and white is fine.",
    ratio: "4 / 5",
  } satisfies ImageSlotSpec,
};

// ── Field notes (short buying guidance) ────────────────────────────────────
export const FIELD_NOTES: { title: string; body: string; link: { label: string; href: string } }[] = [
  {
    title: "Choosing a spray pump",
    body: "A 1–2 L hand sprayer covers balcony and indoor plants. A 5–8 L pressure pump suits a terrace or small garden. For fields and orchards, a 16 L knapsack saves trips to refill.",
    link: { label: "Spray pumps", href: "/shop?category=spray-pumps" },
  },
  {
    title: "Starting a kitchen garden",
    body: "Tomato, brinjal and chilli need pots at least 12 inches deep. Coriander, methi and mint manage in 6–8 inches. Use a potting mix that drains well and water when the top inch is dry.",
    link: { label: "Vegetable seeds", href: "/shop?category=vegetable-seeds" },
  },
  {
    title: "Keeping pigeons off a balcony",
    body: "Netting closes an opening so birds can't get in. Spikes stop them landing on ledges, AC units and pipes. Most balconies need netting on the open side and spikes on the ledges.",
    link: { label: "Nets and spikes", href: "/shop?category=bird-control" },
  },
];
