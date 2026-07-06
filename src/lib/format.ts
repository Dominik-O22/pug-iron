export type DateParts = {
  weekday: string;
  month: string;
  day: string;
  year: string;
};

export const labelTracking = { letterSpacing: 1.5 } as const;

export function roundStepperValue(value: number, step: number): number {
  const rounded = Math.round(value / step) * step;

  return Number(rounded.toFixed(1));
}

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
