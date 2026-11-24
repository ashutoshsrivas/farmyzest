// Homepage content: every heading, line of copy, link and image on the
// homepage. Edited in admin → Homepage Content and stored as one JSON record
// (StoreSetting id "homepage"); anything not saved yet falls back to the
// defaults below. Safe to import from client components (no database code).
//
// "Shop by need" cards live in their own table (admin → Shop by Need);
// categories, collections and products come from the catalogue.

import { z } from "zod";
import { PHOTO, unsplash } from "@/lib/placeholder-images";

// ── Schema ─────────────────────────────────────────────────────────────────

const text = (max: number) => z.string().trim().max(max);
const line = text(160);
const para = text(900);
/** Internal path ("/shop?…") or full http(s) URL. */
const href = z
  .string()
  .trim()
  .max(400)
  .refine((v) => v === "" || v.startsWith("/") || /^https?:\/\//i.test(v), "Links must start with / or http(s)://");
/** https:// image URL or a /public path. */
const image = z
  .string()
  .trim()
  .max(600)
  .refine((v) => v === "" || v.startsWith("/") || /^https:\/\//i.test(v), "Images must be an https:// link or a /path");

const panel = z.object({ kicker: text(40), headline: line, body: para, cta: text(40), image, alt: line });

const season = z.object({
  name: text(60),
  window: text(80),
  months: z.array(z.number().int().min(1).max(12)).max(12),
  crops: z
    .array(
      z.object({
        name: text(60),
        local: text(60),
        how: z.enum(["Direct sow", "Nursery, then transplant"]),
        q: text(60),
      })
    )
    .max(20),
  flowers: z.array(text(40)).max(12),
});

export const homeContentSchema = z.object({
  landscape: z.object({ eyebrow: line, headline: line, gardenSign: text(24), farmSign: text(24) }),
  shopByNeed: z.object({ title: line, intro: line }),
  intro: z.object({ eyebrow: line, statement: para, linkLabel: text(60), linkHref: href, showStats: z.boolean() }),
  panels: z.object({ garden: panel, farm: panel }),
  catalogue: z.object({ title: line, linkLabel: text(60) }),
  sowing: z.object({ titlePrefix: text(60), note: para, image, imageAlt: line, seasons: z.array(season).min(1).max(6) }),
  products: z.object({ gardenTitle: line, farmTitle: line, newTitle: line }),
  heritage: z.object({
    title: line,
    bigYear: text(12),
    body: para,
    linkLabel: text(60),
    milestones: z.array(z.object({ year: text(12), text: line })).max(12),
    image,
    imageAlt: line,
    inset: image,
    insetAlt: line,
  }),
  notes: z.object({
    title: line,
    intro: line,
    items: z.array(z.object({ title: line, body: para, image, linkLabel: text(60), href })).max(6),
  }),
  ask: z.object({ eyebrow: line, headline: line, body: para, image, imageAlt: line, contactLabel: text(60) }),
});

export type HomeContent = z.infer<typeof homeContentSchema>;
export type SowingSeason = HomeContent["sowing"]["seasons"][number];
export type HeroPanel = HomeContent["panels"]["garden"];

// ── Defaults (current live wording) ────────────────────────────────────────

export const DEFAULT_HOME_CONTENT: HomeContent = {
  landscape: {
    eyebrow: "Farmyzest · Nidhi Enterprises · Since 1962",
    headline: "Everything that grows starts here.",
    gardenSign: "Garden",
    farmSign: "Farm",
  },
  shopByNeed: { title: "Shop by need", intro: "Start from the job in front of you." },
  intro: {
    eyebrow: "Nidhi Enterprises · Since 1962",
    statement: "Seeds to brushcutters, from a counter growers have trusted since 1962.",
    linkLabel: "Read our story",
    linkHref: "/about",
    showStats: true,
  },
  panels: {
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
  },
  catalogue: { title: "Shop the full catalogue", linkLabel: "Shop everything" },
  sowing: {
    titlePrefix: "What to sow in",
    note: "Dates are for the North Indian plains. Hill and southern gardens differ, so ask us if you're unsure.",
    image: unsplash(PHOTO.cabbageRows, 1400),
    imageAlt: "Rows of cabbage and kale growing in a field",
    seasons: [
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
    ],
  },
  products: {
    gardenTitle: "Bestsellers for the garden",
    farmTitle: "Bestsellers for the farm",
    newTitle: "New in the catalogue",
  },
  heritage: {
    title: "1962 to today",
    bigYear: "1962",
    body: "Nidhi Enterprises has traded in gardening, agricultural and horticultural supplies since 1962. Farmyzest is its online store: the same range and the same advice, ordered from wherever you grow.",
    linkLabel: "Read our story",
    milestones: [
      { year: "1962", text: "Nidhi Enterprises starts trading." },
      { year: "Today", text: "The full range goes online as Farmyzest." },
    ],
    image: unsplash(PHOTO.oxenPlough, 2000),
    imageAlt: "A farmer ploughing a field with a pair of oxen under a stormy sky",
    inset: unsplash(PHOTO.teaPickers, 900),
    insetAlt: "Workers picking tea on a hillside estate",
  },
  notes: {
    title: "Field notes",
    intro: "Quick answers to the questions we hear most at the counter.",
    items: [
      {
        title: "Choosing a spray pump",
        body: "A 1–2 L hand sprayer covers balcony and indoor plants. A 5–8 L pressure pump suits a terrace or small garden. For fields and orchards, a 16 L knapsack saves trips to refill.",
        image: unsplash(PHOTO.wateringShower, 900),
        linkLabel: "Shop spray pumps",
        href: "/shop?category=spray-pumps",
      },
      {
        title: "Starting a kitchen garden",
        body: "Tomato, brinjal and chilli need pots at least 12 inches deep. Coriander, methi and mint manage in 6–8 inches. Use a potting mix that drains well and water when the top inch is dry.",
        image: unsplash(PHOTO.seedlingRows, 900),
        linkLabel: "Shop vegetable seeds",
        href: "/shop?category=vegetable-seeds",
      },
      {
        title: "Keeping pigeons off a balcony",
        body: "Netting closes an opening so birds can't get in. Spikes stop them landing on ledges, AC units and pipes. Most balconies need netting on the open side and spikes on the ledges.",
        image: unsplash(PHOTO.pigeonClose, 900),
        linkLabel: "Shop nets and spikes",
        href: "/shop?category=bird-control",
      },
    ],
  },
  ask: {
    eyebrow: "Ask before you buy",
    headline: "Not sure what fits? Send us a photo of the plant, pest or machine.",
    body: "We'll suggest the product, size or spare that suits. For estates, institutions and bulk orders, tell us the quantity and location and we'll send a quote.",
    image: unsplash(PHOTO.wateringCan, 1800),
    imageAlt: "A galvanised watering can in a vegetable garden",
    contactLabel: "Write to us or request a bulk quote",
  },
};

/** The season whose months include `month` (1–12), else the first one. */
export function seasonFor(seasons: SowingSeason[], month: number): SowingSeason {
  return seasons.find((s) => s.months.includes(month)) ?? seasons[0];
}

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/** Saved content layered over the defaults, key by key (arrays replace whole). */
export function mergeHomeContent(saved: unknown): HomeContent {
  const merge = (base: unknown, over: unknown): unknown => {
    if (isObj(base) && isObj(over)) {
      const out: Record<string, unknown> = { ...base };
      for (const k of Object.keys(base)) if (k in over) out[k] = merge(base[k], over[k]);
      return out;
    }
    return over === undefined ? base : over;
  };
  const merged = merge(DEFAULT_HOME_CONTENT, saved);
  const parsed = homeContentSchema.safeParse(merged);
  return parsed.success ? parsed.data : DEFAULT_HOME_CONTENT;
}
