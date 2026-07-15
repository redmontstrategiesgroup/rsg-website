/**
 * Public site contact facts. The phone number is the ONLY physical-contact
 * detail that is public — no street address and no business hours are ever
 * published (site copy, footer, or structured data).
 */

/** Canonical public site URL (no trailing slash). Env-overridable. */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://redmontstrategiesgroup.com";

/** Human-readable phone number for display. */
export const PHONE_DISPLAY = "781-588-0972";

/** E.164 form for `tel:` links and schema.org telephone. */
export const PHONE_TEL = "+17815880972";

/** Public contact email. */
export const CONTACT_EMAIL = "contact@redmontstrategiesgroup.com";

/** Official connect / link-in-bio path. */
export const CONNECT_PATH = "/connect";

/** Stable QR landing path (redirects to /connect?source=qr). */
export const CONNECT_QR_PATH = "/r/connect";
