import { XP_EVENTS } from "./xp";
import type { ExerciseDef, ExerciseLog, WorkoutSession } from "../types";

export type ProgressionRule =
  | "first-time"
  | "add-load"
  | "reduce-assist"
  | "add-unassisted-rep"
  | "add-rep"
  | "hold-load"
  | "add-hold-time";

export type ProgressionTargetSet = {
  weight: number | null;
  reps: number;
  seconds?: number;
};

export type ProgressionEventTarget = {
  exerciseId: string;
  loadType: ExerciseDef["loadType"];
  targetLoad: number;
};

export type ProgressionTarget = {
  exerciseId: string;
  hasHistory: boolean;
  instruction: string;
  loadType: ExerciseDef["loadType"];
  progressionEvent: ProgressionEventTarget | null;
  rule: ProgressionRule;
  sets: ProgressionTargetSet[];
};

type ProgressionExercise = Pick<
  ExerciseDef,
  "id" | "sets" | "repLow" | "repHigh" | "loadType" | "incrementKg" | "measure"
>;

const FIRST_TIME_HINT =
  "first time: pick a weight where you'd fail 1–2 reps past the top of the range";

// Assist bands 0–3 (higher = more help); a ladder graduate starts on 2 = purple.
const FIRST_TIME_ASSIST = 2;

export function deriveProgressionTarget(
  exercise: ProgressionExercise,
  previousLog?: ExerciseLog | null
): ProgressionTarget {
  if (!previousLog || previousLog.sets.length === 0) {
    if (exercise.measure === "seconds") {
      const sets = buildHoldSets(exercise.sets, null, exercise.repLow);

      return {
        exerciseId: exercise.id,
        hasHistory: false,
        instruction: formatHold(sets),
        loadType: exercise.loadType,
        progressionEvent: null,
        rule: "hold-load",
        sets
      };
    }

    if (exercise.loadType === "body") {
      const sets = buildSets(exercise.sets, null, exercise.repLow);

      return {
        exerciseId: exercise.id,
        hasHistory: false,
        instruction: formatReps(sets),
        loadType: exercise.loadType,
        progressionEvent: null,
        rule: "hold-load",
        sets
      };
    }

    if (exercise.loadType === "assist") {
      const sets = buildSets(exercise.sets, FIRST_TIME_ASSIST, exercise.repLow);

      return {
        exerciseId: exercise.id,
        hasHistory: false,
        instruction: `${formatLoad(FIRST_TIME_ASSIST, "assist")} × ${formatReps(sets)}`,
        loadType: exercise.loadType,
        progressionEvent: null,
        rule: "first-time",
        sets
      };
    }

    const sets = buildSets(exercise.sets, null, exercise.repLow);

    return {
      exerciseId: exercise.id,
      hasHistory: false,
      instruction: `${formatReps(sets)} - ${FIRST_TIME_HINT}`,
      loadType: exercise.loadType,
      progressionEvent: null,
      rule: "first-time",
      sets
    };
  }

  if (exercise.measure === "seconds") {
    return deriveHoldTarget(exercise, previousLog);
  }

  const baseLoad = previousLog.sets[0].weight;

  if (allLoggedSetsReachedTop(exercise, previousLog)) {
    if (exercise.loadType === "weight") {
      const targetLoad = normalizeLoad(baseLoad + exercise.incrementKg);
      const sets = buildSets(exercise.sets, targetLoad, exercise.repLow);

      return {
        exerciseId: exercise.id,
        hasHistory: true,
        instruction: `${formatLoad(targetLoad, "weight")} × ${formatReps(sets)}`,
        loadType: exercise.loadType,
        progressionEvent: {
          exerciseId: exercise.id,
          loadType: "weight",
          targetLoad
        },
        rule: "add-load",
        sets
      };
    }

    if (exercise.loadType === "body") {
      const repsTarget = buildRepTarget(exercise, previousLog);
      const sets = repsTarget.reps.map((reps, index) => ({
        weight: previousLog.sets[index]?.weight ?? baseLoad,
        reps
      }));

      return {
        exerciseId: exercise.id,
        hasHistory: true,
        instruction: `${formatLoad(baseLoad, exercise.loadType)} × ${formatReps(sets)}`,
        loadType: exercise.loadType,
        progressionEvent: null,
        rule: "hold-load",
        sets
      };
    }

    if (baseLoad > 0) {
      const targetLoad = normalizeLoad(Math.max(0, baseLoad - 1));
      const sets = buildSets(exercise.sets, targetLoad, exercise.repLow);

      return {
        exerciseId: exercise.id,
        hasHistory: true,
        instruction: `${formatLoad(targetLoad, "assist")} × ${formatReps(sets)}`,
        loadType: exercise.loadType,
        progressionEvent: {
          exerciseId: exercise.id,
          loadType: "assist",
          targetLoad
        },
        rule: "reduce-assist",
        sets
      };
    }

    const sets = buildUnassistedRepTarget(exercise, previousLog, baseLoad);

    return {
      exerciseId: exercise.id,
      hasHistory: true,
      instruction: `add a rep: aim ${formatReps(sets)} @ ${formatLoad(baseLoad, "assist")}`,
      loadType: exercise.loadType,
      progressionEvent: null,
      rule: "add-unassisted-rep",
      sets
    };
  }

  const repsTarget = buildRepTarget(exercise, previousLog);
  const sets = repsTarget.reps.map((reps, index) => ({
    weight: previousLog.sets[index]?.weight ?? baseLoad,
    reps
  }));
  const loadLabel = formatLoad(baseLoad, exercise.loadType);

  return {
    exerciseId: exercise.id,
    hasHistory: true,
    instruction: repsTarget.addedRep
      ? `add a rep: aim ${formatReps(sets)} @ ${loadLabel}`
      : `${loadLabel} × ${formatReps(sets)}`,
    loadType: exercise.loadType,
    progressionEvent: null,
    rule: repsTarget.addedRep ? "add-rep" : "hold-load",
    sets
  };
}

export function deriveProgressionTargets(
  exercises: ProgressionExercise[],
  latestLogs: Record<string, ExerciseLog>
): Record<string, ProgressionTarget> {
  return exercises.reduce<Record<string, ProgressionTarget>>((targets, exercise) => {
    targets[exercise.id] = deriveProgressionTarget(exercise, latestLogs[exercise.id]);

    return targets;
  }, {});
}

export function detectProgressionEvents(
  exercises: ProgressionExercise[],
  latestLogs: Record<string, ExerciseLog>,
  entries: ExerciseLog[]
): string[] {
  const exercisesById = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  const events: string[] = [];

  for (const entry of entries) {
    const exercise = exercisesById.get(entry.exerciseId);

    if (!exercise || entry.sets.length === 0) {
      continue;
    }

    const target = deriveProgressionTarget(exercise, latestLogs[entry.exerciseId]);
    const event = target.progressionEvent;

    if (!event) {
      continue;
    }

    // Reason from what happened, not from an exact match: a self-chosen jump past
    // the recommended load still progressed (heavier weight / a lower assist band).
    if (entry.sets.every((set) => reachedProgressionLoad(set.weight, event))) {
      events.push(entry.exerciseId);
    }
  }

  return events;
}

function reachedProgressionLoad(load: number, event: ProgressionEventTarget): boolean {
  return event.loadType === "assist" ? load <= event.targetLoad : load >= event.targetLoad;
}

function allLoggedSetsReachedTop(exercise: ProgressionExercise, previousLog: ExerciseLog): boolean {
  return (
    previousLog.sets.length >= 2 &&
    previousLog.sets.every((set) => set.reps >= exercise.repHigh)
  );
}

function buildSets(setCount: number, weight: number | null, reps: number): ProgressionTargetSet[] {
  return Array.from({ length: setCount }, () => ({ weight, reps }));
}

function deriveHoldTarget(
  exercise: ProgressionExercise,
  previousLog: ExerciseLog
): ProgressionTarget {
  const previousSeconds = previousLog.sets.map((set) => set.seconds ?? 0);
  // Min, not max: the level every set held. Max would jump the target past the
  // +5s/session cadence whenever sets are uneven (e.g. 22/18/15 → target 22).
  const currentTarget = Math.min(
    30,
    Math.max(
      exercise.repLow,
      previousSeconds.length > 0 ? Math.min(...previousSeconds) : exercise.repLow
    )
  );
  const allLoggedSetsReachedTarget =
    previousLog.sets.length >= 2 &&
    previousLog.sets.every((set) => (set.seconds ?? 0) >= currentTarget);
  const targetSeconds = allLoggedSetsReachedTarget
    ? Math.min(30, currentTarget + 5)
    : currentTarget;
  const sets = buildHoldSets(exercise.sets, previousLog, targetSeconds);
  const progressed = allLoggedSetsReachedTarget && targetSeconds > currentTarget;

  return {
    exerciseId: exercise.id,
    hasHistory: true,
    instruction: progressed ? `add hold time: ${formatHold(sets)}` : formatHold(sets),
    loadType: exercise.loadType,
    progressionEvent: null,
    rule: progressed ? "add-hold-time" : "hold-load",
    sets
  };
}

function buildHoldSets(
  setCount: number,
  previousLog: ExerciseLog | null,
  seconds: number
): ProgressionTargetSet[] {
  const baseWeight = previousLog?.sets[0]?.weight ?? null;

  return Array.from({ length: setCount }, (_, index) => ({
    weight: previousLog?.sets[index]?.weight ?? baseWeight,
    reps: 0,
    seconds
  }));
}

function buildRepTarget(
  exercise: ProgressionExercise,
  previousLog: ExerciseLog
): { addedRep: boolean; reps: number[] } {
  const reps = Array.from({ length: exercise.sets }, (_, index) => {
    return previousLog.sets[index]?.reps ?? exercise.repLow;
  });
  const firstLoggedNonMaxedIndex = previousLog.sets.findIndex((set, index) => {
    return index < exercise.sets && set.reps < exercise.repHigh;
  });

  if (firstLoggedNonMaxedIndex < 0) {
    return { addedRep: false, reps };
  }

  return {
    addedRep: true,
    reps: reps.map((value, index) => (index === firstLoggedNonMaxedIndex ? value + 1 : value))
  };
}

function buildUnassistedRepTarget(
  exercise: ProgressionExercise,
  previousLog: ExerciseLog,
  baseLoad: number
): ProgressionTargetSet[] {
  const reps = Array.from({ length: exercise.sets }, (_, index) => {
    return previousLog.sets[index]?.reps ?? exercise.repHigh;
  });

  return reps.map((repsValue, index) => ({
    weight: previousLog.sets[index]?.weight ?? baseLoad,
    reps: index === 0 ? repsValue + 1 : repsValue
  }));
}

function formatReps(sets: ProgressionTargetSet[]): string {
  return sets.map((set) => String(set.reps)).join("/");
}

function formatHold(sets: ProgressionTargetSet[]): string {
  return sets.map((set) => `${set.seconds ?? 0}s`).join("/");
}

function formatLoad(load: number, loadType: ExerciseDef["loadType"]): string {
  if (loadType === "assist") {
    return `assist ${formatNumber(load)}`;
  }

  if (loadType === "body") {
    return "bodyweight";
  }

  return `${formatNumber(load)} kg`;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function normalizeLoad(value: number): number {
  return Number(value.toFixed(1));
}

export type PullupStage =
  | "dead-hang"
  | "scap-pull"
  | "pullup-negative"
  | "pullup"
  | "complete";

export type PullupStageProgression = {
  stage: PullupStage;
  progressionEvent: string | null;
};

export function advancePullupStage(
  activeStage: PullupStage,
  exerciseDefs: ExerciseDef[],
  entries: ExerciseLog[]
): PullupStageProgression {
  if (activeStage === "complete") {
    return { stage: activeStage, progressionEvent: null };
  }

  const exercise = exerciseDefs.find((candidate) => candidate.id === activeStage);
  const entry = entries.find((candidate) => candidate.exerciseId === activeStage);

  if (!exercise || !entry || !qualifiesForPullupStage(activeStage, entry)) {
    return { stage: activeStage, progressionEvent: null };
  }

  if (activeStage === "dead-hang") {
    return { stage: "scap-pull", progressionEvent: "dead-hang" };
  }

  if (activeStage === "scap-pull") {
    return { stage: "pullup-negative", progressionEvent: "scap-pull" };
  }

  if (activeStage === "pullup-negative") {
    return { stage: "pullup", progressionEvent: "pullup-negative" };
  }

  return { stage: "complete", progressionEvent: "ladder-complete" };
}

export function calculateWorkoutXp(
  workout: WorkoutSession["workout"],
  progressionEventCount = 0
): number {
  const baseXp = workout === "P" ? XP_EVENTS.rowerSession : XP_EVENTS.workoutSessionSaved;

  return baseXp + Math.max(0, progressionEventCount) * XP_EVENTS.progressionEvent;
}

function qualifiesForPullupStage(
  stage: Exclude<PullupStage, "complete">,
  entry: ExerciseLog
): boolean {
  if (entry.sets.length < 3) {
    return false;
  }

  const sets = entry.sets.slice(0, 3);

  if (stage === "dead-hang") {
    return sets.every((set) => (set.seconds ?? 0) >= 30);
  }

  if (stage === "scap-pull") {
    return sets.every((set) => set.reps >= 8);
  }

  if (stage === "pullup-negative") {
    return sets.every((set) => set.reps >= 5);
  }

  // ≤ 2, not === 2: less assist than purple is strictly harder, so it still graduates.
  return sets.every((set) => set.weight <= 2 && set.reps >= 5);
}
