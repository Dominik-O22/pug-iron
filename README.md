# Pug Iron 🏋️

A personal workout-tracking Android app for the [6-month home physique plan](https://claude.ai/code/artifact/bc1fab26-78f0-4d1a-8f2f-b9ea90d400cb): 3×/week full-body dumbbell training (alternating workouts A/B, double progression), Concept2 rower sessions, and a weight trend toward ~83 kg by January 2027.

**Status: planning stage.** This repo contains the full spec, design direction, and build guide. Implementation happens on the dev box — start with [docs/PLAN.md](docs/PLAN.md).

## What it does

- **Progression autopilot** — the app applies double-progression logic (8–12 reps) and tells you exactly what to attempt each session: add reps, or bump the weight and reset to the bottom of the range.
- **Workout logging** — big-thumb-friendly set/rep/weight logging for workouts A and B, with a 90 s rest timer.
- **Rower sessions** — log Concept2 Z2 sessions (duration, distance). Live BLE capture from the PM5 is a declared stretch goal.
- **Body weight trend** — weigh-ins with a weekly-average trend line toward the 83 kg target.
- **Gentle gamification** — XP and pug-themed levels for showing up. Deliberately **no streaks, no resets, no punishment**: two sessions is a fine week, zero is the only bad number, and a bad week costs you nothing you already earned.
- **On-device data** — everything lives in a SQLite database on the phone; one-tap JSON export/import for backup. No accounts, no server.

## Stack

| Layer | Choice | Why |
|---|---|---|
| UI | React Native 0.86 + TypeScript via **Expo SDK 57** | Native app, typed data model, dev-client dev loop (voice input needs a native module) |
| Styling | NativeWind v4 | Tailwind-style tokens over RN StyleSheet; design tokens in `tailwind.config.js` |
| Storage | expo-sqlite | Durable native SQLite — no WebView storage caveats; WAL, transactions |
| Charts | Hand-rolled react-native-svg | Two simple line charts don't justify a chart dependency |
| Routing | None (state-based tabs) | Four screens, no deep links needed — no expo-router |
| Voice input | expo-speech-recognition | On-device Android STT for hands-free set logging; the native module that moved the dev loop to a dev client |
| Stretch: PM5 BLE | react-native-ble-plx | Public Concept2 GATT spec |

Toolchain: JDK 17 + Android SDK Platform 35 (headless, no Android Studio) — see [docs/BUILD.md](docs/BUILD.md).

## Repo layout

```
README.md          ← you are here
CLAUDE.md          ← context for Claude Code sessions on the dev box
docs/
  PLAN.md          ← phased implementation plan with acceptance criteria — START HERE
  SPEC.md          ← functional spec: screens, data model, progression + XP algorithms, seed data
  DESIGN.md        ← visual direction, tokens, typography, component patterns
  BUILD.md         ← dev setup, Android SDK headless install, APK build steps
```

## Quick start (dev box)

```sh
bun install
bunx expo start --dev-client --tunnel   # open from the dev client on the phone
```

The dev client is a one-time debug APK build — JDK 17 and the Android SDK required; see [docs/BUILD.md](docs/BUILD.md) for the exact headless setup (no Android Studio required).
