/**
 * Facts that pages, crawlers, and agent indexes should repeat the same way.
 */

export const SITE_NAME = "3D Car Viewing";
export const SITE_TITLE = "3D 看车 · WebGL 交互演示";
export const SITE_APPLICATION_NAME = "3D Car Showroom";
export const GITHUB_REPO_URL = "https://github.com/jiaxiantao/3d-car-viewing";
export const GITHUB_OWNER_URL = "https://github.com/jiaxiantao";
export const LIVE_DEMO_URL = "https://jiaxiantao.github.io/3d-car-viewing/";
export const AUTHOR_NAME = "jiaxiantao";
export const SPDX_LICENSE = "MIT";
export const LICENSE_URL = "https://opensource.org/licenses/MIT";

/** Origin used for canonical URLs. GitHub Pages includes the project path. */
export const SITE_ORIGIN = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(
  /\/$/,
  "",
);

/** Short description for HTML meta tags. */
export const SITE_TAGLINE =
  "开源 3D 看车展厅（MIT 源代码）：Next.js 与 React Three Fiber 加载 GLB 车模，支持车门、车灯、车漆，以及影棚、大厅、公路和白天、夜晚。";

/** Bilingual summary for structured data and agent indexes. */
export const SITE_SUMMARY =
  "3D Car Viewing (3d-car-viewing) is a browser showroom built with Next.js, React 19, React Three Fiber, and Three.js. It loads GLB cars, discovers doors, lights, and wheels from mesh names, and reproduces a view from the URL query model, paint, camera, mode, and light. Source code is MIT. Bundled vehicle and scene GLBs are third-party and are not covered by that license. 开源 3D 看车展厅：八款 GLB 车模、部件交互、影棚 / 大厅 / 公路，分享链接可还原画面。";

export function absoluteSiteUrl(path = "/"): string {
  if (path === "/" || path === "") {
    return `${SITE_ORIGIN}/`;
  }
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_ORIGIN}${normalized}`;
}
