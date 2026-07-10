import {
  DEFAULT_REMINDER_SETTINGS,
  parseReminderSettings,
  planReminderOccurrences,
  reminderContent,
  ReminderSettings
} from "../reminders";

const settings = (overrides: Partial<ReminderSettings> = {}): ReminderSettings => ({
  enabled: true,
  hour: 18,
  minute: 30,
  weekdays: [1, 3, 5],
  ...overrides
});

describe("parseReminderSettings", () => {
  it("returns defaults for null, undefined and garbage input", () => {
    expect(parseReminderSettings(null)).toEqual(DEFAULT_REMINDER_SETTINGS);
    expect(parseReminderSettings(undefined)).toEqual(DEFAULT_REMINDER_SETTINGS);
    expect(parseReminderSettings("garbage")).toEqual(DEFAULT_REMINDER_SETTINGS);
    expect(parseReminderSettings(42)).toEqual(DEFAULT_REMINDER_SETTINGS);
  });

  it("merges partial objects with per-field defaults", () => {
    expect(parseReminderSettings({ enabled: true })).toEqual({
      ...DEFAULT_REMINDER_SETTINGS,
      enabled: true
    });
    expect(parseReminderSettings({ hour: 7, weekdays: [2, 4] })).toEqual({
      enabled: false,
      hour: 7,
      minute: 0,
      weekdays: [2, 4]
    });
  });

  it("ignores wrongly typed fields", () => {
    expect(parseReminderSettings({ enabled: "yes", hour: "8", minute: NaN, weekdays: "1,2" })).toEqual(
      DEFAULT_REMINDER_SETTINGS
    );
  });

  it("clamps hour and minute and rounds to integers", () => {
    expect(parseReminderSettings({ hour: -3, minute: 99 })).toMatchObject({ hour: 0, minute: 59 });
    expect(parseReminderSettings({ hour: 30, minute: -1 })).toMatchObject({ hour: 23, minute: 0 });
    expect(parseReminderSettings({ hour: 7.6, minute: 14.4 })).toMatchObject({ hour: 8, minute: 14 });
  });

  it("dedupes, filters and sorts weekdays", () => {
    expect(parseReminderSettings({ weekdays: [5, 1, 5, 3, 0, 8, 2.5, "6", NaN] })).toMatchObject({
      weekdays: [1, 3, 5]
    });
    expect(parseReminderSettings({ weekdays: [] })).toMatchObject({ weekdays: [] });
  });
});

describe("planReminderOccurrences", () => {
  const fridayMorning = new Date(2026, 6, 10, 9, 0); // 2026-07-10 is a Friday

  it("returns [] when disabled", () => {
    expect(planReminderOccurrences(settings({ enabled: false }), fridayMorning, false)).toEqual([]);
  });

  it("returns [] when no weekdays are enabled", () => {
    expect(planReminderOccurrences(settings({ weekdays: [] }), fridayMorning, false)).toEqual([]);
  });

  it("includes today's slot when it is ahead and not trained today", () => {
    const result = planReminderOccurrences(settings({ weekdays: [5] }), fridayMorning, false);
    expect(result[0]).toEqual(new Date(2026, 6, 10, 18, 30));
  });

  it("skips today's slot when the time has already passed", () => {
    const lateFriday = new Date(2026, 6, 10, 19, 0);
    const result = planReminderOccurrences(settings({ weekdays: [5] }), lateFriday, false);
    expect(result[0]).toEqual(new Date(2026, 6, 17, 18, 30));
  });

  it("skips today's slot at exactly the occurrence time", () => {
    const atSlot = new Date(2026, 6, 10, 18, 30);
    const result = planReminderOccurrences(settings({ weekdays: [5] }), atSlot, false);
    expect(result[0]).toEqual(new Date(2026, 6, 17, 18, 30));
  });

  it("skips today's slot when already trained today even if time is ahead", () => {
    const result = planReminderOccurrences(settings({ weekdays: [5] }), fridayMorning, true);
    expect(result[0]).toEqual(new Date(2026, 6, 17, 18, 30));
  });

  it("maps ISO weekdays correctly (5 = Friday, 7 = Sunday)", () => {
    const fridays = planReminderOccurrences(settings({ weekdays: [5] }), fridayMorning, false);
    expect(fridays[0]).toEqual(new Date(2026, 6, 10, 18, 30));

    const sundays = planReminderOccurrences(settings({ weekdays: [7] }), fridayMorning, false);
    expect(sundays[0]).toEqual(new Date(2026, 6, 12, 18, 30));
    expect(sundays[0].getDay()).toBe(0);
  });

  it("spans 28 days starting today and stays sorted ascending", () => {
    const result = planReminderOccurrences(settings(), fridayMorning, false);
    expect(result).toHaveLength(12); // 4 weeks x Mon/Wed/Fri
    const last = result[result.length - 1];
    expect(last.getTime() - fridayMorning.getTime()).toBeLessThan(28 * 24 * 60 * 60 * 1000);
    for (let i = 1; i < result.length; i++) {
      expect(result[i].getTime()).toBeGreaterThan(result[i - 1].getTime());
    }
  });

  it("crosses month and year boundaries", () => {
    const newYearsEve = new Date(2026, 11, 31, 8, 0); // Thursday
    const result = planReminderOccurrences(settings({ weekdays: [4] }), newYearsEve, false);
    expect(result[0]).toEqual(new Date(2026, 11, 31, 18, 30));
    expect(result[1]).toEqual(new Date(2027, 0, 7, 18, 30));
  });
});

describe("reminderContent", () => {
  it("returns the exact copy per workout", () => {
    expect(reminderContent("A")).toEqual({ title: "Pug Iron", body: "Next up: Workout A." });
    expect(reminderContent("B")).toEqual({ title: "Pug Iron", body: "Next up: Workout B." });
    expect(reminderContent("P")).toEqual({ title: "Pug Iron", body: "Next up: pull-up ladder." });
  });

  it("never uses exclamation marks", () => {
    for (const next of ["A", "B", "P"] as const) {
      const { title, body } = reminderContent(next);
      expect(title).not.toContain("!");
      expect(body).not.toContain("!");
    }
  });
});
