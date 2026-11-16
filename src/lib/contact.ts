import { readStoreSettings } from "@/lib/store-settings";
import { STORE_ADDRESS, STORE_EMAIL, STORE_PHONE } from "@/lib/company";

// Customer-facing contact details. Values come from admin → Settings first,
// then src/lib/company.ts. Placeholders ("+91 00000 00000", "to be updated")
// are treated as missing so the storefront never shows invented details.

export interface StoreContact {
  phone: string | null;
  phoneHref: string | null;
  whatsapp: string | null; // digits incl. country code, for wa.me links
  email: string | null;
  address: string | null;
}

const isPlaceholderPhone = (v: string) => v.replace(/\D/g, "").replace(/^91/, "").replace(/0/g, "") === "";
const isPlaceholderText = (v: string) => /to be updated|todo|placeholder/i.test(v);

function clean(v: string | undefined | null, check: (s: string) => boolean): string | null {
  const t = (v ?? "").trim();
  return t && !check(t) ? t : null;
}

export async function getStoreContact(): Promise<StoreContact> {
  const s = await readStoreSettings();
  const phone = clean(s.storePhone, isPlaceholderPhone) ?? clean(STORE_PHONE, isPlaceholderPhone);
  const waRaw = clean(s.whatsappNumber, isPlaceholderPhone);
  let whatsapp = waRaw ? waRaw.replace(/\D/g, "") : null;
  if (whatsapp && whatsapp.length === 10) whatsapp = `91${whatsapp}`;
  return {
    phone,
    phoneHref: phone ? `tel:${phone.replace(/[^\d+]/g, "")}` : null,
    whatsapp,
    email: clean(s.storeEmail, isPlaceholderText) ?? clean(STORE_EMAIL, isPlaceholderText),
    address: clean(s.storeAddress, isPlaceholderText) ?? clean(STORE_ADDRESS, isPlaceholderText),
  };
}

/** wa.me link with an optional prefilled message. */
export function whatsappLink(number: string, message?: string): string {
  return `https://wa.me/${number}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
}
