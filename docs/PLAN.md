# Implementation Plan

Six milestones, each independently shippable and testable in Expo Go on the phone before the APK milestone. Read [SPEC.md](SPEC.md) for the *what*, [DESIGN.md](DESIGN.md) for the *look*, [BUILD.md](BUILD.md) for the *toolchain*.

Stack: Expo SDK 57 (`create-expo-app --template blank-typescript` — no expo-router, tabs are hand-rolled per SPEC §2), NativeWind v4, expo-sqlite, react-native-svg, jest-expo for `src/logic/` tests.

Suggested source layout:

```
src/
  App.tsx                      # tabs, screen state, font loading
  db.ts                        # expo-sqlite schema + queries (SPEC §3) — only module touching SQL
  plan.ts                      # seed ExerciseDefs (SPEC §1)
  logic/progression.ts         # autopilot (SPEC §4) — pure, unit-testable
  logic/xp.ts                  # XP events + rank table (SPEC §5)
  logic/backup.ts              # export/import schema (SPEC §6) — pure; file I/O stays outside
  screens/ Today  Logger  History  Progress  Settings
  components/ Stepper RestTimer Panel Chart TabBar XpBar Num
  fonts/                       # bundled TTFs (DESIGN.md)
tailwind.config.js             # tokens from DESIGN.md
```

## M1 — Scaffold & foundations

Expo project builds and runs in Expo Go; NativeWind v4 wired with the DESIGN.md tokens; fonts bundled and loaded via expo-font; SQLite schema v1 (`PRAGMA user_version = 1`) with seed exercises inserted on first run; tab bar with four empty screens in the monitor aesthetic.

✅ *`npx expo start --tunnel` shows the themed shell in Expo Go; `exercises` table contains the ten seeded movements; airplane mode on the phone changes nothing.*

## M2 — Workout logging (the core)

Today screen shows next workout (A/B alternation from last session); logger flow with steppers, per-set logging, 90 s rest timer (haptic buzz at zero, keep-awake while logging), partial-save, discard; session persists with XP; History list (read-only is fine here).

✅ *Can complete a full workout A, close the app, reopen — session is in History and Today now offers B.*

## M3 — Progression autopilot

`logic/progression.ts` implemented against SPEC §4 including the `assist` load type; targets prefill the logger steppers; autopilot instruction line renders on Today and in the logger; progression events detected, stored, +25 XP, amber moment in summary.

✅ *Unit tests (jest-expo, run on desktop) cover: no history, mid-range, all-sets-at-top (weight and assist variants), partial sets. Logging 12/12/12 makes next session prefill +2 kg @ 8s.*

## M4 — Rower, weigh-ins, Progress screen

Quick-log forms on Today; weight chart (react-native-svg) with 7-day rolling average + 83 kg target line; per-exercise progression chart; lifetime totals panel.

✅ *Backfill a few weeks of weigh-ins → rolling average and target line render sanely with gaps in the data.*

## M5 — Gamification & History polish

Rank table, XP bar on Today, rank-up full-screen moment; History calendar strip + weekly habit-floor coloring (SPEC §2.3 — no streak mechanics, verify forbidden-vocabulary rule from DESIGN.md "Voice"); session detail with edit/delete.

✅ *Cross a rank threshold → animation fires once; a week with zero sessions renders neutrally (no red, no "missed").*

## M6 — Backup & APK

Export/import per SPEC §6 (expo-file-system + expo-sharing + expo-document-picker); icon + adaptive icon + splash in app.json; `expo prebuild` + Gradle debug APK built and installed on the Pixel 9; export→wipe→import round-trip verified **on device, on the APK build** (not Expo Go).

✅ *App works in airplane mode; backup JSON re-imports to identical counts; haptic fires at rest-timer zero.*

## Stretch goal — PM5 over BLE

Passive live capture from the Concept2 PM5 (public GATT spec, base UUID `CE06xxxx-43E5-11E4-916C-0800200C9A66`): subscribe to rowing-status/stroke/summary characteristics, persist a captured session. Requires `react-native-ble-plx` (the dev loop already runs through a dev client since voice input — see BUILD.md). Start with a throwaway spike: scan, connect, subscribe to one metric, row 10 min, dump raw samples. Spec the captured-session data model (SPEC §3 extension) before building UI.

## Deliberately later (post-v1 candidates)

Monthly waist/photo reminders (plan tracks these, but see SPEC §7 on notifications) · maintenance-phase support when the cut ends (January 2027: new calorie target, possibly new plan seed).
