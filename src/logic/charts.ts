import type { ExerciseDef, WeighIn, WorkoutSession } from "../types";

export type DatedValue = {
  date: string;
  value: number;
};

export type ExerciseProgressMode = "top-set" | "volume";

export type ExerciseProgressPoint = DatedValue & {
  rawValue: number;
};

type ExerciseChartDef = Pick<ExerciseDef, "id" | "loadType">;

export const ASSIST_LEVEL_MAX = 4;

export function dateToDayNumber(dateString: string): number {
  const [year, month, day] = dateString.split("-").map(Number);

  return Date.UTC(year, month - 1, day) / 86400000;
}

export function buildDailyWeightPoints(
  weighIns: Array<Pick<WeighIn, "date" | "kg"> & { id?: number }>
): DatedValue[] {
  if (weighIns.length === 0) {
    return [];
  }

  const latestByDate = new Map<string, number>();
  const sorted = [...weighIns].sort((left, right) => {
    const dateDiff = dateToDayNumber(left.date) - dateToDayNumber(right.date);

    if (dateDiff !== 0) {
      return dateDiff;
    }

    return (left.id ?? 0) - (right.id ?? 0);
  });

  for (const weighIn of sorted) {
    latestByDate.set(weighIn.date, weighIn.kg);
  }

  return Array.from(latestByDate.entries()).map(([date, value]) => ({ date, value }));
}

export function buildRollingAverageSeries(points: DatedValue[], windowDays = 7): DatedValue[] {
  if (points.length === 0) {
    return [];
  }

  const sorted = sortDatedValues(points);

  return sorted.map((point) => {
    const dayNumber = dateToDayNumber(point.date);
    const windowStart = dayNumber - (windowDays - 1);
    const valuesInWindow = sorted.filter((candidate) => {
      const candidateDay = dateToDayNumber(candidate.date);

      return candidateDay >= windowStart && candidateDay <= dayNumber;
    });
    const average =
      valuesInWindow.reduce((total, candidate) => total + candidate.value, 0) /
      valuesInWindow.length;

    return {
      date: point.date,
      value: roundTo(average, 2)
    };
  });
}

export function buildWeightGuidelineSeries({
  dates,
  kgPerWeek = -0.5,
  startDate,
  startWeightKg
}: {
  dates: string[];
  kgPerWeek?: number;
  startDate: string | null;
  startWeightKg: number | null;
}): DatedValue[] {
  if (!startDate || typeof startWeightKg !== "number" || dates.length === 0) {
    return [];
  }

  const startDay = dateToDayNumber(startDate);
  const uniqueDates = Array.from(new Set(dates)).sort(
    (left, right) => dateToDayNumber(left) - dateToDayNumber(right)
  );

  return uniqueDates.map((date) => {
    const daysFromStart = dateToDayNumber(date) - startDay;

    return {
      date,
      value: roundTo(startWeightKg + (daysFromStart / 7) * kgPerWeek, 2)
    };
  });
}

export function buildExerciseProgressSeries(
  sessions: WorkoutSession[],
  exercise: ExerciseChartDef,
  mode: ExerciseProgressMode
): ExerciseProgressPoint[] {
  if (sessions.length === 0) {
    return [];
  }

  return [...sessions]
    .sort(compareSessionsAscending)
    .flatMap<ExerciseProgressPoint>((session) => {
      const entry = session.entries.find((candidate) => candidate.exerciseId === exercise.id);

      if (!entry || entry.sets.length === 0) {
        return [];
      }

      if (mode === "volume") {
        const rawValue =
          exercise.loadType === "assist"
            ? entry.sets.reduce((total, set) => total + set.reps, 0)
            : entry.sets.reduce((total, set) => total + set.weight * set.reps, 0);

        return [{ date: session.date, rawValue, value: roundTo(rawValue, 2) }];
      }

      if (exercise.loadType === "assist") {
        const rawValue = Math.min(...entry.sets.map((set) => set.weight));

        return [
          {
            date: session.date,
            rawValue,
            value: ASSIST_LEVEL_MAX - rawValue
          }
        ];
      }

      const rawValue = Math.max(...entry.sets.map((set) => set.weight));

      return [{ date: session.date, rawValue, value: rawValue }];
    });
}

function sortDatedValues(points: DatedValue[]): DatedValue[] {
  return [...points].sort((left, right) => dateToDayNumber(left.date) - dateToDayNumber(right.date));
}

function compareSessionsAscending(left: WorkoutSession, right: WorkoutSession): number {
  const dateDiff = dateToDayNumber(left.date) - dateToDayNumber(right.date);

  if (dateDiff !== 0) {
    return dateDiff;
  }

  return left.startedAt - right.startedAt;
}

function roundTo(value: number, places: number): number {
  return Number(value.toFixed(places));
}
