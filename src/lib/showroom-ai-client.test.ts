import { describe, expect, it } from "vitest";

import { explainAiTransportError } from "@/lib/showroom-ai-client";

describe("explainAiTransportError", () => {
  it("tells a static-site caller that the provider must allow CORS", () => {
    expect(explainAiTransportError(new TypeError("Failed to fetch"), "direct")).toContain(
      "Access-Control-Allow-Origin",
    );
  });

  it("tells a proxied caller to check the local server", () => {
    expect(explainAiTransportError(new TypeError("Failed to fetch"), "proxy")).toContain("pnpm dev");
  });
});
