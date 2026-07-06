import { XP_EVENTS, rankForXp } from "../xp";

describe("XP event values", () => {
  it("matches the SPEC section 5 event table", () => {
    expect(XP_EVENTS).toEqual({
      workoutSessionSaved: 100,
      rowerSession: 40,
      weighIn: 10,
      progressionEvent: 25
    });
  });
});

describe("rankForXp", () => {
  it("returns the current rank and progress to the next rank", () => {
    expect(rankForXp(350)).toMatchObject({
      current: { level: 2, name: "Snack-Motivated Pug", xp: 300 },
      next: { level: 3, name: "Trotting Pug", xp: 800 },
      xpToNext: 450
    });
  });
});
