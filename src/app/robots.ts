import type { MetadataRoute } from "next";

import { absoluteSiteUrl } from "@/lib/site";

/** Required so `output: "export"` prerenders this route. */
export const dynamic = "force-static";

const AI_CRAWLERS = [
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  "ClaudeBot",
  "Claude-User",
  "anthropic-ai",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot-Extended",
  "Amazonbot",
  "Bytespider",
  "CCBot",
  "Meta-ExternalAgent",
  "cohere-ai",
];

/** Allow search and answer-engine crawlers, and point them at the sitemap. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/" },
      ...AI_CRAWLERS.map((userAgent) => ({ userAgent, allow: "/" })),
    ],
    sitemap: absoluteSiteUrl("/sitemap.xml"),
  };
}
