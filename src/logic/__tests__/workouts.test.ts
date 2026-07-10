import { calculateExerciseVolume, calculateSessionVolume, nextWorkout } from "../workouts";
import type { WorkoutSession } from "../../types";

describe("nextWorkout", () => {
  it("starts with workout A when there is no session history", () => {
    expect(nextWorkout(null)).toBe("A");
    expect(nextWorkout([])).toBe("A");
  });

  it("alternates from the most recent workout (sessions newest-first)", () => {
    expect(nextWorkout([{ workout: "A" }])).toBe("B");
    expect(nextWorkout([{ workout: "B" }])).toBe("A");
  });

  it("ignores standalone 'P' ladder sessions and follows the last A/B lift", () => {
    // Newest-first: a P ladder session on top of an A→B rotation must still
    // suggest A next (last real lift was B), not flip the rotation.
    expect(nextWorkout([{ workout: "P" }, { workout: "B" }, { workout: "A" }])).toBe("A");
    // A→B→A→P should suggest B (last real lift was A), not A again.
    expect(
      nextWorkout([{ workout: "P" }, { workout: "A" }, { workout: "B" }, { workout: "A" }])
    ).toBe("B");
  });

  it("starts with A when only 'P' ladder sessions exist", () => {
    expect(nextWorkout([{ workout: "P" }, { workout: "P" }])).toBe("A");
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

    expect(nextWorkout([todaySession])).toBe("B");
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
