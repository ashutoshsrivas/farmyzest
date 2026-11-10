// Shared metadata for the curated homepage section builder. Drives BOTH the
// admin editor (which fields to render) and the storefront renderer / default
// seed. Keep section `type` strings in sync with the HomeSectionType enum.

export type HomeSectionType =
  | "HERO"
  | "VIDEO_REELS"
  | "FEATURED_COLLECTION"
  | "FEATURED_PRODUCTS"
  | "NEW_ARRIVALS"
  | "CATEGORY_SHOWCASE"
  | "BRAND_STORY"
  | "IMAGE_BANNER"
  | "RICH_TEXT";

export type FieldType =
  | "text"
  | "textarea"
  | "image"
  | "link"
  | "number"
  | "collection"
  | "category"
  | "categoryMulti"
  | "videoList";

// One reel inside a VIDEO_REELS section's `items` config array.
export interface VideoReelItem {
  videoUrl: string;
  label?: string;
  href?: string;
}

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  help?: string;
}

export interface SectionMeta {
  label: string;
  description: string;
  fields: FieldDef[];
  defaultConfig: Record<string, unknown>;
}

export const SECTION_META: Record<HomeSectionType, SectionMeta> = {
  HERO: {
    label: "Hero banner",
    description: "Full-width banner at the top with headline + button.",
    fields: [
      { key: "title", label: "Title", type: "text", placeholder: "Summer Collection" },
      { key: "subtitle", label: "Subtitle", type: "text" },
      { key: "ctaText", label: "Button text", type: "text", placeholder: "Shop Now" },
      { key: "ctaLink", label: "Button link", type: "link", placeholder: "/shop" },
      { key: "backgroundImage", label: "Background image", type: "image" },
    ],
    defaultConfig: {},
  },
  VIDEO_REELS: {
    label: "Video reels",
    description: "Auto-playing video carousel — one reel per category. Upload a vertical video for each and link it to a category.",
    fields: [
      { key: "title", label: "Heading", type: "text", placeholder: "Shop by Category" },
      { key: "items", label: "Videos", type: "videoList" },
    ],
    defaultConfig: { title: "Shop by Category", items: [] },
  },
  FEATURED_COLLECTION: {
    label: "Featured collection",
    description: "Editorial block highlighting one collection.",
    fields: [
      { key: "collectionSlug", label: "Collection", type: "collection", help: "Leave empty to use the homepage-ranked collection." },
      { key: "title", label: "Title (override)", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "ctaText", label: "Button text", type: "text", placeholder: "Shop Collection" },
      { key: "ctaLink", label: "Button link (override)", type: "link" },
      { key: "mainImage", label: "Main image (override)", type: "image" },
    ],
    defaultConfig: {},
  },
  FEATURED_PRODUCTS: {
    label: "Featured products",
    description: "A grid of products.",
    fields: [
      { key: "title", label: "Heading", type: "text", placeholder: "Featured" },
      { key: "collectionSlug", label: "From collection", type: "collection", help: "Optional — limit to one collection." },
      { key: "categorySlug", label: "From category", type: "category", help: "Optional — limit to one category." },
      { key: "limit", label: "How many", type: "number", placeholder: "8" },
    ],
    defaultConfig: { limit: 8 },
  },
  NEW_ARRIVALS: {
    label: "New arrivals",
    description: "The latest products.",
    fields: [
      { key: "title", label: "Heading", type: "text", placeholder: "New Arrivals" },
      { key: "limit", label: "How many", type: "number", placeholder: "4" },
    ],
    defaultConfig: { limit: 4 },
  },
  CATEGORY_SHOWCASE: {
    label: "Category showcase",
    description: "Grid of category tiles with images.",
    fields: [
      { key: "title", label: "Heading", type: "text", placeholder: "Shop by Category" },
      { key: "categorySlugs", label: "Categories to show", type: "categoryMulti", help: "Leave empty to show all top categories." },
    ],
    defaultConfig: {},
  },
  BRAND_STORY: {
    label: "Brand story",
    description: "Editorial 'our story' band.",
    fields: [
      { key: "backgroundImage", label: "Background image", type: "image" },
    ],
    defaultConfig: {},
  },
  IMAGE_BANNER: {
    label: "Image banner",
    description: "A single promo image with optional text + button.",
    fields: [
      { key: "imageUrl", label: "Image", type: "image" },
      { key: "title", label: "Overlay title", type: "text" },
      { key: "subtitle", label: "Overlay subtitle", type: "text" },
      { key: "ctaText", label: "Button text", type: "text" },
      { key: "ctaLink", label: "Button link", type: "link" },
    ],
    defaultConfig: {},
  },
  RICH_TEXT: {
    label: "Text band",
    description: "A centered heading + paragraph.",
    fields: [
      { key: "heading", label: "Heading", type: "text" },
      { key: "body", label: "Body", type: "textarea" },
    ],
    defaultConfig: {},
  },
};

export const SECTION_ORDER: HomeSectionType[] = [
  "HERO",
  "VIDEO_REELS",
  "FEATURED_COLLECTION",
  "FEATURED_PRODUCTS",
  "NEW_ARRIVALS",
  "CATEGORY_SHOWCASE",
  "BRAND_STORY",
  "IMAGE_BANNER",
  "RICH_TEXT",
];

// Default homepage layout — seeded when the table is empty so the builder opens
// on the current design, fully editable.
export const DEFAULT_SECTIONS: { type: HomeSectionType; config: Record<string, unknown> }[] = [
  { type: "HERO", config: {} },
  { type: "VIDEO_REELS", config: { title: "Shop by Category", items: [] } },
  { type: "FEATURED_COLLECTION", config: {} },
  { type: "FEATURED_PRODUCTS", config: { title: "Featured", limit: 8 } },
  { type: "NEW_ARRIVALS", config: { title: "New Arrivals", limit: 4 } },
  { type: "CATEGORY_SHOWCASE", config: {} },
  { type: "BRAND_STORY", config: {} },
];
