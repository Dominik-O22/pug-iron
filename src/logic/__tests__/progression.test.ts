import {
  detectProgressionEvents,
  deriveProgressionTarget,
  deriveProgressionTargets
} from "../progression";
import type { ExerciseDef, ExerciseLog } from "../../types";

const weightExercise: ExerciseDef = {
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

const assistExercise: ExerciseDef = {
  id: "pullup",
  name: "Pull-up (band-assisted)",
  workout: "B",
  order: 3,
  sets: 3,
  repLow: 5,
  repHigh: 10,
  loadType: "assist",
  incrementKg: 2,
  note: ""
};

function log(exerciseId: string, sets: Array<[number, number]>): ExerciseLog {
  return {
    exerciseId,
    sets: sets.map(([weight, reps]) => ({ weight, reps }))
  };
}

describe("deriveProgressionTarget", () => {
  it("uses low reps with a blank load and first-time hint when there is no history", () => {
    expect(deriveProgressionTarget(weightExercise, null)).toEqual({
      exerciseId: "flat-db-press",
      hasHistory: false,
      instruction: "8/8/8 - first time: pick a weight where you'd fail 1–2 reps past the top of the range",
      loadType: "weight",
      progressionEvent: null,
      rule: "first-time",
      sets: [
        { weight: null, reps: 8 },
        { weight: null, reps: 8 },
        { weight: null, reps: 8 }
      ]
    });
  });

  it("adds one rep to the first non-maxed set in a mid-range session", () => {
    const target = deriveProgressionTarget(
      weightExercise,
      log("flat-db-press", [
        [14, 12],
        [14, 11],
        [14, 10]
      ])
    );

    expect(target).toMatchObject({
      instruction: "add a rep: aim 12/12/10 @ 14 kg",
      progressionEvent: null,
      rule: "add-rep",
      sets: [
        { weight: 14, reps: 12 },
        { weight: 14, reps: 12 },
        { weight: 14, reps: 10 }
      ]
    });
  });

  it("raises the weight and returns low reps when all logged weight sets hit the top", () => {
    const target = deriveProgressionTarget(
      weightExercise,
      log("flat-db-press", [
        [14, 12],
        [14, 12],
        [14, 12]
      ])
    );

    expect(target).toMatchObject({
      instruction: "16 kg × 8/8/8",
      progressionEvent: { exerciseId: "flat-db-press", loadType: "weight", targetLoad: 16 },
      rule: "add-load",
      sets: [
        { weight: 16, reps: 8 },
        { weight: 16, reps: 8 },
        { weight: 16, reps: 8 }
      ]
    });
  });

  it("logging 12/12/12 makes next session prefill +2 kg @ 8s", () => {
    expect(
      deriveProgressionTargets(
        [weightExercise],
        {
          "flat-db-press": log("flat-db-press", [
            [14, 12],
            [14, 12],
            [14, 12]
          ])
        }
      )["flat-db-press"].sets
    ).toEqual([
      { weight: 16, reps: 8 },
      { weight: 16, reps: 8 },
      { weight: 16, reps: 8 }
    ]);
  });

  it("drops assist and returns low reps when all logged assist sets hit the top", () => {
    const target = deriveProgressionTarget(
      assistExercise,
      log("pullup", [
        [3, 10],
        [3, 10],
        [3, 10]
      ])
    );

    expect(target).toMatchObject({
      instruction: "assist 2 × 5/5/5",
      progressionEvent: { exerciseId: "pullup", loadType: "assist", targetLoad: 2 },
      rule: "reduce-assist",
      sets: [
        { weight: 2, reps: 5 },
        { weight: 2, reps: 5 },
        { weight: 2, reps: 5 }
      ]
    });
  });

  it("adds unassisted reps instead of dropping below assist floor zero", () => {
    const target = deriveProgressionTarget(
      assistExercise,
      log("pullup", [
        [0, 10],
        [0, 10],
        [0, 10]
      ])
    );

    expect(target).toMatchObject({
      instruction: "add a rep: aim 11/10/10 @ assist 0",
      progressionEvent: null,
      rule: "add-unassisted-rep",
      sets: [
        { weight: 0, reps: 11 },
        { weight: 0, reps: 10 },
        { weight: 0, reps: 10 }
      ]
    });
  });

  it("qualifies partial sessions when at least two logged sets reached the top", () => {
    const target = deriveProgressionTarget(
      weightExercise,
      log("flat-db-press", [
        [14, 12],
        [14, 12]
      ])
    );

    expect(target).toMatchObject({
      instruction: "16 kg × 8/8/8",
      rule: "add-load",
      sets: [
        { weight: 16, reps: 8 },
        { weight: 16, reps: 8 },
        { weight: 16, reps: 8 }
      ]
    });
  });

  it("does not qualify a single logged top set for a load increase", () => {
    const target = deriveProgressionTarget(weightExercise, log("flat-db-press", [[14, 12]]));

    expect(target).toMatchObject({
      instruction: "14 kg × 12/8/8",
      progressionEvent: null,
      rule: "hold-load",
      sets: [
        { weight: 14, reps: 12 },
        { weight: 14, reps: 8 },
        { weight: 14, reps: 8 }
      ]
    });
  });
});

describe("detectProgressionEvents", () => {
  it("detects a saved weight session logged at the rule-2 target load", () => {
    expect(
      detectProgressionEvents(
        [weightExercise],
        {
          "flat-db-press": log("flat-db-press", [
            [14, 12],
            [14, 12],
            [14, 12]
          ])
        },
        [
          log("flat-db-press", [
            [16, 8],
            [16, 8],
            [16, 7]
          ])
        ]
      )
    ).toEqual(["flat-db-press"]);
  });

  it("detects a weight event when the saved load jumps past the rule-2 target", () => {
    expect(
      detectProgressionEvents(
        [weightExercise],
        {
          "flat-db-press": log("flat-db-press", [
            [14, 12],
            [14, 12],
            [14, 12]
          ])
        },
        [
          log("flat-db-press", [
            [18, 6],
            [18, 6]
          ])
        ]
      )
    ).toEqual(["flat-db-press"]);
  });

  it("detects an assist event when the saved band drops past the target", () => {
    expect(
      detectProgressionEvents(
        [assistExercise],
        {
          pullup: log("pullup", [
            [2, 10],
            [2, 10]
          ])
        },
        [
          log("pullup", [
            [0, 5],
            [0, 5]
          ])
        ]
      )
    ).toEqual(["pullup"]);
  });

  it("does not detect a weight event when the saved load misses the rule-2 target", () => {
    expect(
      detectProgressionEvents(
        [weightExercise],
        {
          "flat-db-press": log("flat-db-press", [
            [14, 12],
            [14, 12],
            [14, 12]
          ])
        },
        [log("flat-db-press", [[14, 12]])]
      )
    ).toEqual([]);
  });

  it("detects a saved assist session logged at the lower assist target", () => {
    expect(
      detectProgressionEvents(
        [assistExercise],
        {
          pullup: log("pullup", [
            [2, 10],
            [2, 10]
          ])
        },
        [
          log("pullup", [
            [1, 5],
            [1, 5]
          ])
        ]
      )
    ).toEqual(["pullup"]);
  });

  it("does not detect an assist event at floor zero because no lower assist was logged", () => {
    expect(
      detectProgressionEvents(
        [assistExercise],
        {
          pullup: log("pullup", [
            [0, 10],
            [0, 10],
            [0, 10]
          ])
        },
        [
          log("pullup", [
            [0, 11],
            [0, 10],
            [0, 10]
          ])
        ]
      )
    ).toEqual([]);
  });
});
