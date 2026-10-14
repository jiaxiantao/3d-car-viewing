import type { NextConfig } from "next";

const isGhPages = process.env.GH_PAGES === "1";
const ghPagesBasePath = "/3d-car-viewing";

const nextConfig: NextConfig = {
  output: isGhPages ? "export" : "standalone",
  basePath: isGhPages ? ghPagesBasePath : undefined,
  assetPrefix: isGhPages ? ghPagesBasePath : undefined,
  trailingSlash: isGhPages ? true : undefined,
  images: {
    unoptimized: isGhPages,
  },
  env: {
    // Static Pages builds call the model from the browser. Dev and standalone proxy it.
    NEXT_PUBLIC_SHOWROOM_AI_PROXY: isGhPages ? "0" : "1",
  },
  ...(!isGhPages
    ? {
        async headers() {
          return [
            {
              source: "/models/:path*",
              headers: [
                {
                  key: "Cache-Control",
                  value: "public, max-age=31536000, immutable",
                },
              ],
            },
          ];
        },
      }
    : {}),
};

export default nextConfig;
