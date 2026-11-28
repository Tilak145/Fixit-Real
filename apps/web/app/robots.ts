import type { MetadataRoute } from "next";
import { PUBLIC_ADDRESS } from "@/lib/public-address";

/** Tells search engines what to skip (private and sign-in pages) and where the sitemap is. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/account", "/pro/", "/manage", "/api/", "/login", "/register", "/forgot-password", "/reset-password"],
    },
    sitemap: `${PUBLIC_ADDRESS}/sitemap.xml`,
  };
}