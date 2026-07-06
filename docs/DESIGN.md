# Design Direction

**Concept: the PM5 monitor.** The user's plan artifact already speaks Concept2 — dark monitor panels, petrol/teal, tabular mono numerals. The app *is* the monitor: a dark, calm instrument you glance at between sets, not a social-fitness confetti machine. Everything looks like readouts on a rowing computer; the one place the app allows itself warmth is the pug rank system.

This is a **dark-only** app (gym corners, early mornings; also saves battery on OLED). No light theme in v1.

## Tokens

Canonical palette. Lives in `tailwind.config.js` as NativeWind theme colors under these names (`bg`, `panel`, `panel-2`, `line`, `text`, `text-dim`, `mint`, `petrol`, `amber`, `danger`); docs refer to them as `--name` for brevity.

```css
:root {
  /* surfaces */
  --bg:        #0C1210;   /* near-black, green-cast — app background */
  --panel:     #131C1A;   /* card/monitor panel (matches plan artifact .monitor) */
  --panel-2:   #1A2622;   /* raised elements, inputs */
  --line:      #24332E;   /* hairline borders */

  /* ink */
  --text:      #D7E4E0;   /* primary */
  --text-dim:  #7E938D;   /* labels, captions */

  /* accent system */
  --mint:      #6FD3C0;   /* THE accent: live numbers, active states, progress */
  --petrol:    #0E5A54;   /* fills behind mint, pressed states */
  --amber:     #E8B04B;   /* reserved: progression events + level-ups ONLY */
  --danger:    #C96A5B;   /* destructive actions only — never for missed days */
}
```

Rule of restraint: mint is data and action; amber appears exclusively when something *improved* (weight bump, band drop, rank up). If a screen shows amber more than once, something is over-celebrating.

## Typography

Two families, both **bundled as static TTFs** in `src/fonts/`, loaded with `expo-font` at startup (the APK must work fully offline — no CDN links, no Google Fonts fetch):

- **Barlow Semi Condensed** (600, 700) — headings, tab labels, buttons, rank names. Uppercase with `letter-spacing: 0.06em` for section labels. Athletic without being a parody of a gym poster.
- **IBM Plex Mono** (400, 500) — every number in the app, plus captions/labels in the "monitor" idiom. Always `fontVariant: ['tabular-nums']` so steppers and timers don't jiggle — bake it into a shared `<Num>` text component so it can't be forgotten.

Body text also Barlow Semi Condensed 400 — at 16 px it reads comfortably and keeps the family count at two.

Scale (px): 13 caption/mono-label · 16 body · 18 card title · 24 screen title · **40–56 data-hero** (rest timer, today's weight, target readouts). The big numbers are the identity of the app — when in doubt, make the number bigger and the chrome smaller.

## Layout & components

- Single column, flexbox throughout (RN has no CSS grid — panel grids are nested flex rows with `gap`).
- **Monitor panel**: `--panel` background, 12 px radius, 1 px `--line` border, 20 px padding. The mono eyebrow label pattern from the plan artifact (`11px, letter-spacing 1.5px, uppercase, --text-dim`) heads every panel.
- **Touch targets ≥ 56 px.** Steppers in the logger: full-width rows, − and + are 64 px squares flanking the value. Between-sets UX is the whole product; optimize for a tired thumb, not for density.
- Bottom tab bar: 4 items, mono uppercase labels, mint active state with a 2 px top indicator line. Respect safe areas via `react-native-safe-area-context` (edge-to-edge is default on SDK 57 Android).
- Rest timer: full-width bar under the active exercise card — mono countdown at 48 px, thin mint progress bar draining right-to-left. Tapping it dismisses; it never blocks logging.
- Charts: hand-rolled with `react-native-svg` (no chart libraries), 1.5 px mint polyline, dots only on the latest point, dashed `--text-dim` target line, no gridlines beyond 3 horizontal hairlines. Axis labels in 11 px mono.

## Motion

Sparing. `react-native-reanimated` (ships with Expo) for anything beyond a simple opacity/transform; no extra animation libraries:

- Screen/tab switch: 160 ms fade + 8 px rise on the incoming panel.
- Set logged: the set row flashes `--petrol` → transparent (300 ms) and the rest timer slides in.
- Progression event in summary: amber count-up of the new weight value, single 500 ms moment.
- **Rank-up**: the one big animation — full-screen panel, pug rank name types on in mono, XP bar fills, 1.5 s, tap to dismiss. Earned rarely, so it can be loud.
- Reduce-motion on (`useReducedMotion` from reanimated): all of the above become opacity-only.

## Voice

Terse, warm, never scolding. The app talks like a good training partner: *"16 kg next time."*, *"Two sessions this week — solid."* Empty states explain what will appear, not what the user failed to do. Forbidden vocabulary anywhere in UI copy: streak, missed, broke, lost, behind, shame-adjacent emoji.

## App icon

Rounded-square `--panel` background, mint minimal dumbbell glyph where the two plates read as a subtle pug face (ears = plates). Generate at 1024 px (SVG → PNG via sharp), wire as `icon` + Android `adaptiveIcon` (foreground on `--panel` background) + splash in `app.json` — Expo generates all densities at prebuild. If the pug-dumbbell reads as clutter at 48 px, plain dumbbell wins — legibility over cleverness.
