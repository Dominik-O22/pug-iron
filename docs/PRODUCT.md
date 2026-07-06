# Product

## Register

product

## Users

One user: a lifter running a fixed 6-month dumbbell hypertrophy plan at home, on a Pixel 9. The app is opened mid-workout, standing, often with sweaty hands and a phone held at arm's length. The dominant context is the 60–120 second gap between sets: glance, read the target, log the set, start the rest timer, put the phone down. Secondary contexts are a weekly weigh-in and occasional review of progress over weeks. Offline always (gym corners, early mornings, airplane mode). No second user, no sharing, no account.

## Product Purpose

A private, offline instrument for executing one specific training plan and trusting the numbers. It tells the user exactly what to lift next, records what they did, and runs the progression math so they never have to. Success is invisible: the user finishes six months stronger without ever fighting the app, losing data, or being nagged. It is a tool that serves the workout, not a product that competes for attention.

## Brand Personality

Blunt, encouraging, dry. Talks like a training partner who has counted your reps for years: says the number and little else, offers a wry nod when something improves, never lectures. Warmth is earned and rare (the pug rank system is the one place it smiles). Three words: **blunt, encouraging, dry.** Voice rules already codified in DESIGN.md "Voice" are binding: terse, warm, never scolding; forbidden vocabulary (streak, missed, broke, behind, shame-adjacent emoji).

## Anti-references

- **Cram-everything dashboards.** MyFitnessPal / generic fitness-tracker stat walls: dense tiles, everything on one screen, tiny touch targets. This app shows one number big and the rest quiet.
- **Generic Material template.** Stock Material 3 chrome, purple accents, floating action buttons, default component library look. Reads as un-designed; the PM5-monitor identity must never collapse into it.
- **Skeuomorphic gym app.** Faux metal/leather textures, glossy 3D buttons, hyper-realistic rendered dumbbells. The aesthetic is a flat instrument readout, not a photo of a gym.
- **Social-fitness / confetti machine.** No streaks, badges, leaderboards, celebration spam, or shame mechanics. (Also a hard product constraint, below.)

## Design Principles

- **The number is the interface.** The single most relevant readout dominates every screen; chrome shrinks so the datum can grow. When in doubt, bigger number, smaller frame.
- **Optimize for the tired thumb.** Every primary action must be hittable one-handed, mid-set, without looking closely. Density is not a virtue here; reach and legibility are.
- **Resilient to bad weeks.** No streaks, decay, resets, or "missed" language anywhere. A skipped week costs nothing and is never surfaced as failure. This is a user-values constraint, not a tone preference.
- **Do the math so the user doesn't.** Progression, XP, and targets are computed and stated plainly. The user's job is to lift and log, not to calculate.
- **Data is sacred, offline is absolute.** Never lose a session, never phone home. Trust is the product; a single lost workout breaks it.

## Accessibility & Inclusion

- **One-thumb, sweaty-hand use is the baseline requirement**, not an accommodation: touch targets ≥56px, forgiving hit areas, readouts glanceable at arm's length. This governs layout decisions everywhere.
- Reduced-motion is honored (`useReducedMotion`); all motion degrades to opacity-only.
- No additional formal WCAG target for v1 (single known user, no stated needs). Note for future: the amber/mint/danger accents currently lean on hue; if the user base ever widens, pair them with icon or label so meaning does not rely on color alone.
