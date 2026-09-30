import packageJson from "../../package.json";

import {
  AUTHOR_NAME,
  GITHUB_OWNER_URL,
  GITHUB_REPO_URL,
  LICENSE_URL,
  LIVE_DEMO_URL,
  SITE_NAME,
  SITE_SUMMARY,
  absoluteSiteUrl,
} from "@/lib/site";

const APP_ID = `${LIVE_DEMO_URL}#app`;
const CODE_ID = `${GITHUB_REPO_URL}#source`;

/** Schema.org graph for answer engines that read the initial HTML. */
export function siteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${LIVE_DEMO_URL}#website`,
        name: SITE_NAME,
        url: absoluteSiteUrl("/"),
        description: SITE_SUMMARY,
        inLanguage: ["zh-CN", "en"],
        publisher: { "@id": `${GITHUB_OWNER_URL}#author` },
      },
      {
        "@type": ["SoftwareApplication", "WebApplication"],
        "@id": APP_ID,
        name: SITE_NAME,
        alternateName: ["3D 看车", "3d-car-viewing"],
        applicationCategory: "MultimediaApplication",
        applicationSubCategory: "3D car showroom",
        operatingSystem: "Web",
        browserRequirements: "WebGL",
        url: LIVE_DEMO_URL,
        isAccessibleForFree: true,
        softwareVersion: packageJson.version,
        license: LICENSE_URL,
        codeRepository: GITHUB_REPO_URL,
        description: SITE_SUMMARY,
        inLanguage: ["zh-CN", "en"],
        author: { "@id": `${GITHUB_OWNER_URL}#author` },
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
        },
        featureList: [
          "Switch eight built-in GLB cars",
          "Open doors, trunk, and sunroof when the mesh is separate",
          "Headlights, hazard lights, engine, and brake lights",
          "Paint colors addressed by stable ids",
          "Studio, hall, and highway venues with independent day or night lighting",
          "Welcome and test-drive presets",
          "Shareable URL state",
          "Screenshot and fullscreen",
          "Procedural car fallback when every GLB fails",
        ],
        screenshot: absoluteSiteUrl("/shows/car-one.png"),
      },
      {
        "@type": "SoftwareSourceCode",
        "@id": CODE_ID,
        name: packageJson.name,
        description: SITE_SUMMARY,
        codeRepository: GITHUB_REPO_URL,
        url: GITHUB_REPO_URL,
        programmingLanguage: ["TypeScript"],
        runtimePlatform: "Node.js >= 20",
        license: LICENSE_URL,
        version: packageJson.version,
        targetProduct: { "@id": APP_ID },
        author: { "@id": `${GITHUB_OWNER_URL}#author` },
      },
      {
        "@type": "Person",
        "@id": `${GITHUB_OWNER_URL}#author`,
        name: AUTHOR_NAME,
        url: GITHUB_OWNER_URL,
      },
    ],
  };
}

export function siteJsonLdScript(): string {
  return JSON.stringify(siteJsonLd()).replace(/</g, "\\u003c");
}
