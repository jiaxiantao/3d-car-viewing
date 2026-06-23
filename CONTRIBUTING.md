# Contributing

Thank you for considering a contribution to **3d-car-viewing**!

## Before you start

- Search [existing issues](https://github.com/jiaxiantao/3d-car-viewing/issues) to avoid duplicates.
- For large changes (new loader, auth, multi-room showroom), open an issue first to align on scope.
- Read [documentation/ARCHITECTURE.md](documentation/ARCHITECTURE.md) and [documentation/market-glb-rig.md](documentation/market-glb-rig.md) when touching GLB or rig code.
- Do **not** commit secrets (`.env`, API keys). `.env.example` is the template for documented variables only.

## Development setup

```bash
pnpm install
cp .env.example .env   # optional
pnpm dev
```

## Quality checks (required before PR)

```bash
pnpm lint
pnpm typecheck
pnpm build
```

CI runs the same steps on every push to `main` and on pull requests.

## Pull request guidelines

1. **One concern per PR** when possible (e.g. fix loader bug vs. add new paint preset).
2. **Describe** what changed and why; include screenshots or screen recordings for UI/3D changes.
3. **Update docs** if you change URLs, env vars, model filenames, or rig behavior.
4. **3D assets:** if you add/replace GLBs, update [documentation/ATTRIBUTION.md](documentation/ATTRIBUTION.md) and `public/models/market/README.md` with license and author.
5. **Avoid** unrelated formatting churn across the repo.

## Code style

- TypeScript strict mode; match existing naming and file layout.
- Prefer `useMemo` / `useCallback` over effects that only sync derived state (React 19 ESLint rules).
- Three.js scene mutations inside R3F (`scene.environment`, etc.) are intentional; use targeted `eslint-disable-next-line` with a short comment when required.

## Reporting bugs

Use the [bug report template](.github/ISSUE_TEMPLATE/bug_report.yml). Include:

- Browser & OS
- Steps to reproduce
- Whether the issue occurs with GLB or geometric fallback only

## Questions

Use [GitHub Discussions](https://github.com/jiaxiantao/3d-car-viewing/discussions) if enabled, or open a question-labeled issue.

By participating, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).
