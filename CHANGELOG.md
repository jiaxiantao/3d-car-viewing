# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Showroom lineup:** 奔驰 AMG G63 与 Jeep 牧马人排在巴博斯 G900 之前。G63 支持前门、车灯、改色、四轮和驾驶视角；牧马人支持四门、侧开尾门、车灯、改色、四轮和驾驶视角。
- **Highway scene:** 场景模式新增「公路」。车辆停在路中央，画面包含沥青公路、两侧草地和晴空。分享链接使用 `mode=road`。

### Changed

- **Drive preset:** 驾驶预备模式前轮保持回正，只向前滚动。

## [0.2.0] - 2026-09-29

### Added

- **Showroom lineup:** 小米 SU7 Ultra（默认）、小米 YU7、小米 SU7 Max、奥迪 Q3、巴博斯 G900、宝马 M2。每款都做四轮滚动；G900 的车门与后备箱在展厅中关闭，SU7 Max 与 M2 的门、后备箱、天窗与车身合并。
- **Scene modes:** studio / day / night presets for lights, fog, floor, and headlight intensity (`src/lib/showroom-scene-modes.ts`).
- **Showroom tools:** in-canvas screenshot, fullscreen, share link (`C`), and URL state (`?model=&paint=&camera=&mode=`) via `history.replaceState`.
- **Keyboard shortcuts:** `1`–`6` cameras, `T` auto-tour, `E` engine, `L` lights, `H` hazards, `A`/`D` doors, `B` trunk, `S` screenshot, `F` fullscreen.
- **Draco pipeline:** `pnpm compress:models` and a local `public/draco/gltf` decoder. Compressed market GLBs are about 91MB.
- **Loading:** bandwidth-aware idle preload, keep the previous model visible until the next GLB is ready, and `prefers-reduced-motion` support.
- **Brake lights** on both GLB cars and the procedural fallback.
- **GitHub Pages** static export at https://jiaxiantao.github.io/3d-car-viewing/, deployed with Actions artifacts.
- **Vitest** coverage for categories, URL state, and per-model rig fixtures.
- Open-source docs: MIT license, contributing, security, architecture, attribution, and the technical blog.

### Changed

- **Rig layout:** `discoverAssetCarRig` now lives in `src/lib/asset-car-rig/`, split into lights, body, wheels, materials, and mesh helpers. The public import `@/lib/asset-car-rig` is unchanged.
- **Page state** moved to `use-showroom-page-state`; the canvas chrome (scene mode, paint, body controls) sits on the viewport.
- **GitHub Pages** asset paths are site-relative, so GLBs load under `/3d-car-viewing`. PR CI runs lint, typecheck, test, build, and `build:pages`.
- **Performance:** `AdaptiveDpr` / `AdaptiveEvents`, device pixel ratio capped at `[1, 1.75]`, `preserveDrawingBuffer` for screenshots.
- Switching category resets door, trunk, and sunroof state so the UI does not keep the previous rig's toggles.
- README screenshots and model docs match the current showroom.

### Removed

- Commercial UI: spec / pricing card, test-drive booking, and priced `Vehicle` JSON-LD.
- `car-specs.ts`, replaced by `car-categories.ts`.

## [0.1.0] - 2026-06-02

### Added

- Initial 3D car showroom: GLB switching, rig discovery, geometric fallback, camera presets, auto tour.
- Local `RoomEnvironment` image-based lighting (no external HDR CDN).
- Docker / standalone Next.js deployment and GitHub Actions CI (lint, typecheck, build).
