import type { RowSession, WeighIn, WorkoutSession } from "../types";

export type ActivityKind = "workout" | "rower" | "weigh-in";
export type HabitFloor = "good" | "single" | "plain";

export type ActivityInputs = {
  rowSessions: Array<Pick<RowSession, "date">>;
  sessions: Array<Pick<WorkoutSession, "date">>;
  weighIns: Array<Pick<WeighIn, "date">>;
};

export type DayActivity = {
  active: boolean;
  date: string;
  dayOfMonth: number;
  kinds: ActivityKind[];
  liftingSessions: number;
  rowerSessions: number;
  weighIns: number;
};

export function aggregateActivityDays({
  rowSessions,
  sessions,
  weighIns
}: ActivityInputs): DayActivity[] {
  const days = new Map<string, DayActivity>();

  for (const session of sessions) {
    const day = getOrCreateDay(days, session.date);

    day.active = true;
    day.liftingSessions += 1;
    addKind(day, "workout");
  }

  for (const rowSession of rowSessions) {
    const day = getOrCreateDay(days, rowSession.date);

    day.active = true;
    day.rowerSessions += 1;
    addKind(day, "rower");
  }

  for (const weighIn of weighIns) {
    const day = getOrCreateDay(days, weighIn.date);

    day.active = true;
    day.weighIns += 1;
    addKind(day, "weigh-in");
  }

  return Array.from(days.values()).sort((left, right) => compareDates(left.date, right.date));
}

export function buildMonthCalendarStrip({
  month,
  rowSessions,
  sessions,
  weighIns
}: ActivityInputs & { month: string }): DayActivity[] {
  const activityByDate = new Map(
    aggregateActivityDays({ rowSessions, sessions, weighIns }).map((day) => [day.date, day])
  );
  const [year, monthNumber] = month.split("-").map(Number);
  const daysInMonth = new Date(year, monthNumber, 0).getDate();

  return Array.from({ length: daysInMonth }, (_, index) => {
    const dayOfMonth = index + 1;
    const date = `${year}-${String(monthNumber).padStart(2, "0")}-${String(dayOfMonth).padStart(
      2,
      "0"
    )}`;
    const activity = activityByDate.get(date);

    return (
      activity ?? {
        active: false,
        date,
        dayOfMonth,
        kinds: [],
        liftingSessions: 0,
        rowerSessions: 0,
        weighIns: 0
      }
    );
  });
}

export function classifyHabitFloor(liftingSessions: number): HabitFloor {
  if (liftingSessions >= 2) {
    return "good";
  }

  if (liftingSessions === 1) {
    return "single";
  }

  return "plain";
}

export function monthKeyFromDate(date: string): string {
  return date.slice(0, 7);
}

function getOrCreateDay(days: Map<string, DayActivity>, date: string): DayActivity {
  const existing = days.get(date);

  if (existing) {
    return existing;
  }

  const day: DayActivity = {
    active: false,
    date,
    dayOfMonth: Number(date.slice(8, 10)),
    kinds: [],
    liftingSessions: 0,
    rowerSessions: 0,
    weighIns: 0
  };

  days.set(date, day);

  return day;
}

function addKind(day: DayActivity, kind: ActivityKind): void {
  if (!day.kinds.includes(kind)) {
    day.kinds.push(kind);
  }
}

function compareDates(left: string, right: string): number {
  return left.localeCompare(right);
}
