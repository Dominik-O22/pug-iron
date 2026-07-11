import type { ExerciseDef, SetEntry } from "../types";

const SMALL_NUMBERS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen"
] as const;

const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"] as const;
const ASSIST_BANDS: Record<number, string> = {
  0: "unassisted",
  1: "black band",
  2: "purple band",
  3: "purple and black bands"
};

export function numberToSpeech(value: number): string {
  if (!Number.isFinite(value)) {
    return String(value);
  }

  const rounded = Math.round(value * 10) / 10;
  const integer = Math.trunc(rounded);
  const decimal = Math.round(Math.abs(rounded - integer) * 10);
  const sign = rounded < 0 ? "minus " : "";
  const integerWords = integerToSpeech(Math.abs(integer));

  return decimal === 0
    ? `${sign}${integerWords}`
    : `${sign}${integerWords} point ${SMALL_NUMBERS[decimal]}`;
}

export function formatSetTargetForSpeech(exercise: ExerciseDef, set: SetEntry): string {
  if (exercise.measure === "seconds") {
    const seconds = set.seconds ?? set.reps;
    return `${numberToSpeech(seconds)} ${seconds === 1 ? "second" : "seconds"}`;
  }

  const reps = `${numberToSpeech(set.reps)} ${set.reps === 1 ? "rep" : "reps"}`;

  if (exercise.loadType === "body" || (set.weight <= 0 && exercise.loadType === "weight")) {
    return reps;
  }

  if (exercise.loadType === "assist") {
    const band = ASSIST_BANDS[Math.round(set.weight)] ?? `assist level ${numberToSpeech(set.weight)}`;
    return band === "unassisted" ? `${reps} unassisted` : `${reps} with ${band}`;
  }

  return `${reps} at ${numberToSpeech(set.weight)} ${set.weight === 1 ? "kilo" : "kilos"}`;
}

export function formatExerciseTargetForSpeech(exercise: ExerciseDef, set: SetEntry): string {
  return `${exercise.name} — ${formatSetTargetForSpeech(exercise, set)}`;
}

export function formatRestDoneForSpeech(
  exercise: ExerciseDef | null,
  set: SetEntry | null
): string {
  if (!exercise || !set) {
    return "rest done";
  }

  return `rest done — next: ${exercise.name}, ${formatSetTargetForSpeech(exercise, set)}`;
}

function integerToSpeech(value: number): string {
  if (value < 20) {
    return SMALL_NUMBERS[value] ?? String(value);
  }

  if (value < 100) {
    const tens = TENS[Math.floor(value / 10)] ?? "";
    const remainder = value % 10;
    return remainder === 0 ? tens : `${tens} ${SMALL_NUMBERS[remainder]}`;
  }

  if (value < 1000) {
    const hundreds = `${SMALL_NUMBERS[Math.floor(value / 100)]} hundred`;
    const remainder = value % 100;
    return remainder === 0 ? hundreds : `${hundreds} ${integerToSpeech(remainder)}`;
  }

  if (value < 1_000_000) {
    const thousands = `${integerToSpeech(Math.floor(value / 1000))} thousand`;
    const remainder = value % 1000;
    return remainder === 0 ? thousands : `${thousands} ${integerToSpeech(remainder)}`;
  }

  return String(value);
}
