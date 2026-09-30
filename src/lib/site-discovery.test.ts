import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import packageJson from "../../package.json";

import { siteJsonLd } from "@/lib/site-json-ld";

const version = packageJson.version;

describe("agent discovery files", () => {
  it("repeats the package version in the indexes an agent would cite", () => {
    for (const file of ["public/llms.txt", "public/llms-full.txt", "CITATION.cff", "README.md"]) {
      expect(readFileSync(file, "utf8")).toContain(version);
    }
  });

  it("points the short index at the live demo and the full brief", () => {
    const index = readFileSync("public/llms.txt", "utf8");
    expect(index).toContain("https://jiaxiantao.github.io/3d-car-viewing/");
    expect(index).toContain("https://jiaxiantao.github.io/3d-car-viewing/llms-full.txt");
    expect(index).toContain("https://github.com/jiaxiantao/3d-car-viewing");
  });

  it("publishes software and source nodes that name the live demo", () => {
    const graph = siteJsonLd()["@graph"] as Array<{ "@type": string | string[]; url?: string }>;
    const types = graph.flatMap((node) => (Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]]));
    expect(types).toEqual(expect.arrayContaining(["WebSite", "SoftwareApplication", "SoftwareSourceCode"]));
    const app = graph.find((node) =>
      (Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]]).includes("SoftwareApplication"),
    );
    expect(app?.url).toBe("https://jiaxiantao.github.io/3d-car-viewing/");
  });
});
