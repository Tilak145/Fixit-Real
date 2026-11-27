import type { MetadataRoute } from "next";
import { listCategories, listPros } from "@/lib/fixit-server";
import { PUBLIC_ADDRESS } from "@/lib/public-address";

// Rebuilt at most once an hour, so a newly approved business appears without a deploy.
export const revalidate = 3600;

/** The pages anyone may visit, for search engines. Served at /sitemap.xml. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const page = (path: string, priority: number, changeFrequency: "daily" | "weekly" | "monthly") => ({
    url: `${PUBLIC_ADDRESS}${path}`,
    changeFrequency,
    priority,
  });
  const fixed = [
    page("/", 1, "daily"),
    page("/request", 0.8, "monthly"),
    page("/for-businesses", 0.8, "monthly"),
    page("/help", 0.5, "monthly"),
    page("/policies/privacy", 0.3, "monthly"),
    page("/policies/terms", 0.3, "monthly"),
    page("/policies/cookies", 0.2, "monthly"),
    page("/policies/pro-agreement", 0.3, "monthly"),
  ];
  // If the database cannot be reached, the fixed pages are still listed.
  const [categories, pros] = await Promise.all([
    listCategories().catch(() => []),
    listPros({ limit: 1000 }).catch(() => []),
  ]);
  return [
    ...fixed,
    ...categories.map((category) => page(`/services/${category.slug}`, 0.7, "daily")),
    ...pros.map((pro) => page(`/pros/${pro.id}`, 0.6, "weekly")),
  ];
}