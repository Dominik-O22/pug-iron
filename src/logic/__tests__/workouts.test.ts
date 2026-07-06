import { calculateExerciseVolume, calculateSessionVolume, deriveSetPrefill, nextWorkout } from "../workouts";
import type { ExerciseDef, ExerciseLog, WorkoutSession } from "../../types";

const baseExercise: ExerciseDef = {
  id: "flat-db-press",
  name: "Flat dumbbell bench press",
  workout: "A",
  order: 2,
  sets: 3,
  repLow: 8,
  repHigh: 12,
  loadType: "weight",
  incrementKg: 2,
  note: ""
};

describe("nextWorkout", () => {
  it("starts with workout A when there is no session history", () => {
    expect(nextWorkout(null)).toBe("A");
  });

  it("alternates from the most recent workout", () => {
    expect(nextWorkout({ workout: "A" })).toBe("B");
    expect(nextWorkout({ workout: "B" })).toBe("A");
  });

  it("still alternates when the latest session is from the same local day", () => {
    const todaySession: WorkoutSession = {
      date: "2026-07-06",
      workout: "A",
      entries: [],
      startedAt: 1783353600000,
      finishedAt: 1783355400000,
      xp: 100,
      progressionEvents: []
    };

    expect(nextWorkout(todaySession)).toBe("B");
  });
});

describe("deriveSetPrefill", () => {
  it("uses zero weight and the low rep target when there is no history", () => {
    expect(deriveSetPrefill(baseExercise, null)).toEqual({
      hasHistory: false,
      sets: [
        { weight: 0, reps: 8 },
        { weight: 0, reps: 8 },
        { weight: 0, reps: 8 }
      ]
    });
  });

  it("copies the previous exercise log and repeats the last known set if needed", () => {
    const previousLog: ExerciseLog = {
      exerciseId: "flat-db-press",
      sets: [
        { weight: 18, reps: 10 },
        { weight: 18, reps: 9 }
      ]
    };

    expect(deriveSetPrefill(baseExercise, previousLog)).toEqual({
      hasHistory: true,
      sets: [
        { weight: 18, reps: 10 },
        { weight: 18, reps: 9 },
        { weight: 18, reps: 9 }
      ]
    });
  });
});

describe("volume calculations", () => {
  it("sums weight times reps for an exercise", () => {
    expect(
      calculateExerciseVolume({
        exerciseId: "flat-db-press",
        sets: [
          { weight: 18, reps: 10 },
          { weight: 18, reps: 9 },
          { weight: 20, reps: 8 }
        ]
      })
    ).toBe(502);
  });

  it("sums volume across every exercise in a session", () => {
    expect(
      calculateSessionVolume([
        {
          exerciseId: "flat-db-press",
          sets: [
            { weight: 18, reps: 10 },
            { weight: 18, reps: 9 }
          ]
        },
        {
          exerciseId: "one-arm-row",
          sets: [
            { weight: 24, reps: 12 },
            { weight: 24, reps: 11 }
          ]
        }
      ])
    ).toBe(894);
  });
});
