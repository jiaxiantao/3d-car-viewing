# Mainstream car models

Place licensed GLB files in this folder with these exact names:

| File | Category |
|------|----------|
| `suv-mainstream.glb` | SUV |
| `sedan-mainstream.glb` | Sedan |
| `offroad-mainstream.glb` | Off-road |

The showroom loads them per category in `src/app/page.tsx`. If a file is missing or fails to load, the built-in geometric car model is used instead.

## Shipped in this repository

| File | Source (documented) | License |
|------|---------------------|---------|
| `suv-mainstream.glb` | Poly Pizza — Quaternius "SUV" | CC0 1.0 (verify at source) |
| `offroad-mainstream.glb` | Poly Pizza — Quaternius "Rover" | CC0 1.0 (verify at source) |
| `sedan-mainstream.glb` | BMW M2 Coupe (high-poly demo) | **Verify before use** — see [docs/ATTRIBUTION.md](../../../docs/ATTRIBUTION.md) |

**Important:** MIT applies to **source code only**, not necessarily to these meshes. Read [docs/ATTRIBUTION.md](../../../docs/ATTRIBUTION.md) before commercial redistribution.

## Adding your own models

1. Export as `.glb` with separated door/trunk/wheel meshes when you need those interactions.
2. Update `src/app/page.tsx` URLs if filenames differ.
3. Add regex rules in `src/lib/market-rig-profiles.ts` if auto-discovery is insufficient.
4. Document license and author in `docs/ATTRIBUTION.md`.

See [docs/market-glb-rig.md](../../../docs/market-glb-rig.md) for rig naming conventions.
