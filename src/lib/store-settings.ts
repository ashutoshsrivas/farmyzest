import { promises as fs } from "fs";
import path from "path";
import { db } from "@/lib/db";

// Store profile lives in a JSON file (data/store-settings.json), written by the
// admin Settings page. Read it server-side for things like the printed tax
// invoice header. Kept in sync with the shape in /api/admin/settings.
export interface StoreSettings {
  storeName?: string;
  storeEmail?: string;
  gstNumber?: string;
  storeAddress?: string;
  storePhone?: string;
  storeState?: string;
  // GST % to assume on the tax invoice for items with no tax slab assigned.
  defaultGstRate?: number;
  interaktApiKey?: string;
  razorpayKeyId?: string;
  razorpayKeySecret?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  smtpFrom?: string;
  lowStockThreshold?: number;
  // Show "Cash on Delivery" at online checkout. Defaults to OFF (hidden) when
  // unset — admins opt in from the Settings page.
  codEnabled?: boolean;
  // Partial-payment: pay `partialPaymentPercent`% online now, the rest on
  // delivery. Off by default; only offered when enabled with a valid percent.
  partialPaymentEnabled?: boolean;
  partialPaymentPercent?: number;
}

const SETTINGS_FILE = path.join(process.cwd(), "data", "store-settings.json");

export const STORE_SETTING_ID = "singleton";

/**
 * Read the store profile, or {} if it has never been saved. Never throws.
 *
 * Source of truth is the DB (`StoreSetting` singleton row) so values survive a
 * deploy. Falls back to the legacy JSON file only if the DB has nothing yet
 * (pre-migration installs) — harmless once settings are re-saved to the DB.
 */
export async function readStoreSettings(): Promise<StoreSettings> {
  try {
    const row = await db.storeSetting.findUnique({ where: { id: STORE_SETTING_ID } });
    if (row?.data && typeof row.data === "object") return row.data as StoreSettings;
  } catch {
    /* DB unavailable — fall through to the legacy file */
  }
  try {
    const raw = await fs.readFile(SETTINGS_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/** Whether Cash on Delivery is available at online checkout (default: off). */
export async function isCodEnabled(): Promise<boolean> {
  const s = await readStoreSettings();
  return s.codEnabled === true;
}

/**
 * Partial-payment config for online checkout. Enabled only when the admin
 * turned it on AND a sane percent (1–99) is set; otherwise disabled.
 */
export async function getPartialPaymentConfig(): Promise<{ enabled: boolean; percent: number }> {
  const s = await readStoreSettings();
  const percent = Math.round(Number(s.partialPaymentPercent) || 0);
  const enabled = s.partialPaymentEnabled === true && percent >= 1 && percent <= 99;
  return { enabled, percent: enabled ? percent : 0 };
}
