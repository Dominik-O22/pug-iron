# Pug Iron — context for Claude Code

Personal Android workout tracker (Capacitor-wrapped React PWA) for a specific 6-month dumbbell hypertrophy plan. Single user, offline-first, no backend.

## Read first

- [docs/PLAN.md](docs/PLAN.md) — milestone order; find the first unfinished milestone and continue there
- [docs/SPEC.md](docs/SPEC.md) — screens, Dexie data model, progression + XP algorithms, seed plan data
- [docs/DESIGN.md](docs/DESIGN.md) — PM5-monitor aesthetic, tokens, typography, voice rules
- [docs/BUILD.md](docs/BUILD.md) — toolchain (Capacitor 6 + JDK 17 + SDK 34, headless), APK steps

## Hard constraints

- **Capacitor 6, not 7** — the toolchain is JDK 17 (Capacitor 7 needs JDK 21). Don't "helpfully" upgrade.
- **No punishing gamification.** No streaks, resets, decay, or "missed" language anywhere — the design is deliberately resilient to bad weeks (SPEC §5, DESIGN "Voice"). This is a user-values constraint, not a style preference.
- **Fully offline.** No CDN links (fonts are bundled woff2), no analytics, no network calls at all.
- **Data is sacred.** All user data in Dexie; any schema change needs a Dexie version bump + migration; export/import must stay compatible or bump `schemaVersion` with an import shim.
- Keep dependencies minimal: React, Dexie, Capacitor plugins already in package.json. Hand-rolled SVG charts — no chart/UI/router libraries.

## Conventions

- Pure logic (progression, XP, backup schema) lives in `src/logic/` — keep it free of React and Dexie imports so it stays unit-testable.
- Dates in storage: `'YYYY-MM-DD'` local-time strings; timestamps as epoch ms.
- All numbers rendered in IBM Plex Mono with `tabular-nums`.
- Weights in kg with 0.5 steps; default progression increment 2.0 kg per dumbbell.
