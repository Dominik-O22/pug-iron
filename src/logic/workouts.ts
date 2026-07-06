import type { ExerciseLog, WorkoutSession } from "../types";

export type WorkoutCode = WorkoutSession["workout"];

export function nextWorkout(lastSession?: Pick<WorkoutSession, "workout"> | null): WorkoutCode {
  if (!lastSession) {
    return "A";
  }

  return lastSession.workout === "A" ? "B" : "A";
}

export function calculateExerciseVolume(log: ExerciseLog): number {
  return log.sets.reduce((total, set) => total + set.weight * set.reps, 0);
}

export function calculateSessionVolume(entries: ExerciseLog[] | Pick<WorkoutSession, "entries">): number {
  const logs = Array.isArray(entries) ? entries : entries.entries;

  return logs.reduce((total, log) => total + calculateExerciseVolume(log), 0);
}
