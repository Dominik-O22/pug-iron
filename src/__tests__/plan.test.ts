import { EXERCISE_DEFS } from "../plan";

describe("seed exercise plan", () => {
  it("ships the eleven base definitions and three pull-up ladder definitions", () => {
    expect(EXERCISE_DEFS).toHaveLength(14);
  });

  it("keeps five exercises in A and six in B", () => {
    expect(EXERCISE_DEFS.filter((exercise) => exercise.workout === "A")).toHaveLength(5);
    expect(EXERCISE_DEFS.filter((exercise) => exercise.workout === "B")).toHaveLength(6);
  });

  it("rests longer after compounds than isolations", () => {
    const restById = Object.fromEntries(EXERCISE_DEFS.map((e) => [e.id, e.restSec]));

    expect(restById["goblet-squat"]).toBe(150);
    expect(restById["db-rdl"]).toBe(150);
    expect(restById["lateral-raise"]).toBe(90);
    expect(restById["rear-delt-raise"]).toBe(90);
  });

  it("models pull-ups as assistance load", () => {
    expect(EXERCISE_DEFS.find((exercise) => exercise.id === "pullup")?.loadType).toBe("assist");
  });

  it("seeds the pull-up ladder with the intended measures and targets", () => {
    expect(EXERCISE_DEFS.filter((exercise) => exercise.workout === "P")).toMatchObject([
      {
        id: "dead-hang",
        loadType: "body",
        measure: "seconds",
        sets: 3,
        repLow: 10
      },
      {
        id: "scap-pull",
        loadType: "body",
        measure: "reps",
        sets: 3,
        repLow: 5,
        repHigh: 8
      },
      {
        id: "pullup-negative",
        loadType: "body",
        measure: "reps",
        sets: 3,
        repLow: 3,
        repHigh: 5
      }
    ]);
  });
});
