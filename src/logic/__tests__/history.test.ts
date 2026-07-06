import {
  aggregateActivityDays,
  buildMonthCalendarStrip,
  classifyHabitFloor,
  monthKeyFromDate
} from "../history";

describe("activity day aggregation", () => {
  it("marks a day active for workouts, rows, or weigh-ins", () => {
    expect(
      aggregateActivityDays({
        sessions: [{ date: "2026-07-06" }, { date: "2026-07-06" }],
        rowSessions: [{ date: "2026-07-07" }],
        weighIns: [{ date: "2026-07-07" }, { date: "2026-07-08" }]
      })
    ).toEqual([
      {
        active: true,
        date: "2026-07-06",
        dayOfMonth: 6,
        kinds: ["workout"],
        liftingSessions: 2,
        rowerSessions: 0,
        weighIns: 0
      },
      {
        active: true,
        date: "2026-07-07",
        dayOfMonth: 7,
        kinds: ["rower", "weigh-in"],
        liftingSessions: 0,
        rowerSessions: 1,
        weighIns: 1
      },
      {
        active: true,
        date: "2026-07-08",
        dayOfMonth: 8,
        kinds: ["weigh-in"],
        liftingSessions: 0,
        rowerSessions: 0,
        weighIns: 1
      }
    ]);
  });

  it("builds a full month strip with dots driven by any activity", () => {
    const strip = buildMonthCalendarStrip({
      month: "2026-07",
      sessions: [{ date: "2026-07-06" }],
      rowSessions: [{ date: "2026-07-15" }],
      weighIns: [{ date: "2026-08-01" }]
    });

    expect(strip).toHaveLength(31);
    expect(strip[0]).toMatchObject({ active: false, date: "2026-07-01" });
    expect(strip[5]).toMatchObject({
      active: true,
      date: "2026-07-06",
      kinds: ["workout"]
    });
    expect(strip[14]).toMatchObject({
      active: true,
      date: "2026-07-15",
      kinds: ["rower"]
    });
    expect(strip.some((day) => day.date === "2026-08-01")).toBe(false);
  });
});

describe("habit floor classification", () => {
  it("classifies two or more lifting sessions as good", () => {
    expect(classifyHabitFloor(2)).toBe("good");
    expect(classifyHabitFloor(4)).toBe("good");
  });

  it("classifies one lifting session as neutral", () => {
    expect(classifyHabitFloor(1)).toBe("single");
  });

  it("keeps zero lifting sessions plain instead of punitive", () => {
    expect(classifyHabitFloor(0)).toBe("plain");
  });
});

describe("month keys", () => {
  it("derives a year-month key from a local date string", () => {
    expect(monthKeyFromDate("2026-07-06")).toBe("2026-07");
  });
});
