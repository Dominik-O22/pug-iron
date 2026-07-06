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
    note: "Move to two-DB front squat when one DB feels light"
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
    note: "Feet planted, slight arch, full range"
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
    note: "Per side, knee on bench"
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
    note: "Light weight, strict"
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
    note: ""
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
    note: "Hinge at hips, flat back"
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
    note: ""
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
    note: ""
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
    note: ""
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
    note: ""
  }
];
