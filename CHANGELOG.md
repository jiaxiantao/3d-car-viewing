# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **GitHub Pages:** static export (`pnpm build:pages`) and `deploy-pages` workflow for live demo at https://jiaxiantao.github.io/3d-car-viewing/.
- **Share link:** toolbar button and `C` keyboard shortcut copy the current showroom URL (model / paint / camera / scene mode).
- **GLB idle preload:** after the active model loads, other category GLBs warm the in-memory cache via `requestIdleCallback` for faster switching.
- Technical blog draft: `docs/3D看车技术博客.md`.

### Changed

- **GitHub Pages asset paths:** GLB URLs use site-relative paths so models load under `/3d-car-viewing` instead of the domain root.
- **CI workflow split:** `CI` runs on pull requests only; `main` pushes use a single `Deploy GitHub Pages` job (lint, typecheck, build, deploy).
- **Category switch:** door / trunk / sunroof interaction state resets when changing vehicle category to avoid stale UI against a new rig.

### Removed

- Commercial UI: spec / pricing card, test-drive booking dialog, share-config CTA, and JSON-LD `Vehicle` structured data with pricing.
- `car-specs.ts` replaced by minimal `car-categories.ts` (category key, label, GLB path only).

### Added

- **Brake light physics:** rear lights brighten when braking is engaged on both GLB and the procedural fallback car.
- **Scene modes:** "studio" / "day" / "night" presets driving environment intensity, ambient / directional / hemisphere lights, fog, floor color, roughness, metalness, and headlight spotlight intensity. Configurable via `src/lib/showroom-scene-modes.ts`.
- **Quick action toolbar:** scene mode radio group, in-canvas screenshot, and fullscreen mode.
- **URL state sync:** `?model=…&paint=…&camera=…&mode=…` reflects the current configuration; uses `history.replaceState` so exploration does not pollute the back stack.
- **Keyboard shortcuts:** `1`–`6` camera presets, `T` auto-tour, `E` engine, `L` lights, `H` hazards, `A`/`D` doors, `B` trunk, `S` screenshot, `F` fullscreen. Disabled while typing or with modifier keys held.
- **Mobile responsiveness:** 60vh canvas, tab-based interaction tray, wrap-friendly category buttons.
- Open-source documentation: LICENSE (MIT), CONTRIBUTING, SECURITY, architecture and attribution docs.
- GitHub issue / PR templates and CI concurrency.

### Changed

- **Performance:** enabled `AdaptiveDpr` + `AdaptiveEvents`, capped device pixel ratio at `[1, 1.75]`, opted into `preserveDrawingBuffer` so screenshots capture the live frame.
- **Lighting refactor:** `ShowroomEnvironment` and `ShowroomReflectiveFloor` consume the active scene-mode config rather than hard-coded constants.
- **Pointer ergonomics:** interactive part hover uses a reference-counted cursor controller — no more leaked `cursor: pointer` after route / model changes.
- Body / hover ARIA: interactive control buttons now expose `aria-pressed` for screen readers; paint swatches show a color-coded preview.

## [0.1.0] - 2026-06-02

### Added

- Initial 3D car showroom: GLB switching, rig discovery, geometric fallback, camera presets, auto tour.
- Local `RoomEnvironment` image-based lighting (no external HDR CDN).
- Docker / standalone Next.js deployment and GitHub Actions CI (lint, typecheck, build).
