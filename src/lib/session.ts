import type { ExerciseDef, ExerciseLog, SetEntry, WorkoutSession } from "../types";
import { weekStartString } from "./format";

export type DraftSet = SetEntry & {
  logged: boolean;
};

export type DraftExercise = {
  exercise: ExerciseDef;
  hasHistory: boolean;
  sets: DraftSet[];
};

export type RestState = {
  startedAt: number;
  durationMs: number;
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
