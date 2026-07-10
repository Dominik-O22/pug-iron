import {
  isLadderComplete,
  isPrePullupStage,
  ladderExerciseForStage,
  ladderRungNumber,
  resolveLadderExerciseId,
  workoutExercisesForStage
} from "../pullup";
import type { ExerciseDef } from "../../types";

const defs: ExerciseDef[] = [
  makeDef({ id: "a1", workout: "A", order: 1 }),
  makeDef({ id: "b1", workout: "B", order: 1 }),
  makeDef({ id: "b2", workout: "B", order: 2 }),
  makeDef({ id: "pullup", workout: "B", order: 3, loadType: "assist" }),
  makeDef({ id: "dead-hang", workout: "P", order: 1, loadType: "body", measure: "seconds" }),
  makeDef({ id: "scap-pull", workout: "P", order: 2, loadType: "body" }),
  makeDef({ id: "pullup-negative", workout: "P", order: 3, loadType: "body" })
];

describe("pull-up ladder selection", () => {
  it("resolves the active exercise id per stage", () => {
    expect(resolveLadderExerciseId("dead-hang")).toBe("dead-hang");
    expect(resolveLadderExerciseId("pullup-negative")).toBe("pullup-negative");
    expect(resolveLadderExerciseId("pullup")).toBe("pullup");
    expect(resolveLadderExerciseId("complete")).toBe("pullup");
  });

  it("numbers rungs and flags stage phase", () => {
    expect(ladderRungNumber("dead-hang")).toBe(1);
    expect(ladderRungNumber("pullup")).toBe(4);
    expect(ladderRungNumber("complete")).toBe(4);
    expect(isPrePullupStage("scap-pull")).toBe(true);
    expect(isPrePullupStage("pullup")).toBe(false);
    expect(isLadderComplete("complete")).toBe(true);
  });

  it("holds only the active rung in a P mini-session", () => {
    expect(workoutExercisesForStage(defs, "P", "dead-hang").map((def) => def.id)).toEqual([
      "dead-hang"
    ]);
    expect(workoutExercisesForStage(defs, "P", "pullup").map((def) => def.id)).toEqual(["pullup"]);
  });

  it("swaps workout B slot 3 for the active rung until the band pull-up", () => {
    expect(workoutExercisesForStage(defs, "B", "scap-pull").map((def) => def.id)).toEqual([
      "b1",
      "b2",
      "scap-pull"
    ]);
    expect(workoutExercisesForStage(defs, "B", "pullup").map((def) => def.id)).toEqual([
      "b1",
      "b2",
      "pullup"
    ]);
    expect(workoutExercisesForStage(defs, "B", "complete").map((def) => def.id)).toEqual([
      "b1",
      "b2",
      "pullup"
    ]);
  });

  it("leaves other workouts untouched", () => {
    expect(workoutExercisesForStage(defs, "A", "dead-hang").map((def) => def.id)).toEqual(["a1"]);
  });

  it("finds the active def for the stage", () => {
    expect(ladderExerciseForStage(defs, "dead-hang")?.id).toBe("dead-hang");
    expect(ladderExerciseForStage(defs, "complete")?.id).toBe("pullup");
  });
});

function makeDef(overrides: Partial<ExerciseDef> & Pick<ExerciseDef, "id" | "workout" | "order">): ExerciseDef {
  return {
    name: overrides.id,
    sets: 3,
    repLow: 5,
    repHigh: 10,
    loadType: "weight",
    incrementKg: 2,
    note: "",
    cues: [],
    ...overrides
  };
}
