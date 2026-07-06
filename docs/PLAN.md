# Implementation Plan

Six milestones, each independently shippable and testable in the browser before the APK milestone. Read [SPEC.md](SPEC.md) for the *what*, [DESIGN.md](DESIGN.md) for the *look*, [BUILD.md](BUILD.md) for the *toolchain*.

Suggested source layout:

```
src/
  main.tsx  App.tsx            # tabs, screen state
  db.ts                        # Dexie schema (SPEC §3)
  plan.ts                      # seed ExerciseDefs (SPEC §1)
  logic/progression.ts         # autopilot (SPEC §4) — pure, unit-testable
  logic/xp.ts                  # XP events + rank table (SPEC §5)
  logic/backup.ts              # export/import (SPEC §6)
  screens/ Today  Logger  History  Progress  Settings
  components/ Stepper RestTimer Panel Chart TabBar XpBar
  fonts/  styles.css           # tokens from DESIGN.md
```

## M1 — Scaffold & foundations

Vite + React + TS project builds and runs; Dexie schema v1 with seed exercises inserted on first run; tokens/fonts/global CSS in place; tab bar with four empty screens in the monitor aesthetic.

✅ *`npm run dev` shows the themed shell; `exercises` table contains the ten seeded movements; fonts load with no network (check devtools offline mode).*

## M2 — Workout logging (the core)

Today screen shows next workout (A/B alternation from last session); logger flow with steppers, per-set logging, 90 s rest timer, partial-save, discard; session persists with XP; History list (read-only is fine here).

✅ *Can complete a full workout A, close the app, reopen — session is in History and Today now offers B.*

## M3 — Progression autopilot

`logic/progression.ts` implemented against SPEC §4 including the `assist` load type; targets prefill the logger steppers; autopilot instruction line renders on Today and in the logger; progression events detected, stored, +25 XP, amber moment in summary.

✅ *Unit tests cover: no history, mid-range, all-sets-at-top (weight and assist variants), partial sets. Logging 12/12/12 makes next session prefill +2 kg @ 8s.*

## M4 — Rower, weigh-ins, Progress screen

Quick-log forms on Today; weight chart with 7-day rolling average + 83 kg target line; per-exercise progression chart; lifetime totals panel.

✅ *Backfill a few weeks of weigh-ins → rolling average and target line render sanely with gaps in the data.*

## M5 — Gamification & History polish

Rank table, XP bar on Today, rank-up full-screen moment; History calendar strip + weekly habit-floor coloring (SPEC §2.3 — no streak mechanics, verify forbidden-vocabulary rule from DESIGN.md "Voice"); session detail with edit/delete.

✅ *Cross a rank threshold → animation fires once; a week with zero sessions renders neutrally (no red, no "missed").*

## M6 — Backup & APK

Export/import per SPEC §6 with web fallback; Capacitor init + android platform; icon + splash via `@capacitor/assets`; debug APK built and installed on the phone; export→wipe→import round-trip verified **on device**.

✅ *App works in airplane mode; backup JSON re-imports to identical counts; vibration fires at rest-timer zero.*

## Deliberately later (post-v1 candidates)

Monthly waist/photo reminders (plan tracks these, but see SPEC §7 on notifications) · PM5 Bluetooth pairing · maintenance-phase support when the cut ends (January 2027: new calorie target, possibly new plan seed).
