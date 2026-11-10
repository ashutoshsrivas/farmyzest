import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { promises as fs } from "fs";
import path from "path";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { STORE_SETTING_ID } from "@/lib/store-settings";

// Legacy file — read once as a fallback so nothing is lost migrating to the DB.
const SETTINGS_FILE = path.join(process.cwd(), "data", "store-settings.json");

interface StoreSettings {
  storeName?: string;
  storeEmail?: string;
  storeAddress?: string;
  storePhone?: string;
  storeState?: string;
  defaultGstRate?: number;
  interaktApiKey?: string;
  razorpayKeyId?: string;
  razorpayKeySecret?: string;
  gstNumber?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  smtpFrom?: string;
  lowStockThreshold?: number;
  codEnabled?: boolean;
  partialPaymentEnabled?: boolean;
  partialPaymentPercent?: number;
}

async function readSettings(): Promise<StoreSettings> {
  try {
    const row = await db.storeSetting.findUnique({ where: { id: STORE_SETTING_ID } });
    if (row?.data && typeof row.data === "object") return row.data as StoreSettings;
  } catch {
    /* fall through to the legacy file */
  }
  try {
    const raw = await fs.readFile(SETTINGS_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

// Persist to the DB so settings survive a deploy (the standalone app dir — and
// with it the old JSON file — is replaced wholesale on every release).
async function writeSettings(data: StoreSettings) {
  const json = data as Prisma.InputJsonValue;
  await db.storeSetting.upsert({
    where: { id: STORE_SETTING_ID },
    create: { id: STORE_SETTING_ID, data: json },
    update: { data: json },
  });
}

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const settings = await readSettings();
    // Never expose passwords or secrets
    const safe = { ...settings };
    if (safe.smtpPass) safe.smtpPass = "********";
    if (safe.interaktApiKey) safe.interaktApiKey = safe.interaktApiKey.slice(0, 8) + "****";
    if (safe.razorpayKeySecret) safe.razorpayKeySecret = "********";

    return NextResponse.json(safe);
  } catch (error) {
    console.error("GET /api/admin/settings error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// The form posts every field as a string and leaves blanks as "". Drop empties
// so optional fields stay unset, and coerce the numeric ones.
const emptyToUndef = (v: unknown) => (v === "" || v == null ? undefined : v);

const updateSettingsSchema = z.object({
  storeName: z.string().optional(),
  storeEmail: z.preprocess(emptyToUndef, z.string().email().optional()),
  storeAddress: z.string().optional(),
  storePhone: z.string().optional(),
  storeState: z.string().optional(),
  defaultGstRate: z.preprocess(emptyToUndef, z.coerce.number().min(0).max(100).optional()),
  interaktApiKey: z.string().optional(),
  razorpayKeyId: z.string().optional(),
  razorpayKeySecret: z.string().optional(),
  gstNumber: z.string().optional(),
  smtpHost: z.string().optional(),
  smtpPort: z.preprocess(emptyToUndef, z.coerce.number().int().min(1).max(9999).optional()),
  smtpUser: z.string().optional(),
  smtpPass: z.string().optional(),
  smtpFrom: z.preprocess(emptyToUndef, z.string().email().optional()),
  lowStockThreshold: z.preprocess(emptyToUndef, z.coerce.number().int().min(0).optional()),
  // Posted as a real boolean by the settings form's toggle. Tolerate string too.
  codEnabled: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v === true || v === "true"),
    z.boolean().optional()
  ),
  partialPaymentEnabled: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v === true || v === "true"),
    z.boolean().optional()
  ),
  partialPaymentPercent: z.preprocess(emptyToUndef, z.coerce.number().int().min(1).max(99).optional()),
});

// GET masks secrets (e.g. smtpPass → "********", interaktApiKey → "abc12345****").
// If the form re-submits those masked values verbatim, we must NOT overwrite the
// real secret with the mask — so drop any field still holding a mask sentinel.
function stripMaskedSecrets(data: Record<string, unknown>) {
  const out = { ...data };
  if (out.smtpPass === "********") delete out.smtpPass;
  if (out.razorpayKeySecret === "********") delete out.razorpayKeySecret;
  if (typeof out.interaktApiKey === "string" && out.interaktApiKey.endsWith("****"))
    delete out.interaktApiKey;
  return out;
}

async function applySettingsUpdate(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = updateSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const current = await readSettings();
    await writeSettings({ ...current, ...stripMaskedSecrets(parsed.data) });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/admin/settings error:", error);
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}

// The settings form submits via POST; keep PUT as an alias for API clients.
export const POST = applySettingsUpdate;
export const PUT = applySettingsUpdate;