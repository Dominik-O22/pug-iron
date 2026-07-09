import { buildSetProgressSegments } from "../session";

describe("buildSetProgressSegments", () => {
  it("marks the current set with a pointer and pending sets with a dash", () => {
    expect(
      buildSetProgressSegments(
        [
          { weight: 14, reps: 8, logged: true },
          { weight: 14, reps: 8, logged: false },
          { weight: 14, reps: 8, logged: false }
        ],
        1
      )
    ).toEqual([
      { label: "S1 14×8 ✓", state: "logged" },
      { label: "S2 ▸", state: "active" },
      { label: "S3 —", state: "pending" }
    ]);
  });

  it("keeps a re-selected logged set readable and active", () => {
    expect(
      buildSetProgressSegments(
        [
          { weight: 22.5, reps: 10, logged: true },
          { weight: 22.5, reps: 9, logged: true }
        ],
        0
      )
    ).toEqual([
      { label: "S1 22.5×10 ✓", state: "active" },
      { label: "S2 22.5×9 ✓", state: "logged" }
    ]);
  });

  it("handles an untouched exercise", () => {
    expect(
      buildSetProgressSegments(
        [
          { weight: 0, reps: 8, logged: false },
          { weight: 0, reps: 8, logged: false }
        ],
        0
      )
    ).toEqual([
      { label: "S1 ▸", state: "active" },
      { label: "S2 —", state: "pending" }
    ]);
  });
});
