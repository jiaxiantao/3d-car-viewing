# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Brake light physics:** rear lights brighten when braking is engaged on both GLB and the procedural fallback car.
- **Scene modes:** "studio" / "day" / "night" presets driving environment intensity, ambient / directional / hemisphere lights, fog, floor color, roughness, metalness, and headlight spotlight intensity. Configurable via `src/lib/showroom-scene-modes.ts`.
- **Quick action toolbar:** scene mode radio group, in-canvas screenshot (downloads `3d-car-<category>-<timestamp>.png`), and fullscreen mode.
- **Spec / pricing card** with starting price, headline performance numbers and feature bullets per category, plus **"预约试驾"** CTA dialog with name + 11-digit CN phone validation, and a **"分享配置"** action that prefers `navigator.share` and falls back to clipboard for the deep link.
- **URL state sync:** `?model=…&paint=…&camera=…&mode=…` reflects the current configuration; uses `history.replaceState` so exploration does not pollute the back stack.
- **Keyboard shortcuts:** `1`–`6` camera presets, `T` auto-tour, `E` engine, `L` lights, `H` hazards, `A`/`D` doors, `B` trunk, `S` screenshot, `F` fullscreen. Disabled while typing or with modifier keys held.
- **SEO:** `metadataBase`, OpenGraph, Twitter card, `theme-color`, and a JSON-LD `Vehicle` graph generated from `CAR_SPECS`.
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
