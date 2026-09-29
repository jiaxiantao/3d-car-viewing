# Architecture

This document describes how the 3D showroom is structured for contributors.

## High-level flow

```mermaid
flowchart TB
  subgraph ui [Next.js UI]
    Page["page.tsx\nlayout shell"]
    State["use-showroom-page-state"]
  end
  subgraph r3f [React Three Fiber]
  Scene["CarShowroomScene\nCanvas orchestration"]
  Env["ShowroomEnvironment\nfloor + IBL + lights"]
  Asset["AssetModel\nGLB + rig animations"]
  Fallback["CarModel\nprocedural mesh"]
  Cam["CameraRig\norbit + presets"]
  end
  subgraph lib [Libraries]
  Rig["asset-car-rig/\ndiscoverAssetCarRig"]
  Profiles["market-rig-profiles.ts"]
  Norm["normalize-market-model.ts"]
  Camera["showroom-camera.ts"]
  Cache["gltf-scene-cache.ts\nDraco preload + LRU"]
  end
  Page --> State
  State --> Scene
  Scene --> Env
  Scene --> Asset
  Scene --> Fallback
  Scene --> Cam
  Scene --> Cache
  Asset --> Rig
  Rig --> Profiles
  Asset --> Norm
  Cam --> Camera
```

## State ownership

| Layer | Responsibility |
|-------|----------------|
| `use-showroom-page-state.ts` | User-facing toggles, URL hydrate, presets, capability gating |
| `page.tsx` | Layout shell: canvas, viewport chrome, control panels |
| `car-showroom-scene.tsx` | WebGL lifecycle: GLTF loading, overlay, camera, screenshot bridge |
| `showroom/asset-car-model.tsx` / `procedural-car-model.tsx` | Per-frame mesh animation |
| `asset-car-rig/` | One-time scan of a loaded `THREE.Object3D` tree → `AssetCarRig` handles |
| `market-rig-profiles.ts` | Per-URL regex overrides when auto-discovery is ambiguous |

Interaction buttons on the page are **disabled until** `onAssetRigCapabilities` reports which features the current GLB supports.

## GLB load pipeline

1. `use-showroom-page-state.ts` selects `modelUrl` from `car-categories.ts`.
2. `AssetModel` tries `modelUrl`, then optional alternates / fallback URL.
3. On success: `normalizeMarketModel()` scales/grounds the root; `discoverAssetCarRig()` builds rig + capability flags.
4. On failure: `useGeometricFallback` → render `CarModel` instead.
5. While loading: previous GLB may stay visible under a fullscreen `Html` loader (drei).
6. After the active model is ready, `scheduleIdleGltfPreloads()` warms other category URLs in `gltf-scene-cache.ts` when the browser is idle.

## Camera

`showroom-camera.ts` computes framing from an axis-aligned bounding box of the active car root. Orbit min/max distance and preset positions (overview, front, interior, etc.) derive from that box so different vehicle scales share one code path.

## Environment

`showroom-environment.tsx` uses Three.js `RoomEnvironment` + PMREM for reflections. No `@react-three/drei` `<Environment preset="…" />` CDN fetch — suitable for offline / air-gapped deploys.

## Extension points

- **New vehicle:** add a GLB under `public/models/market/`, register it in `car-categories.ts`, and add a `MarketRigProfile` when auto-discovery is ambiguous.
- **New interaction:** extend discovery under `asset-car-rig/` and wire the animation in `showroom/asset-car-model.tsx`.
- **Performance:** shadow map size, `dpr` cap, and reflector resolution are centralized in `car-showroom-scene.tsx` Canvas props.

See also [market-glb-rig.md](./market-glb-rig.md) for mesh naming requirements.
