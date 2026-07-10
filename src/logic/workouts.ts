import type { ExerciseLog, WorkoutSession } from "../types";

export type WorkoutCode = WorkoutSession["workout"];

export function nextWorkout(
  recentSessions?: ReadonlyArray<Pick<WorkoutSession, "workout">> | null
): WorkoutCode {
  // Standalone "P" pull-up ladder sessions are transparent to the A/B rotation:
  // only the most recent real A/B lift decides which workout comes next.
  const lastLift = recentSessions?.find(
    (session) => session.workout === "A" || session.workout === "B"
  );

  if (!lastLift) {
    return "A";
  }

  return lastLift.workout === "A" ? "B" : "A";
}

export function calculateExerciseVolume(log: ExerciseLog): number {
  return log.sets.reduce((total, set) => total + set.weight * set.reps, 0);
}

export function calculateSessionVolume(entries: ExerciseLog[] | Pick<WorkoutSession, "entries">): number {
  const logs = Array.isArray(entries) ? entries : entries.entries;

  return logs.reduce((total, log) => total + calculateExerciseVolume(log), 0);
}
