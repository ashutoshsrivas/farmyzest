// Legal business identity printed on the customer bill / tax invoice.
//
// Kept as editable constants (the standalone deploy doesn't persist the JSON
// settings file, so a code constant is the reliable place). Fill GSTIN in when
// it's available — leave it blank and the invoice simply omits the line.
//
// Storefront brand is "Farmyzest"; the legal entity behind it is
// Nidhi Enterprises (Est. 1962).
export const BRAND_NAME = "Farmyzest";
export const BRAND_TAGLINE = "Everything for your garden & farm";
export const COMPANY_NAME = "Nidhi Enterprises";
export const COMPANY_ESTABLISHED = 1962;
export const COMPANY_GSTIN = ""; // e.g. "07ABCDE1234F1Z5" — fill in later

// Store contact block — printed on the bill / PDF invoice and policy pages.
// TODO(farmyzest): replace with Nidhi Enterprises' real address and phone.
export const STORE_ADDRESS = "Nidhi Enterprises — store address to be updated";
// Fallback everywhere via `settings.storePhone || STORE_PHONE`.
export const STORE_PHONE = "+91 00000 00000";
export const STORE_EMAIL = "info@farmyzest.com";

// Public site URL encoded into the invoice QR code.
export const SITE_URL = "https://farmyzest.com";

// Return / exchange terms printed on the bill.
export const RETURN_POLICY_TEXT =
  "Unused products in original packaging can be exchanged within 7 days. Seeds, plants, chemicals and opened fertilisers are non-returnable.";
