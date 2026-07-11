export type DateParts = {
  weekday: string;
  month: string;
  day: string;
  year: string;
};

export const labelTracking = { letterSpacing: 1.5 } as const;

export function formatWeight(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function formatVolume(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function formatRestTime(remainingMs: number): string {
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

// Words that carry no identification value on a tiny chip: equipment nouns and
// position/style modifiers. Skipping them surfaces the movement word ("row",
// "bench", "deadlift") instead of a truncated modifier ("one-ar", "romani").
const CHIP_SKIP_WORDS = new Set([
  "dumbbell",
  "db",
  "one-arm",
  "flat",
  "incline",
  "seated",
  "standing",
  "overhead",
  "lateral",
  "romanian",
  "two-db"
]);
const CHIP_MAX_CHARS = 8;

export function abbreviateExerciseName(name: string): string {
  const words = name
    .replace(/\(.*?\)/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 0);
  const candidate = words.find((word) => !CHIP_SKIP_WORDS.has(word.toLowerCase())) ?? words[0] ?? "";
  const truncated = candidate.length > CHIP_MAX_CHARS ? candidate.slice(0, 6) : candidate;

  return truncated.replace(/-+$/, "").toUpperCase();
}

export function localDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split("-").map(Number);

  return new Date(year, month - 1, day);
}

export function dateParts(dateString: string): DateParts {
  const date = parseLocalDate(dateString);

  return {
    weekday: new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(date),
    month: new Intl.DateTimeFormat("en-US", { month: "short" }).format(date),
    day: String(date.getDate()).padStart(2, "0"),
    year: String(date.getFullYear())
  };
}

export function weekStartString(dateString: string): string {
  const date = parseLocalDate(dateString);
  const daysSinceMonday = (date.getDay() + 6) % 7;

  date.setDate(date.getDate() - daysSinceMonday);

  return localDateString(date);
}
