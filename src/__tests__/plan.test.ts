import { EXERCISE_DEFS } from "../plan";

describe("seed exercise plan", () => {
  it("ships the ten base definitions and three pull-up ladder definitions", () => {
    expect(EXERCISE_DEFS).toHaveLength(13);
  });

  it("keeps five exercises in each workout", () => {
    expect(EXERCISE_DEFS.filter((exercise) => exercise.workout === "A")).toHaveLength(5);
    expect(EXERCISE_DEFS.filter((exercise) => exercise.workout === "B")).toHaveLength(5);
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
