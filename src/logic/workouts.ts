import type { ExerciseDef, ExerciseLog, SetEntry, WorkoutSession } from "../types";

export type WorkoutCode = WorkoutSession["workout"];

export type SetPrefill = {
  hasHistory: boolean;
  sets: SetEntry[];
};

type PrefillExercise = Pick<ExerciseDef, "sets" | "repLow">;

export function nextWorkout(lastSession?: Pick<WorkoutSession, "workout"> | null): WorkoutCode {
  if (!lastSession) {
    return "A";
  }

  return lastSession.workout === "A" ? "B" : "A";
}

export function deriveSetPrefill(
  exercise: PrefillExercise,
  previousLog?: ExerciseLog | null
): SetPrefill {
  if (!previousLog || previousLog.sets.length === 0) {
    return {
      hasHistory: false,
      sets: Array.from({ length: exercise.sets }, () => ({
        weight: 0,
        reps: exercise.repLow
      }))
    };
  }

  const fallbackSet = previousLog.sets[previousLog.sets.length - 1];

  return {
    hasHistory: true,
    sets: Array.from({ length: exercise.sets }, (_, index) => {
      const previousSet = previousLog.sets[index] ?? fallbackSet;

      return {
        weight: previousSet.weight,
        reps: previousSet.reps
      };
    })
  };
}

export function calculateExerciseVolume(log: ExerciseLog): number {
  return log.sets.reduce((total, set) => total + set.weight * set.reps, 0);
}

export function calculateSessionVolume(entries: ExerciseLog[] | Pick<WorkoutSession, "entries">): number {
  const logs = Array.isArray(entries) ? entries : entries.entries;

  return logs.reduce((total, log) => total + calculateExerciseVolume(log), 0);
}
