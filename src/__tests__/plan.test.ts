import { EXERCISE_DEFS } from "../plan";

describe("seed exercise plan", () => {
  it("ships the ten M1 exercise definitions", () => {
    expect(EXERCISE_DEFS).toHaveLength(10);
  });

  it("keeps five exercises in each workout", () => {
    expect(EXERCISE_DEFS.filter((exercise) => exercise.workout === "A")).toHaveLength(5);
    expect(EXERCISE_DEFS.filter((exercise) => exercise.workout === "B")).toHaveLength(5);
  });

  it("models pull-ups as assistance load", () => {
    expect(EXERCISE_DEFS.find((exercise) => exercise.id === "pullup")?.loadType).toBe("assist");
  });
});
