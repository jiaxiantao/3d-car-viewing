# Third-party assets and licensing

The **source code** in this repository is licensed under the [MIT License](../LICENSE).

The **3D models** under `public/models/market/` are **not** covered by that license. They remain the property of their respective creators and may be subject to separate terms, trademarks (e.g. vehicle brands), and usage restrictions.

## Bundled models (as shipped in this repo)

| File | Description | Known license / source | Notes |
|------|-------------|------------------------|--------|
| `suv-mainstream.glb` | SUV (Audi Q3–style) | Poly Pizza / Quaternius — **CC0 1.0** (per `public/models/market/README.md`) | Verify on [Poly Pizza](https://poly.pizza/) before commercial use |
| `offroad-mainstream.glb` | Off-road (Brabus G900–style) | Poly Pizza / Quaternius — **CC0 1.0** (per README) | Same as above |
| `sedan-mainstream.glb` | BMW M2 Coupe | **Verify independently** | High-poly Sketchfab-style asset; BMW trademark may apply. **Do not assume CC0.** Replace with your own licensed model for production |
| `2024_xiaomi_su7_max.glb` | Xiaomi SU7 Max | **Verify independently** | User-supplied GLB. Xiaomi trademark may apply. **Do not assume a permissive license.** |
| `2025_xiaomi_su7_ultra.glb` | Xiaomi SU7 Ultra | **Verify independently** | Same as above |
| `2025_xiaomi_yu7.glb` | Xiaomi YU7 | **Verify independently** | Same as above |
| `2025_mercedes-benz_g-class_amg_g_63.glb` | Mercedes-AMG G 63 | **Verify independently** | User-supplied GLB. Mercedes-Benz trademark may apply. **Do not assume a permissive license.** |
| `2023_jeep_wrangler_rubicon_392_20th_anniversary.glb` | Jeep Wrangler Rubicon 392 | **Verify independently** | User-supplied GLB. Jeep trademark may apply. **Do not assume a permissive license.** |

Scene models under `public/models/scene/` are also third-party:

| File | Description | Known license / source | Notes |
|------|-------------|------------------------|--------|
| `white_round_exhibition_gallery.glb` | White round exhibition gallery (影棚背景) | ChristyHsu — **CC-BY-4.0** | [Sketchfab](https://sketchfab.com/3d-models/white-round-exhibition-gallery-a443b8a0a2314a55ae5dee4dd6a151a0). Credit the author if you redistribute. |
| `car-showroom_1.glb` | Car showroom hall (大厅背景) | Polsaris — **CC-BY-NC-4.0** | [Sketchfab](https://sketchfab.com/3d-models/car-showroom-1-40b0ae06eb8343e5bacf34e04fcfff73). Non-commercial. Credit the author if you redistribute. |
| `realtime_grass.glb` | Roadside grass | Sketchfab export — **verify independently** | Generator `Sketchfab-12.65.0`. Do not assume a permissive license. |
| `tree_animate.glb` | Roadside trees | Sketchfab export — **verify independently** | Generator `Sketchfab-14.4.0`. Uses deprecated specular-glossiness materials. |

## Your responsibilities

If you fork, redistribute, or deploy this project publicly:

1. **Keep** this attribution file accurate when you add or replace GLBs.
2. **Do not** imply endorsement by vehicle manufacturers.
3. For **commercial** products, obtain proper licenses for all 3D assets and brand usage.
4. Prefer **CC0 / explicitly licensed** models from [Poly Pizza](https://poly.pizza/), [Kenney](https://kenney.nl/), or assets you created yourself.

## Replacing demo models

1. Export GLB with separated door/trunk/wheel meshes if you need those interactions (see [market-glb-rig.md](./market-glb-rig.md)).
2. Place files in `public/models/market/` using the expected filenames, or register a new URL in `src/lib/car-categories.ts`.
3. Add a row to the table above and to `public/models/market/README.md`.

## Code dependencies

Runtime libraries (Next.js, Three.js, R3F, etc.) are listed in `package.json` and governed by their own licenses. Run `pnpm licenses` (with a licenses plugin) locally if you need a full SBOM for compliance audits.
