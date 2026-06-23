/**
 * Paths to files in `public/`. Use site-relative paths (no leading slash) so GLB
 * and other assets resolve correctly under a subpath such as /3d-car-viewing.
 */
export function publicAssetPath(path: string): string {
  return path.replace(/^\/+/, "");
}
