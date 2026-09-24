# Mainstream car models

Place licensed GLB files in this folder with these exact names:

| File | Category |
|------|----------|
| `suv-mainstream.glb` | SUV |
| `sedan-mainstream.glb` | Sedan |
| `offroad-mainstream.glb` | Off-road |
| `2024_xiaomi_su7_max.glb` | Xiaomi SU7 Max |
| `2025_xiaomi_su7_ultra.glb` | Xiaomi SU7 Ultra |
| `2025_xiaomi_yu7.glb` | Xiaomi YU7 |

The showroom loads them per category via `src/lib/car-categories.ts`. If a file is missing or fails to load, the built-in geometric car model is used instead.

The original three showroom GLBs are **Draco-compressed** (`pnpm compress:models`). The Xiaomi files are stored as provided; that script now includes them too. Uncompressed backups (`*-src.glb`) are gitignored — restore from git history if needed.

| File | Approx. size |
|------|----------------|
| `sedan-mainstream.glb` | ~2.7 MB |
| `offroad-mainstream.glb` | ~9.5 MB |
| `suv-mainstream.glb` | ~14.5 MB |
| `2024_xiaomi_su7_max.glb` | ~5.3 MB |
| `2025_xiaomi_su7_ultra.glb` | ~31 MB |
| `2025_xiaomi_yu7.glb` | ~28 MB |

## Shipped in this repository

| File | Source (documented) | License |
|------|---------------------|---------|
| `suv-mainstream.glb` | Poly Pizza — Quaternius "SUV" | CC0 1.0 (verify at source) |
| `offroad-mainstream.glb` | Poly Pizza — Quaternius "Rover" | CC0 1.0 (verify at source) |
| `sedan-mainstream.glb` | BMW M2 Coupe (high-poly demo) | **Verify before use** — see [documentation/ATTRIBUTION.md](../../../documentation/ATTRIBUTION.md) |
| `2024_xiaomi_su7_max.glb` | Xiaomi SU7 Max | **Verify before use** — see [documentation/ATTRIBUTION.md](../../../documentation/ATTRIBUTION.md) |
| `2025_xiaomi_su7_ultra.glb` | Xiaomi SU7 Ultra | **Verify before use** — see [documentation/ATTRIBUTION.md](../../../documentation/ATTRIBUTION.md) |
| `2025_xiaomi_yu7.glb` | Xiaomi YU7 | **Verify before use** — see [documentation/ATTRIBUTION.md](../../../documentation/ATTRIBUTION.md) |

**Important:** MIT applies to **source code only**, not necessarily to these meshes. Read [documentation/ATTRIBUTION.md](../../../documentation/ATTRIBUTION.md) before commercial redistribution.

## Adding your own models

1. Export as `.glb` with separated door/trunk/wheel meshes when you need those interactions.
2. Update `src/app/page.tsx` URLs if filenames differ.
3. Add regex rules in `src/lib/market-rig-profiles.ts` if auto-discovery is insufficient.
4. Document license and author in `documentation/ATTRIBUTION.md`.

See [documentation/market-glb-rig.md](../../../documentation/market-glb-rig.md) for rig naming conventions.
