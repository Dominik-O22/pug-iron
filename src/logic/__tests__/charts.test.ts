import {
  buildDailyWeightPoints,
  buildExerciseProgressSeries,
  buildRollingAverageSeries,
  buildWeightGuidelineSeries
} from "../charts";
import type { ExerciseDef, WorkoutSession } from "../../types";

const flatPress: ExerciseDef = {
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

const pullup: ExerciseDef = {
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

const scapPull: ExerciseDef = {
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
};

const deadHang: ExerciseDef = {
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

function session(
  date: string,
  exerciseId: string,
  sets: Array<[number, number]>,
  startedAt = Date.parse(`${date}T08:00:00.000Z`)
): WorkoutSession {
  return {
    date,
    entries: [
      {
        exerciseId,
        sets: sets.map(([weight, reps]) => ({ weight, reps }))
      }
    ],
    progressionEvents: [],
    startedAt,
    workout: "A",
    xp: 100
  };
}

function holdSession(
  date: string,
  exerciseId: string,
  seconds: number[],
  startedAt = Date.parse(`${date}T08:00:00.000Z`)
): WorkoutSession {
  return {
    date,
    entries: [
      {
        exerciseId,
        sets: seconds.map((value) => ({ weight: 0, reps: 0, seconds: value }))
      }
    ],
    progressionEvents: [],
    startedAt,
    workout: "P",
    xp: 40
  };
}

describe("body-weight chart logic", () => {
  it("keeps one daily weight point and uses the latest same-day weigh-in", () => {
    expect(
      buildDailyWeightPoints([
        { id: 1, date: "2026-07-02", kg: 90.2 },
        { id: 2, date: "2026-07-01", kg: 90.8 },
        { id: 3, date: "2026-07-02", kg: 90.0 }
      ])
    ).toEqual([
      { date: "2026-07-01", value: 90.8 },
      { date: "2026-07-02", value: 90.0 }
    ]);
  });

  it("builds a calendar-window rolling average that handles gaps", () => {
    expect(
      buildRollingAverageSeries([
        { date: "2026-07-01", value: 90 },
        { date: "2026-07-03", value: 89 },
        { date: "2026-07-08", value: 88 }
      ])
    ).toEqual([
      { date: "2026-07-01", value: 90 },
      { date: "2026-07-03", value: 89.5 },
      { date: "2026-07-08", value: 88.5 }
    ]);
  });

  it("builds the plan guideline from the stored start weight", () => {
    expect(
      buildWeightGuidelineSeries({
        dates: ["2026-07-01", "2026-07-08", "2026-07-15"],
        startDate: "2026-07-01",
        startWeightKg: 90
      })
    ).toEqual([
      { date: "2026-07-01", value: 90 },
      { date: "2026-07-08", value: 89.5 },
      { date: "2026-07-15", value: 89 }
    ]);
  });

  it("returns empty chart series for empty datasets", () => {
    expect(buildDailyWeightPoints([])).toEqual([]);
    expect(buildRollingAverageSeries([])).toEqual([]);
    expect(
      buildWeightGuidelineSeries({
        dates: [],
        startDate: null,
        startWeightKg: null
      })
    ).toEqual([]);
  });
});

describe("exercise chart logic", () => {
  it("extracts the top-set weight for each matching session", () => {
    expect(
      buildExerciseProgressSeries(
        [
          session("2026-07-08", "flat-db-press", [
            [16, 8],
            [16, 8]
          ]),
          session("2026-07-01", "flat-db-press", [
            [14, 12],
            [16, 8],
            [14, 10]
          ])
        ],
        flatPress,
        "top-set"
      )
    ).toEqual([
      { date: "2026-07-01", rawValue: 16, value: 16 },
      { date: "2026-07-08", rawValue: 16, value: 16 }
    ]);
  });

  it("inverts assist levels so lower bands plot higher", () => {
    expect(
      buildExerciseProgressSeries(
        [
          session("2026-07-01", "pullup", [
            [3, 7],
            [3, 6]
          ]),
          session("2026-07-08", "pullup", [
            [1, 5],
            [2, 5]
          ])
        ],
        pullup,
        "top-set"
      )
    ).toEqual([
      { date: "2026-07-01", rawValue: 3, value: 1 },
      { date: "2026-07-08", rawValue: 1, value: 3 }
    ]);
  });

  it("uses estimated volume for weight exercises and total reps for pull-ups", () => {
    expect(
      buildExerciseProgressSeries(
        [
          session("2026-07-01", "flat-db-press", [
            [14, 10],
            [14, 9]
          ])
        ],
        flatPress,
        "volume"
      )
    ).toEqual([{ date: "2026-07-01", rawValue: 266, value: 266 }]);

    expect(
      buildExerciseProgressSeries(
        [
          session("2026-07-01", "pullup", [
            [3, 7],
            [3, 6],
            [3, 5]
          ])
        ],
        pullup,
        "volume"
      )
    ).toEqual([{ date: "2026-07-01", rawValue: 18, value: 18 }]);
  });

  it("plots hold seconds for seconds-measure exercises instead of weight", () => {
    expect(
      buildExerciseProgressSeries(
        [holdSession("2026-07-01", "dead-hang", [10, 12, 10])],
        deadHang,
        "top-set"
      )
    ).toEqual([{ date: "2026-07-01", rawValue: 12, value: 12 }]);

    expect(
      buildExerciseProgressSeries(
        [holdSession("2026-07-01", "dead-hang", [10, 12, 10])],
        deadHang,
        "volume"
      )
    ).toEqual([{ date: "2026-07-01", rawValue: 32, value: 32 }]);
  });

  it("counts reps for body-weight rep exercises instead of zero-weight volume", () => {
    expect(
      buildExerciseProgressSeries(
        [
          session("2026-07-01", "scap-pull", [
            [0, 8],
            [0, 7],
            [0, 6]
          ])
        ],
        scapPull,
        "top-set"
      )
    ).toEqual([{ date: "2026-07-01", rawValue: 8, value: 8 }]);

    expect(
      buildExerciseProgressSeries(
        [
          session("2026-07-01", "scap-pull", [
            [0, 8],
            [0, 7],
            [0, 6]
          ])
        ],
        scapPull,
        "volume"
      )
    ).toEqual([{ date: "2026-07-01", rawValue: 21, value: 21 }]);
  });

  it("returns an empty exercise series when there are no matching logs", () => {
    expect(
      buildExerciseProgressSeries(
        [session("2026-07-01", "one-arm-row", [[20, 10]])],
        flatPress,
        "top-set"
      )
    ).toEqual([]);
  });
});
