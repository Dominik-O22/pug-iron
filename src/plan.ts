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
    incrementKg: 2.0,
    note: "",
    cues: [
      "Elbows in, point them forward",
      "Full stretch at the bottom",
      "Only the forearms move"
    ]
  }
];

export const SEED_CUES_BY_ID: Record<string, string[]> = Object.fromEntries(
  EXERCISE_DEFS.map((exercise) => [exercise.id, exercise.cues])
);
