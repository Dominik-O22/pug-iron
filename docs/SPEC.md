# Functional Spec

Single-user, offline-first workout tracker for one specific training plan. English UI, metric units, `de-DE` date formatting is acceptable but ISO dates in storage.

## 1. The plan being tracked (seed data)

Source of truth: the [Home Physique Plan artifact](https://claude.ai/code/artifact/bc1fab26-78f0-4d1a-8f2f-b9ea90d400cb). The app ships with this seeded and editable (name, sets, rep range, increment — not the progression rules).

Full-body sessions alternating A/B regardless of calendar day (week 1: A–B–A, week 2: B–A–B). Every session starts with 4 min easy rowing + one light warm-up set of the first two exercises (shown as a checklist header in the logger, not tracked data).

### Workout A — squat pattern · horizontal push & pull · side delts

| id | Exercise | Sets × Reps | Notes |
|---|---|---|---|
| `goblet-squat` | Goblet squat | 3 × 8–12 | Move to two-DB front squat when one DB feels light |
| `flat-db-press` | Flat dumbbell bench press | 3 × 8–12 | Feet planted, slight arch, full range |
| `one-arm-row` | One-arm dumbbell row | 3 × 10–12 | Per side, knee on bench |
| `lateral-raise` | Dumbbell lateral raise | 3 × 12–15 | Light weight, strict |
| `hammer-curl` | Hammer curl | 2 × 10–12 | |

### Workout B — hinge pattern · vertical push & pull · upper chest

| id | Exercise | Sets × Reps | Notes |
|---|---|---|---|
| `db-rdl` | Dumbbell Romanian deadlift | 3 × 8–12 | Hinge at hips, flat back |
| `seated-oh-press` | Seated dumbbell shoulder press | 3 × 8–12 | |
| `pullup` | Pull-up (band-assisted) | 3 × 5–10 | `loadType: 'assist'` — see §4 |
| `incline-db-press` | Incline dumbbell press | 3 × 8–12 | |
| `oh-triceps-ext` | Overhead triceps extension | 2 × 10–12 | |

Weight increment default: **2.0 kg per dumbbell** (ATLETICA QUAD adjustment step), overridable per exercise.

## 2. Screens

Bottom tab bar, four tabs. No router — a `screen` state value in the app root.

### 2.1 Today (home)

- Header: pug rank + XP bar (subtle, one line).
- Hero card: **next workout** (A or B — whichever wasn't logged last) with its exercise list and each exercise's autopilot target (§4). One big button: *Start Workout*.
- Warm-up reminder line (4 min row + warm-up sets).
- Quick actions: *Log rower session*, *Log weigh-in* (inline mini-forms or bottom sheets).
- If a workout was already logged today: show it as done, celebrate briefly, still allow a second one (edge case, don't block).

### 2.2 Workout logger (modal flow from Today)

- One exercise at a time, big card, swipe/next navigation; also an overview list to jump.
- Warm-up checklist header before the first exercise: 4 min easy row + one light set of the session's first two exercises — tappable checkboxes, purely visual, never stored (§1).
- Per set: weight (kg, stepper steps by the exercise's `incrementKg` — matching the dumbbell's real adjustment step; storage precision stays 0.5) and reps (prefilled with target) as large steppers — **operable with a phone in one shaking post-set hand**. Tap *Log set* → starts the 90 s rest countdown (visible, `expo-haptics` buzz at 0 s; screen kept awake during the logger via `expo-keep-awake`).
- Autopilot line per exercise: e.g. *"Last: 12/11/10 @ 14 kg → hit 12s across, then 16 kg next time"*.
- Finishing: summary (sets logged, any progression events), XP awarded, save to SQLite. Partial workouts save fine — logging 3 of 5 exercises is a valid session.
- Abandoning mid-workout keeps a draft in memory only; explicit *Discard* available.

### 2.3 History

- Reverse-chronological list grouped by week: workouts (A/B badge, total volume, progression events), rower sessions, weigh-ins.
- Month calendar strip: dots on active days. **No streak counter anywhere.** A week row shows "2 sessions" style counts, colored by habit floor: ≥2 lifting sessions = good (mint), 1 = neutral, 0 = plain (never red, never a broken-chain metaphor).
- Tap a session → detail view; allow edit and delete.

### 2.4 Progress

- **Body weight chart**: daily points faded, 7-day rolling average as the main line, dashed target line at 83 kg, plan guideline (−0.5 kg/week from start weight) as a subtle reference. Message beside it mirrors the plan: judge the weekly average only.
- **Per-exercise chart**: selector chip row; line of top-set weight (or est. total volume toggle) over time. For `pullup`: assist level (inverted — lower band = higher) and total reps.
- **XP / rank panel**: current rank, XP to next, lifetime totals (sessions, sets, kg lifted, meters rowed).

### 2.5 Settings (gear icon on Today or fifth tab — implementer's choice)

- Export data (JSON via share sheet, §6), import (file picker, validates schema, previews counts before overwrite).
- Edit exercises: rename, sets, rep range, increment, reorder.
- Danger zone: wipe all data (double confirm).

## 3. Data model (expo-sqlite, schema v1)

Domain shapes (what `src/logic/` and the UI speak):

```ts
interface SetEntry   { weight: number; reps: number }          // weight = assist level for loadType 'assist'
interface ExerciseLog{ exerciseId: string; sets: SetEntry[] }

interface WorkoutSession {
  id?: number
  date: string            // 'YYYY-MM-DD' local
  workout: 'A' | 'B'
  entries: ExerciseLog[]
  startedAt: number       // epoch ms
  finishedAt?: number
  xp: number
  progressionEvents: string[]   // exerciseIds that bumped this session
}

interface RowSession { id?: number; date: string; minutes: number; meters?: number; xp: number }
interface WeighIn    { id?: number; date: string; kg: number; xp: number }

interface ExerciseDef {         // seeded, user-editable
  id: string
  name: string
  workout: 'A' | 'B'
  order: number
  sets: number
  repLow: number
  repHigh: number
  loadType: 'weight' | 'assist' // 'assist' = band level 0–4, lower is harder, 0 = unassisted
  incrementKg: number           // ignored for 'assist'; also the weight-stepper step
  note: string
  cues: string[]                // short form cues, shown expandable in the logger; seeded, editable
}

interface Setting { key: string; value: unknown }  // 'xpTotal', 'startWeightKg', 'targetWeightKg' (83), 'schemaVersion'
```

SQLite tables (one `db.ts` module owns all SQL; nothing else imports expo-sqlite):

```sql
CREATE TABLE sessions  (id INTEGER PRIMARY KEY, date TEXT NOT NULL, workout TEXT NOT NULL,
                        entries TEXT NOT NULL,            -- JSON ExerciseLog[]
                        progression_events TEXT NOT NULL, -- JSON string[]
                        started_at INTEGER NOT NULL, finished_at INTEGER, xp INTEGER NOT NULL);
CREATE TABLE rows      (id INTEGER PRIMARY KEY, date TEXT NOT NULL, minutes REAL NOT NULL,
                        meters INTEGER, xp INTEGER NOT NULL);
CREATE TABLE weighins  (id INTEGER PRIMARY KEY, date TEXT NOT NULL, kg REAL NOT NULL, xp INTEGER NOT NULL);
CREATE TABLE exercises (id TEXT PRIMARY KEY, name TEXT, workout TEXT, ord INTEGER, sets INTEGER,
                        rep_low INTEGER, rep_high INTEGER, load_type TEXT, increment_kg REAL, note TEXT);
CREATE TABLE settings  (key TEXT PRIMARY KEY, value TEXT NOT NULL);  -- JSON value
CREATE INDEX idx_sessions_date ON sessions(date);
CREATE INDEX idx_rows_date     ON rows(date);
CREATE INDEX idx_weighins_date ON weighins(date);
```

Set/rep detail stays as a JSON column (`entries`) — the app never queries inside a set, only whole sessions by date; keeps export/import trivially shaped like the domain types. Schema version via `PRAGMA user_version`; any change = bump + in-order migration steps on open. WAL mode on.

Schema v2: adds `exercises.cues TEXT NOT NULL DEFAULT '[]'` (JSON string[]). Backup `schemaVersion` bumps to 2; v1 backups import via shim (missing `cues` → seed defaults for known ids, else `[]`).

## 4. Progression autopilot (double progression)

For an exercise, find its most recent `ExerciseLog` across sessions. Then:

1. **No history** → target = `repLow` × `sets`, weight blank with hint *"first time: pick a weight where you'd fail 1–2 reps past the top of the range"*. (First two weeks deliberately light — the plan says learn the movements.)
2. **All logged sets reached `repHigh`** (compare against the sets actually logged, min 2 sets to qualify) →
   - `loadType 'weight'`: target weight = last weight + `incrementKg`, target reps = `repLow`. Mark as **progression event** when saved at the new weight.
   - `loadType 'assist'`: target assist = last assist − 1 (floor 0; at 0, progression = add reps beyond `repHigh`).
3. **Otherwise** → same weight, target = last session's reps with the *first* non-maxed set incremented by one (concretely: beat last total by ≥1 rep).

Display rule: always render the concrete instruction ("14 kg × 8/8/8" or "add a rep: aim 12/11/11 @ 14 kg"), never just the rule name. If the user logs something else, that's fine — autopilot always reasons from what actually happened, it never scolds.

## 5. XP and ranks (gentle gamification)

**Design constraint (non-negotiable): nothing is ever lost.** No streaks, no decay, no "you missed X". XP only goes up. Weeks with zero sessions simply award nothing.

| Event | XP |
|---|---|
| Workout session saved (≥1 exercise) | 100 |
| Rower session | 40 |
| Weigh-in (max one/day) | 10 |
| Progression event (weight bump / band drop) | +25 each |

Rank = cumulative XP against thresholds. Levels are pug-themed (the user has three pugs):

| # | Rank | XP |
|---|---|---|
| 1 | Sleepy Pug | 0 |
| 2 | Snack-Motivated Pug | 300 |
| 3 | Trotting Pug | 800 |
| 4 | Zoomies Pug | 1,500 |
| 5 | Working Pug | 2,400 |
| 6 | Gym Pug | 3,600 |
| 7 | Chiseled Pug | 5,000 |
| 8 | Diesel Pug | 6,800 |
| 9 | Alpha Pug | 9,000 |
| 10 | Mythic Pug | 12,000 |

~12 weeks of full adherence (3 lifts + 1 row + daily weigh-ins ≈ 410 XP/week) reaches Gym Pug — mid-plan. Mythic lands past the 6-month mark. Level-up = one full-screen moment in the workout summary, nowhere else.

## 6. Export / import

Export = one JSON file, `pug-iron-backup-YYYY-MM-DD.json`:

```json
{ "app": "pug-iron", "schemaVersion": 1, "exportedAt": "...", 
  "sessions": [], "rows": [], "weighins": [], "exercises": [], "settings": [] }
```

Share via `expo-file-system` (write to cache dir) + `expo-sharing`; import via `expo-document-picker`. Import validates `app` + `schemaVersion`, shows counts ("124 workouts, 61 weigh-ins — replace current data?"), then transactionally replaces all tables. The backup JSON contains domain-shaped objects (§3 interfaces), not raw SQL rows — storage can change under it as long as the shim maps.

## 7. Non-goals (v1)

- No diet/calorie tracking (user handles diet, uses a dedicated app).
- No cloud sync, accounts, or multi-device merge — export/import is the migration path.
- No exercise library beyond the plan's ten movements (editable, but no picker UI).
- No Bluetooth/PM5 pairing for the Concept2 in v1 — manual entry only. **Declared stretch goal**: passive BLE capture from the PM5 (public GATT spec, `react-native-ble-plx`, foreground only). First thing that forces a dev-client build instead of Expo Go; captured row sessions will need their own richer shape than `RowSession` — spec that when it starts.
- No notifications/reminders in v1 (revisit only if asked — reminders can read as nagging, which violates §5's spirit).
