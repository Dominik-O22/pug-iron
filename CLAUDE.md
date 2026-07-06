# Pug Iron — context for Claude Code

Personal Android workout tracker (React Native + Expo SDK 57) for a specific 6-month dumbbell hypertrophy plan. Single user, offline-first, no backend. Target device: Pixel 9, Android 16.

## Read first

- [docs/PLAN.md](docs/PLAN.md) — milestone order; find the first unfinished milestone and continue there
- [docs/SPEC.md](docs/SPEC.md) — screens, SQLite data model, progression + XP algorithms, seed plan data
- [docs/DESIGN.md](docs/DESIGN.md) — PM5-monitor aesthetic, tokens, typography, voice rules
- [docs/BUILD.md](docs/BUILD.md) — toolchain (Expo SDK 57 + JDK 17 + Android SDK 35, headless), APK steps

## Hard constraints

- **JDK 17** — React Native's documented requirement; higher JDKs can break the Gradle build. Don't "helpfully" upgrade the toolchain; version bumps (Expo SDK included) only against current RN/Expo docs.
- **No punishing gamification.** No streaks, resets, decay, or "missed" language anywhere — the design is deliberately resilient to bad weeks (SPEC §5, DESIGN "Voice"). This is a user-values constraint, not a style preference.
- **Fully offline.** No CDN links (fonts are bundled TTFs via expo-font), no analytics, no expo-updates/EAS Update, no network calls at all.
- **Data is sacred.** All user data in expo-sqlite; any schema change needs a `PRAGMA user_version` bump + migration; export/import must stay compatible or bump `schemaVersion` with an import shim.
- Keep dependencies minimal: React Native, Expo SDK packages, NativeWind v4, react-native-svg. Hand-rolled SVG charts — no chart/UI/router libraries (no expo-router; tabs are a `screen` state value).
- **Expo Go stays sufficient for v1.** Don't add custom native modules before the PM5 BLE stretch goal (PLAN.md) — that's the deliberate line where the dev loop switches to a dev client.

## Conventions

- Pure logic (progression, XP, backup schema) lives in `src/logic/` — keep it free of React, Expo, and SQLite imports so it stays unit-testable with jest-expo on the desktop.
- All SQL lives in `src/db.ts`; the rest of the app speaks the domain types from SPEC §3.
- Dates in storage: `'YYYY-MM-DD'` local-time strings; timestamps as epoch ms.
- All numbers rendered in IBM Plex Mono with `fontVariant: ['tabular-nums']` (shared `<Num>` component).
- Weights in kg with 0.5 steps; default progression increment 2.0 kg per dumbbell.
