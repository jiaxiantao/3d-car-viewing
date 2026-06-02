# Security Policy

## Supported versions

| Version | Supported |
| ------- | --------- |
| `main` (latest) | Yes |
| Older tags | Best effort |

## Reporting a vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Instead:

1. Use [GitHub Private Vulnerability Reporting](https://github.com/jiaxiantao/3d-car-viewing/security/advisories/new) if available for this repository, **or**
2. Open a minimal issue asking the maintainer for a private contact channel without including exploit details.

Include:

- Affected component (e.g. Next.js route, dependency, Docker image)
- Steps to reproduce
- Impact assessment (if known)

We aim to acknowledge reports within **7 days** and provide a fix or mitigation plan when possible.

## Scope

In scope:

- This application's source code and default Docker configuration
- Dependency vulnerabilities introduced by this repo's direct usage

Out of scope:

- Vulnerabilities in upstream Three.js / browser WebGL stacks without a practical app-specific exploit
- Third-party GLB files (report to the asset author; we can remove/replace assets in-repo)

## Safe defaults

- Do not commit `.env` files or API keys.
- Run `pnpm install` only from this repository's lockfile in CI and production builds.
