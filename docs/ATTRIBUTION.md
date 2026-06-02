# Third-party assets and licensing

The **source code** in this repository is licensed under the [MIT License](../LICENSE).

The **3D models** under `public/models/market/` are **not** covered by that license. They remain the property of their respective creators and may be subject to separate terms, trademarks (e.g. vehicle brands), and usage restrictions.

## Bundled models (as shipped in this repo)

| File | Description | Known license / source | Notes |
|------|-------------|------------------------|--------|
| `suv-mainstream.glb` | SUV (Audi Q3–style) | Poly Pizza / Quaternius — **CC0 1.0** (per `public/models/market/README.md`) | Verify on [Poly Pizza](https://poly.pizza/) before commercial use |
| `offroad-mainstream.glb` | Off-road (Brabus G900–style) | Poly Pizza / Quaternius — **CC0 1.0** (per README) | Same as above |
| `sedan-mainstream.glb` | BMW M2 Coupe | **Verify independently** | High-poly Sketchfab-style asset; BMW trademark may apply. **Do not assume CC0.** Replace with your own licensed model for production |

## Your responsibilities

If you fork, redistribute, or deploy this project publicly:

1. **Keep** this attribution file accurate when you add or replace GLBs.
2. **Do not** imply endorsement by vehicle manufacturers.
3. For **commercial** products, obtain proper licenses for all 3D assets and brand usage.
4. Prefer **CC0 / explicitly licensed** models from [Poly Pizza](https://poly.pizza/), [Kenney](https://kenney.nl/), or assets you created yourself.

## Replacing demo models

1. Export GLB with separated door/trunk/wheel meshes if you need those interactions (see [market-glb-rig.md](./market-glb-rig.md)).
2. Place files in `public/models/market/` using the expected filenames, or update URLs in `src/app/page.tsx`.
3. Add a row to the table above and to `public/models/market/README.md`.

## Code dependencies

Runtime libraries (Next.js, Three.js, R3F, etc.) are listed in `package.json` and governed by their own licenses. Run `pnpm licenses` (with a licenses plugin) locally if you need a full SBOM for compliance audits.
