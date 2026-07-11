import {
  formatExerciseTargetForSpeech,
  formatRestDoneForSpeech,
  formatSetTargetForSpeech,
  numberToSpeech
} from "../speech";
import type { ExerciseDef, SetEntry } from "../../types";

const weightExercise: ExerciseDef = {
  id: "press",
  name: "Dumbbell press",
  workout: "A",
  order: 1,
  sets: 3,
  repLow: 8,
  repHigh: 12,
  loadType: "weight",
  measure: "reps",
  incrementKg: 2,
  note: "",
  cues: []
};

const bodyExercise: ExerciseDef = {
  ...weightExercise,
  id: "scap-pull",
  name: "Scapular pull-up",
  loadType: "body"
};

const holdExercise: ExerciseDef = {
  ...bodyExercise,
  id: "dead-hang",
  name: "Dead hang",
  measure: "seconds"
};

const assistExercise: ExerciseDef = {
  ...weightExercise,
  id: "pullup",
  name: "Pull-up",
  loadType: "assist"
};

function set(overrides: Partial<SetEntry> = {}): SetEntry {
  return { weight: 22, reps: 8, ...overrides };
}

describe("speech target formatting", () => {
  test("spells integer rep and weight targets", () => {
    expect(formatSetTargetForSpeech(weightExercise, set())).toBe("eight reps at twenty two kilos");
  });

  test("spells half-kilo weights as a decimal", () => {
    expect(formatSetTargetForSpeech(weightExercise, set({ weight: 22.5 }))).toBe(
      "eight reps at twenty two point five kilos"
    );
  });

  test("omits an unset first-time weight", () => {
    expect(formatSetTargetForSpeech(weightExercise, set({ weight: 0 }))).toBe("eight reps");
  });

  test("spells duration targets in seconds", () => {
    expect(formatSetTargetForSpeech(holdExercise, set({ reps: 0, seconds: 30 }))).toBe(
      "thirty seconds"
    );
  });

  test("falls back to reps when seconds are unset", () => {
    expect(formatSetTargetForSpeech(holdExercise, set({ reps: 45 }))).toBe("forty five seconds");
  });

  test("uses singular second", () => {
    expect(formatSetTargetForSpeech(holdExercise, set({ reps: 0, seconds: 1 }))).toBe("one second");
  });

  test("names the unassisted rung and unknown assist levels", () => {
    expect(formatSetTargetForSpeech(assistExercise, set({ weight: 0, reps: 3 }))).toBe(
      "three reps unassisted"
    );
    expect(formatSetTargetForSpeech(assistExercise, set({ weight: 5, reps: 3 }))).toBe(
      "three reps with assist level five"
    );
  });

  test("spells body-weight rep targets without a load", () => {
    expect(formatSetTargetForSpeech(bodyExercise, set({ weight: 0, reps: 5 }))).toBe("five reps");
  });

  test("names the concrete assist band", () => {
    expect(formatSetTargetForSpeech(assistExercise, set({ weight: 2, reps: 6 }))).toBe(
      "six reps with purple band"
    );
  });

  test("uses singular units", () => {
    expect(formatSetTargetForSpeech(weightExercise, set({ weight: 1, reps: 1 }))).toBe(
      "one rep at one kilo"
    );
  });

  test("builds exercise and rest announcements", () => {
    expect(formatExerciseTargetForSpeech(holdExercise, set({ seconds: 30 }))).toBe(
      "Dead hang — thirty seconds"
    );
    expect(formatRestDoneForSpeech(weightExercise, set({ weight: 22.5 }))).toBe(
      "rest done — next: Dumbbell press, eight reps at twenty two point five kilos"
    );
    expect(formatRestDoneForSpeech(null, null)).toBe("rest done");
  });

  test("spells common compound numbers", () => {
    expect(numberToSpeech(115)).toBe("one hundred fifteen");
  });
});
