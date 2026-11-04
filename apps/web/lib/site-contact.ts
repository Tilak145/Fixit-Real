/**
 * The one place the site's public contact details live, so the header, footer
 * and policies cannot drift apart. Replace these with the real business
 * details once they exist.
 */
export const SITE_PHONE = "(234) 555-0100";
export const SITE_PHONE_HREF = "tel:+12345550100";
export const SITE_EMAIL = "support@fixit.example";

/** The site's public address. Set NEXT_PUBLIC_SITE_URL wherever the site is hosted. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/u, "");
export const SITE_HOST = SITE_URL.replace(/^https?:\/\//u, "");
