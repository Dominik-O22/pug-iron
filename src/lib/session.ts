import type { ExerciseDef, ExerciseLog, RowSession, SetEntry, WeighIn, WorkoutSession } from "../types";
import type { ProgressionTarget } from "../logic/progression";
import { formatWeight, weekStartString } from "./format";

export type DraftSet = SetEntry & {
  logged: boolean;
};

export type DraftExercise = {
  exercise: ExerciseDef;
  hasHistory: boolean;
  instruction: string;
  progressionTarget: ProgressionTarget;
  sets: DraftSet[];
};

export type RestState = {
  startedAt: number;
  durationMs: number;
};

export type HistoryEntry =
  | {
      date: string;
      item: WorkoutSession;
      kind: "workout";
      sortValue: number;
    }
  | {
      date: string;
      item: RowSession;
      kind: "rower";
      sortValue: number;
    }
  | {
      date: string;
      item: WeighIn;
      kind: "weigh-in";
      sortValue: number;
    };

export function buildLoggedEntries(draftExercises: DraftExercise[]): ExerciseLog[] {
  return draftExercises
    .map((draft) => ({
      exerciseId: draft.exercise.id,
      sets: draft.sets
        .filter((set) => set.logged)
        .map((set) => ({
          weight: set.weight,
          reps: set.reps
        }))
    }))
    .filter((entry) => entry.sets.length > 0);
}

export function countLoggedSets(entries: ExerciseLog[]): number {
  return entries.reduce((total, entry) => total + entry.sets.length, 0);
}

export type SetProgressSegment = {
  label: string;
  state: "active" | "logged" | "pending";
};

// One PM5-style segment per set: logged sets read back their numbers, the
// current set carries a pointer, untouched sets stay a quiet dash.
export function buildSetProgressSegments(
  sets: DraftSet[],
  activeSetIndex: number
): SetProgressSegment[] {
  return sets.map((set, index) => ({
    label: set.logged
      ? `S${index + 1} ${formatWeight(set.weight)}×${set.reps} ✓`
      : index === activeSetIndex
        ? `S${index + 1} ▸`
        : `S${index + 1} —`,
    state: index === activeSetIndex ? "active" : set.logged ? "logged" : "pending"
  }));
}

export function groupSessionsByWeek(sessions: WorkoutSession[]) {
  const groups: { weekStart: string; sessions: WorkoutSession[] }[] = [];

  for (const session of sessions) {
    const weekStart = weekStartString(session.date);
    const lastGroup = groups[groups.length - 1];

    if (lastGroup?.weekStart === weekStart) {
      lastGroup.sessions.push(session);
    } else {
      groups.push({ weekStart, sessions: [session] });
    }
  }

  return groups;
}

export function groupHistoryByWeek({
  rowSessions,
  sessions,
  weighIns
}: {
  rowSessions: RowSession[];
  sessions: WorkoutSession[];
  weighIns: WeighIn[];
}) {
  const entries: HistoryEntry[] = [
    ...sessions.map<HistoryEntry>((session) => ({
      date: session.date,
      item: session,
      kind: "workout",
      sortValue: session.startedAt
    })),
    ...rowSessions.map<HistoryEntry>((rowSession) => ({
      date: rowSession.date,
      item: rowSession,
      kind: "rower",
      sortValue: dateSortValue(rowSession.date, rowSession.id)
    })),
    ...weighIns.map<HistoryEntry>((weighIn) => ({
      date: weighIn.date,
      item: weighIn,
      kind: "weigh-in",
      sortValue: dateSortValue(weighIn.date, weighIn.id)
    }))
  ].sort((left, right) => right.sortValue - left.sortValue);
  const groups: { entries: HistoryEntry[]; weekStart: string }[] = [];

  for (const entry of entries) {
    const weekStart = weekStartString(entry.date);
    const lastGroup = groups[groups.length - 1];

    if (lastGroup?.weekStart === weekStart) {
      lastGroup.entries.push(entry);
    } else {
      groups.push({ weekStart, entries: [entry] });
    }
  }

  return groups;
}

function dateSortValue(date: string, id = 0): number {
  return Date.parse(`${date}T12:00:00.000Z`) + id;
}
