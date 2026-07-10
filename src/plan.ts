import type { ExerciseDef } from "./types";

export const EXERCISE_DEFS: ExerciseDef[] = [
  {
    id: "goblet-squat",
    name: "Goblet squat",
    workout: "A",
    order: 1,
    sets: 3,
    repLow: 8,
    repHigh: 12,
    loadType: "weight",
    measure: "reps",
    incrementKg: 2.0,
    note: "Move to two-DB front squat when one DB feels light",
    cues: [
      "Elbows inside knees at the bottom",
      "Heels planted, chest tall",
      "Control down, drive up"
    ]
  },
  {
    id: "flat-db-press",
    name: "Flat dumbbell bench press",
    workout: "A",
    order: 2,
    sets: 3,
    repLow: 8,
    repHigh: 12,
    loadType: "weight",
    measure: "reps",
    incrementKg: 2.0,
    note: "Feet planted, slight arch, full range",
    cues: [
      "Shoulder blades pinned back",
      "Wrists stacked over elbows",
      "Lower to mid-chest, full range"
    ]
  },
  {
    id: "one-arm-row",
    name: "One-arm dumbbell row",
    workout: "A",
    order: 3,
    sets: 3,
    repLow: 10,
    repHigh: 12,
    loadType: "weight",
    measure: "reps",
    incrementKg: 2.0,
    note: "Per side, knee on bench",
    cues: [
      "Flat back, brace the core",
      "Pull to the hip, not the chest",
      "Squeeze the lat, control down"
    ]
  },
  {
    id: "lateral-raise",
    name: "Dumbbell lateral raise",
    workout: "A",
    order: 4,
    sets: 3,
    repLow: 12,
    repHigh: 15,
    loadType: "weight",
    measure: "reps",
    incrementKg: 2.0,
    note: "Light weight, strict",
    cues: [
      "Lead with the elbows",
      "Stop at shoulder height",
      "Slow negative, no swinging"
    ]
  },
  {
    id: "hammer-curl",
    name: "Hammer curl",
    workout: "A",
    order: 5,
    sets: 2,
    repLow: 10,
    repHigh: 12,
    loadType: "weight",
    measure: "reps",
    incrementKg: 2.0,
    note: "",
    cues: [
      "Elbows pinned to your sides",
      "Neutral grip, thumbs up",
      "No swinging, control down"
    ]
  },
  {
    id: "db-rdl",
    name: "Dumbbell Romanian deadlift",
    workout: "B",
    order: 1,
    sets: 3,
    repLow: 8,
    repHigh: 12,
    loadType: "weight",
    measure: "reps",
    incrementKg: 2.0,
    note: "Hinge at hips, flat back",
    cues: [
      "Hinge at the hips, push them back",
      "Flat back, soft knees",
      "Bar close, feel the hamstrings"
    ]
  },
  {
    id: "seated-oh-press",
    name: "Seated dumbbell shoulder press",
    workout: "B",
    order: 2,
    sets: 3,
    repLow: 8,
    repHigh: 12,
    loadType: "weight",
    measure: "reps",
    incrementKg: 2.0,
    note: "",
    cues: [
      "Brace the core, ribs down",
      "Press straight up, not forward",
      "Lower to ear height"
    ]
  },
  {
    id: "pullup",
    name: "Pull-up (band-assisted)",
    workout: "B",
    order: 3,
    sets: 3,
    repLow: 5,
    repHigh: 10,
    loadType: "assist",
    measure: "reps",
    incrementKg: 2.0,
    note: "",
    cues: [
      "Start from a full dead hang",
      "Pull the elbows down and back",
      "Chin over the bar, control down"
    ]
  },
  {
    id: "incline-db-press",
    name: "Incline dumbbell press",
    workout: "B",
    order: 4,
    sets: 3,
    repLow: 8,
    repHigh: 12,
    loadType: "weight",
    measure: "reps",
    incrementKg: 2.0,
    note: "",
    cues: [
      "Bench around 30 degrees",
      "Shoulder blades set back",
      "Press up and slightly together"
    ]
  },
  {
    id: "oh-triceps-ext",
    name: "Overhead triceps extension",
    workout: "B",
    order: 5,
    sets: 2,
    repLow: 10,
    repHigh: 12,
    loadType: "weight",
    measure: "reps",
    incrementKg: 2.0,
    note: "",
    cues: [
      "Elbows in, point them forward",
      "Full stretch at the bottom",
      "Only the forearms move"
    ]
  },
  {
    id: "dead-hang",
    name: "Dead hang",
    workout: "P",
    order: 1,
    sets: 3,
    repLow: 10,
    repHigh: 30,
    loadType: "body",
    measure: "seconds",
    incrementKg: 0,
    note: "Build to 30 seconds before moving on",
    cues: [
      "Shoulders active, not shrugged",
      "Ribs down, body still",
      "Grip the bar, breathe steadily"
    ]
  },
  {
    id: "scap-pull",
    name: "Scapular pull-up",
    workout: "P",
    order: 2,
    sets: 3,
    repLow: 5,
    repHigh: 8,
    loadType: "body",
    measure: "reps",
    incrementKg: 0,
    note: "Keep the elbows straight",
    cues: [
      "Start from a dead hang",
      "Pull the shoulders down, elbows straight",
      "Pause high, control back to the hang"
    ]
  },
  {
    id: "pullup-negative",
    name: "Negative pull-up",
    workout: "P",
    order: 3,
    sets: 3,
    repLow: 3,
    repHigh: 5,
    loadType: "body",
    measure: "reps",
    incrementKg: 0,
    note: "Lower for about 5 seconds each rep",
    cues: [
      "Step or jump to chin over the bar",
      "Lower for about 5 seconds",
      "Stay tight into a full dead hang"
    ]
  }
];

export const SEED_CUES_BY_ID: Record<string, string[]> = Object.fromEntries(
  EXERCISE_DEFS.map((exercise) => [exercise.id, exercise.cues])
);

// The pre-dumbbell pull-up ladder (workout "P"): seeded on the v3 migration and
// re-injected when importing an older backup that predates the ladder.
export const LADDER_EXERCISE_DEFS: ExerciseDef[] = EXERCISE_DEFS.filter(
  (exercise) => exercise.workout === "P"
);
