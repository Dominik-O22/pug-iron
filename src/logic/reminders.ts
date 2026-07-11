export type ReminderSettings = {
  enabled: boolean;
  hour: number;
  minute: number;
  weekdays: number[];
};

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  enabled: false,
  hour: 12,
  minute: 0,
  weekdays: [1, 3, 5]
};

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  const rounded = Math.round(value);
  return Math.min(max, Math.max(min, rounded));
}

export function parseReminderSettings(value: unknown): ReminderSettings {
  const raw = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};

  const enabled =
    typeof raw.enabled === "boolean" ? raw.enabled : DEFAULT_REMINDER_SETTINGS.enabled;
  const hour = clampInt(raw.hour, 0, 23, DEFAULT_REMINDER_SETTINGS.hour);
  const minute = clampInt(raw.minute, 0, 59, DEFAULT_REMINDER_SETTINGS.minute);

  let weekdays = DEFAULT_REMINDER_SETTINGS.weekdays;
  if (Array.isArray(raw.weekdays)) {
    weekdays = [
      ...new Set(
        raw.weekdays.filter(
          (day): day is number => typeof day === "number" && Number.isInteger(day) && day >= 1 && day <= 7
        )
      )
    ].sort((a, b) => a - b);
  }

  return { enabled, hour, minute, weekdays: [...weekdays] };
}

export function planReminderOccurrences(
  settings: ReminderSettings,
  now: Date,
  trainedToday: boolean
): Date[] {
  if (!settings.enabled || settings.weekdays.length === 0) return [];

  const enabled = new Set(settings.weekdays);
  const occurrences: Date[] = [];

  for (let offset = 0; offset < 28; offset++) {
    const slot = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + offset,
      settings.hour,
      settings.minute
    );
    const isoWeekday = slot.getDay() === 0 ? 7 : slot.getDay();
    if (!enabled.has(isoWeekday)) continue;
    if (offset === 0 && (trainedToday || slot.getTime() <= now.getTime())) continue;
    occurrences.push(slot);
  }

  return occurrences;
}

export function reminderContent(next: "A" | "B" | "P"): { title: string; body: string } {
  const body =
    next === "A" ? "Next up: Workout A." : next === "B" ? "Next up: Workout B." : "Next up: pull-up ladder.";
  return { title: "Pug Iron", body };
}
