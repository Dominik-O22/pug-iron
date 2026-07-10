import { abbreviateExerciseName } from "../format";
import { EXERCISE_DEFS } from "../../plan";

describe("abbreviateExerciseName", () => {
  it("produces a readable movement word for every seeded exercise", () => {
    const labelsById = Object.fromEntries(
      EXERCISE_DEFS.map((exercise) => [exercise.id, abbreviateExerciseName(exercise.name)])
    );

    expect(labelsById).toEqual({
      "goblet-squat": "GOBLET",
      "flat-db-press": "BENCH",
      "one-arm-row": "ROW",
      "lateral-raise": "RAISE",
      "hammer-curl": "HAMMER",
      "db-rdl": "DEADLIFT",
      "dead-hang": "DEAD",
      "seated-oh-press": "SHOULDER",
      pullup: "PULL-UP",
      "pullup-negative": "NEGATIVE",
      "scap-pull": "SCAPULAR",
      "incline-db-press": "PRESS",
      "oh-triceps-ext": "TRICEPS"
    });
  });

  it("keeps seeded chip labels unique", () => {
    const labels = EXERCISE_DEFS.map((exercise) => abbreviateExerciseName(exercise.name));

    expect(new Set(labels).size).toBe(labels.length);
  });

  it("truncates long words and trims dangling hyphens", () => {
    expect(abbreviateExerciseName("Bulgarian split squat")).toBe("BULGAR");
    expect(abbreviateExerciseName("Chin-up (weighted)")).toBe("CHIN-UP");
    expect(abbreviateExerciseName("")).toBe("");
  });
});
