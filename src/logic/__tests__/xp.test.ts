import {
  XP_EVENTS,
  RANKS,
  currentRankForXp,
  highestRankGainedBetween,
  nextRankForXp,
  rankForXp,
  ranksGainedBetween,
  xpIntoCurrentRank,
  xpToNextRank
} from "../xp";

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
  it("matches the SPEC section 5 rank table", () => {
    expect(RANKS).toEqual([
      { level: 1, name: "Sleepy Pug", xp: 0 },
      { level: 2, name: "Snack-Motivated Pug", xp: 300 },
      { level: 3, name: "Trotting Pug", xp: 800 },
      { level: 4, name: "Zoomies Pug", xp: 1500 },
      { level: 5, name: "Working Pug", xp: 2400 },
      { level: 6, name: "Gym Pug", xp: 3600 },
      { level: 7, name: "Chiseled Pug", xp: 5000 },
      { level: 8, name: "Diesel Pug", xp: 6800 },
      { level: 9, name: "Alpha Pug", xp: 9000 },
      { level: 10, name: "Mythic Pug", xp: 12000 }
    ]);
  });

  it("returns the current rank and progress to the next rank", () => {
    expect(rankForXp(350)).toMatchObject({
      current: { level: 2, name: "Snack-Motivated Pug", xp: 300 },
      next: { level: 3, name: "Trotting Pug", xp: 800 },
      xpIntoLevel: 50,
      xpForLevel: 500,
      xpToNext: 450
    });
  });

  it("exposes focused helpers for rank panels", () => {
    expect(currentRankForXp(2399).name).toBe("Zoomies Pug");
    expect(nextRankForXp(2399)?.name).toBe("Working Pug");
    expect(xpIntoCurrentRank(2399)).toBe(899);
    expect(xpToNextRank(2399)).toBe(1);
  });

  it("detects every threshold crossed by an XP gain", () => {
    expect(ranksGainedBetween(250, 1600).map((rank) => rank.name)).toEqual([
      "Snack-Motivated Pug",
      "Trotting Pug",
      "Zoomies Pug"
    ]);
  });

  it("returns the highest new rank for one save", () => {
    expect(highestRankGainedBetween(790, 3650)?.name).toBe("Gym Pug");
  });

  it("does not report a crossing when XP is unchanged or lower", () => {
    expect(ranksGainedBetween(800, 800)).toEqual([]);
    expect(highestRankGainedBetween(900, 800)).toBeNull();
  });
});
