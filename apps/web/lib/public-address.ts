import { SITE_URL } from "@/lib/site-contact";

/**
 * The address search engines should see. A local or unset address must never
 * end up in the sitemap, so the real domain is used instead.
 */
export const PUBLIC_ADDRESS = /localhost|127\.0\.0\.1/u.test(SITE_URL) ? "https://www.fixitls.com" : SITE_URL;