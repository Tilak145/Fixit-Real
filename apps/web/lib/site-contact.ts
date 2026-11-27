/**
 * The one place the site's public contact details live, so the header, footer
 * and policies cannot drift apart.
 */
export const SITE_PHONE = "(513) 668-6179";
export const SITE_PHONE_HREF = "tel:+15136686179";
export const SITE_EMAIL = "support@fixitls.com";

/**
 * Whether the testing-phase notice shows at the top of every page. Set to false
 * the day FixIt opens to the public.
 */
export const SITE_IN_TESTING = true;

/** The site's public address. Set NEXT_PUBLIC_SITE_URL wherever the site is hosted. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/u, "");
export const SITE_HOST = SITE_URL.replace(/^https?:\/\//u, "");
