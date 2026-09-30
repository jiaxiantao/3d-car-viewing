import type { MetadataRoute } from "next";

import { absoluteSiteUrl } from "@/lib/site";

/** Required so `output: "export"` prerenders this route. */
export const dynamic = "force-static";

const LAST_MODIFIED = new Date("2026-09-30");

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: absoluteSiteUrl("/"),
      lastModified: LAST_MODIFIED,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: absoluteSiteUrl("/llms.txt"),
      lastModified: LAST_MODIFIED,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: absoluteSiteUrl("/llms-full.txt"),
      lastModified: LAST_MODIFIED,
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];
}
