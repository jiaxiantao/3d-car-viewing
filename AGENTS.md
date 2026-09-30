<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# 3D Car Viewing

Browser showroom: https://jiaxiantao.github.io/3d-car-viewing/

Repository: https://github.com/jiaxiantao/3d-car-viewing

Source code is MIT. GLB files under `public/models/` are third-party and are not MIT. Read `documentation/ATTRIBUTION.md` before adding, replacing, or redistributing models.

Machine-readable index for answer engines: `public/llms.txt` and `public/llms-full.txt`. Citation file: `CITATION.cff`.

## Commands

```bash
pnpm install
pnpm dev
pnpm test
pnpm typecheck
pnpm lint
```

## Where to change behavior

- Car list and GLB paths: `src/lib/car-categories.ts`
- Mesh discovery: `src/lib/asset-car-rig/`
- Per-model name overrides: `src/lib/market-rig-profiles.ts`
- URL query (`model`, `paint`, `camera`, `mode`, `light`): `src/lib/use-showroom-url-state.ts`
- Venues and day/night lighting: `src/lib/showroom-scene-modes.ts`
- Page state, presets, and capability gating: `src/lib/use-showroom-page-state.ts`
- Canvas lifecycle: `src/components/car-showroom-scene.tsx`

`mode=day` and `mode=night` are legacy studio links. New links use `mode=studio|hall|road` and `light=day|night`.

## Checks before finishing

Run `pnpm test`, `pnpm typecheck`, and `pnpm lint`. Do not commit `.env` files. Do not claim the bundled car meshes are MIT.
