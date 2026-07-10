import {
  advancePullupStage,
  calculateWorkoutXp,
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
  note: "",
  cues: []
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
  note: "",
  cues: []
};

const holdExercise: ExerciseDef = {
  id: "dead-hang",
  name: "Dead hang",
  workout: "P",
  order: 1,
  sets: 3,
  repLow: 10,
  repHigh: 30,
  loadType: "body",
  measure: "seconds",
  incrementKg: 0,
  note: "",
  cues: []
};

const ladderExercises: ExerciseDef[] = [
  holdExercise,
  {
    id: "scap-pull",
    name: "Scapular pull-up",
    workout: "P",
    order: 2,
    sets: 3,
    repLow: 5,
    repHigh: 8,
    loadType: "body",
    measure: "reps",
    incrementKg: 0,
    note: "",
    cues: []
  },
  {
    id: "pullup-negative",
    name: "Pull-up negative",
    workout: "P",
    order: 3,
    sets: 3,
    repLow: 3,
    repHigh: 5,
    loadType: "body",
    measure: "reps",
    incrementKg: 0,
    note: "",
    cues: []
  },
  {
    id: "pullup",
    name: "Pull-up (band-assisted)",
    workout: "P",
    order: 4,
    sets: 3,
    repLow: 5,
    repHigh: 10,
    loadType: "assist",
    measure: "reps",
    incrementKg: 2,
    note: "",
    cues: []
  }
];

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

  it("adds five seconds when every hold set reaches its current target", () => {
    const target = deriveProgressionTarget(holdExercise, {
      exerciseId: "dead-hang",
      sets: [
        { weight: 0, reps: 0, seconds: 10 },
        { weight: 0, reps: 0, seconds: 10 },
        { weight: 0, reps: 0, seconds: 10 }
      ]
    });

    expect(target).toMatchObject({
      instruction: "add hold time: 15s/15s/15s",
      rule: "add-hold-time",
      progressionEvent: null,
      sets: [
        { weight: 0, reps: 0, seconds: 15 },
        { weight: 0, reps: 0, seconds: 15 },
        { weight: 0, reps: 0, seconds: 15 }
      ]
    });
  });

  it("caps hold targets at thirty seconds", () => {
    const target = deriveProgressionTarget(holdExercise, {
      exerciseId: "dead-hang",
      sets: [
        { weight: 0, reps: 0, seconds: 30 },
        { weight: 0, reps: 0, seconds: 30 },
        { weight: 0, reps: 0, seconds: 30 }
      ]
    });

    expect(target.rule).toBe("hold-load");
    expect(target.sets).toEqual([
      { weight: 0, reps: 0, seconds: 30 },
      { weight: 0, reps: 0, seconds: 30 },
      { weight: 0, reps: 0, seconds: 30 }
    ]);
  });

  it("shows a plain rep target for a bodyweight exercise with no history", () => {
    expect(deriveProgressionTarget(ladderExercises[1], null)).toMatchObject({
      hasHistory: false,
      instruction: "5/5/5",
      loadType: "body",
      progressionEvent: null,
      rule: "hold-load",
      sets: [
        { weight: null, reps: 5 },
        { weight: null, reps: 5 },
        { weight: null, reps: 5 }
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

describe("pull-up ladder progression", () => {
  it("advances through each of the four graduation thresholds", () => {
    expect(
      advancePullupStage("dead-hang", ladderExercises, [
        logHold("dead-hang", [30, 30, 30])
      ])
    ).toEqual({ stage: "scap-pull", progressionEvent: "dead-hang" });

    expect(
      advancePullupStage("scap-pull", ladderExercises, [
        log("scap-pull", [
          [0, 8],
          [0, 8],
          [0, 8]
        ])
      ])
    ).toEqual({ stage: "pullup-negative", progressionEvent: "scap-pull" });

    expect(
      advancePullupStage("pullup-negative", ladderExercises, [
        log("pullup-negative", [
          [0, 5],
          [0, 5],
          [0, 5]
        ])
      ])
    ).toEqual({ stage: "pullup", progressionEvent: "pullup-negative" });

    expect(
      advancePullupStage("pullup", ladderExercises, [
        log("pullup", [
          [2, 5],
          [2, 5],
          [2, 5]
        ])
      ])
    ).toEqual({ stage: "complete", progressionEvent: "ladder-complete" });
  });

  it("does not demote a stage or emit the completion event twice", () => {
    expect(
      advancePullupStage("scap-pull", ladderExercises, [
        logHold("dead-hang", [30, 30, 30])
      ])
    ).toEqual({ stage: "scap-pull", progressionEvent: null });

    expect(
      advancePullupStage("complete", ladderExercises, [
        log("pullup", [
          [2, 5],
          [2, 5],
          [2, 5]
        ])
      ])
    ).toEqual({ stage: "complete", progressionEvent: null });
  });

  it("awards forty XP for a P session", () => {
    expect(calculateWorkoutXp("P")).toBe(40);
  });
});

function logHold(exerciseId: string, seconds: number[]): ExerciseLog {
  return {
    exerciseId,
    sets: seconds.map((value) => ({ weight: 0, reps: 0, seconds: value }))
  };
}
