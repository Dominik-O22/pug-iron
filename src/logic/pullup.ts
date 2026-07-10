import type { PullupStage } from "./progression";
import type { ExerciseDef, WorkoutSession } from "../types";

// The four trainable rungs, in order. "complete" is the terminal marker stored
// once the ladder graduates; it is never itself a rung.
export const PULLUP_STAGE_SEQUENCE: Exclude<PullupStage, "complete">[] = [
  "dead-hang",
  "scap-pull",
  "pullup-negative",
  "pullup"
];

export const PULLUP_LADDER_RUNGS = PULLUP_STAGE_SEQUENCE.length;

export function isPrePullupStage(stage: PullupStage): boolean {
  return stage === "dead-hang" || stage === "scap-pull" || stage === "pullup-negative";
}

export function isLadderComplete(stage: PullupStage): boolean {
  return stage === "complete";
}

// Which exercise def the active stage trains. Once the ladder reaches the band
// pull-up (or graduates past it) the active exercise is the standard "pullup".
export function resolveLadderExerciseId(stage: PullupStage): string {
  return isPrePullupStage(stage) ? stage : "pullup";
}

export function ladderRungNumber(stage: PullupStage): number {
  if (stage === "complete") {
    return PULLUP_LADDER_RUNGS;
  }

  return PULLUP_STAGE_SEQUENCE.indexOf(stage) + 1;
}

export function ladderExerciseForStage(
  defs: ExerciseDef[],
  stage: PullupStage
): ExerciseDef | undefined {
  const id = resolveLadderExerciseId(stage);

  return defs.find((def) => def.id === id);
}

// The exercises a logger session should contain for a given workout, honouring the
// active ladder stage: the "P" mini-session holds only the active rung, and workout
// B swaps its pull-up slot for the active rung until the ladder reaches the band
// pull-up.
export function workoutExercisesForStage(
  defs: ExerciseDef[],
  workout: WorkoutSession["workout"],
  stage: PullupStage
): ExerciseDef[] {
  if (workout === "P") {
    const active = ladderExerciseForStage(defs, stage);

    return active ? [active] : [];
  }

  const workoutDefs = defs.filter((def) => def.workout === workout);

  if (workout !== "B" || !isPrePullupStage(stage)) {
    return workoutDefs;
  }

  const active = ladderExerciseForStage(defs, stage);

  if (!active) {
    return workoutDefs;
  }

  return workoutDefs.map((def) => (def.id === "pullup" ? active : def));
}
