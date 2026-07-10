import { LADDER_EXERCISE_DEFS, SEED_CUES_BY_ID } from "../plan";
import type {
  ExerciseDef,
  ExerciseLog,
  RowSession,
  SetEntry,
  Setting,
  WeighIn,
  WorkoutSession
} from "../types";

export const BACKUP_APP = "pug-iron";
export const BACKUP_SCHEMA_VERSION = 3;
const SUPPORTED_IMPORT_VERSIONS = [1, 2, 3];
const PULLUP_STAGE_VALUES = ["dead-hang", "scap-pull", "pullup-negative", "pullup", "complete"];

export type BackupPayload = {
  app: typeof BACKUP_APP;
  schemaVersion: typeof BACKUP_SCHEMA_VERSION;
  exportedAt: string;
  sessions: WorkoutSession[];
  rows: RowSession[];
  weighins: WeighIn[];
  exercises: ExerciseDef[];
  settings: Setting[];
};

export type BackupSourceData = Omit<BackupPayload, "app" | "schemaVersion" | "exportedAt">;

export type BackupCounts = {
  exercises: number;
  rows: number;
  sessions: number;
  settings: number;
  weighins: number;
};

export type BackupParseResult =
  | { backup: BackupPayload; counts: BackupCounts; ok: true }
  | { error: string; ok: false };

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export function buildBackupPayload(
  data: BackupSourceData,
  exportedAt: Date | string = new Date()
): BackupPayload {
  return {
    app: BACKUP_APP,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: exportedAt instanceof Date ? exportedAt.toISOString() : exportedAt,
    sessions: data.sessions.map(cloneWorkoutSession),
    rows: data.rows.map((row) => ({ ...row })),
    weighins: data.weighins.map((weighIn) => ({ ...weighIn })),
    exercises: data.exercises.map((exercise) => ({ ...exercise })),
    settings: data.settings.map((setting) => ({ ...setting }))
  };
}

export function serializeBackup(
  data: BackupSourceData,
  exportedAt: Date | string = new Date()
): string {
  return JSON.stringify(buildBackupPayload(data, exportedAt), null, 2);
}

export function deserializeBackup(contents: string): BackupParseResult {
  let parsed: unknown;

  try {
    parsed = JSON.parse(contents);
  } catch {
    return { error: "Backup file is not valid JSON.", ok: false };
  }

  return validateBackupPayload(parsed);
}

export function validateBackupPayload(value: unknown): BackupParseResult {
  const record = asRecord(value);

  if (!record) {
    return { error: "Backup file must contain one JSON object.", ok: false };
  }

  if (record.app !== BACKUP_APP) {
    return { error: "This backup was made for another app.", ok: false };
  }

  if (typeof record.schemaVersion !== "number" || !SUPPORTED_IMPORT_VERSIONS.includes(record.schemaVersion)) {
    return {
      error: `This backup uses schema version ${String(
        record.schemaVersion
      )}; this app supports version ${BACKUP_SCHEMA_VERSION}.`,
      ok: false
    };
  }

  const incomingVersion = record.schemaVersion;

  if (!isValidExportedAt(record.exportedAt)) {
    return { error: "Backup export time is missing or invalid.", ok: false };
  }

  const arrays = readBackupArrays(record);

  if (!arrays.ok) {
    return arrays;
  }

  // Older backups predate later columns; bring each up to the current shape before
  // validating. A v1 backup lacks form cues; anything below v3 lacks the pull-up
  // ladder defs and the pullupStage setting.
  if (incomingVersion === 1) {
    arrays.exercises = arrays.exercises.map(shimV1Exercise);
  }

  if (incomingVersion <= 2) {
    arrays.exercises = appendLadderDefs(arrays.exercises);
    arrays.settings = shimSettingsToV3(arrays.settings, arrays.sessions);
  }

  const validators: Array<[unknown[], (item: unknown, index: number) => string | null]> = [
    [arrays.sessions, validateWorkoutSession],
    [arrays.rows, validateRowSession],
    [arrays.weighins, validateWeighIn],
    [arrays.exercises, validateExerciseDef],
    [arrays.settings, validateSetting]
  ];

  for (const [items, validateItem] of validators) {
    for (let index = 0; index < items.length; index += 1) {
      const error = validateItem(items[index], index);

      if (error) {
        return { error, ok: false };
      }
    }
  }

  const backup: BackupPayload = {
    app: BACKUP_APP,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: record.exportedAt,
    sessions: arrays.sessions as WorkoutSession[],
    rows: arrays.rows as RowSession[],
    weighins: arrays.weighins as WeighIn[],
    exercises: arrays.exercises as ExerciseDef[],
    settings: arrays.settings as Setting[]
  };

  return { backup, counts: countBackupRecords(backup), ok: true };
}

export function countBackupRecords(backup: BackupPayload | BackupSourceData): BackupCounts {
  return {
    exercises: backup.exercises.length,
    rows: backup.rows.length,
    sessions: backup.sessions.length,
    settings: backup.settings.length,
    weighins: backup.weighins.length
  };
}

function shimV1Exercise(value: unknown): unknown {
  const record = asRecord(value);

  if (!record || Object.prototype.hasOwnProperty.call(record, "cues")) {
    return value;
  }

  const id = typeof record.id === "string" ? record.id : "";

  return { ...record, cues: SEED_CUES_BY_ID[id] ?? [] };
}

function appendLadderDefs(exercises: unknown[]): unknown[] {
  const existingIds = new Set(
    exercises
      .map((exercise) => asRecord(exercise)?.id)
      .filter((id): id is string => typeof id === "string")
  );
  const missing = LADDER_EXERCISE_DEFS.filter((def) => !existingIds.has(def.id)).map((def) => ({
    ...def,
    cues: [...def.cues]
  }));

  return [...exercises, ...missing];
}

function shimSettingsToV3(settings: unknown[], sessions: unknown[]): unknown[] {
  const hasStage = settings.some((setting) => asRecord(setting)?.key === "pullupStage");
  const bumped = settings.map((setting) => {
    const record = asRecord(setting);

    if (!record || record.key !== "schemaVersion") {
      return setting;
    }

    return { ...record, value: BACKUP_SCHEMA_VERSION };
  });

  if (hasStage) {
    return bumped;
  }

  return [
    ...bumped,
    { key: "pullupStage", value: backupHasPullupLogs(sessions) ? "pullup" : "dead-hang" }
  ];
}

function backupHasPullupLogs(sessions: unknown[]): boolean {
  return sessions.some((session) => {
    const entries = asRecord(session)?.entries;

    return (
      Array.isArray(entries) && entries.some((entry) => asRecord(entry)?.exerciseId === "pullup")
    );
  });
}

function cloneWorkoutSession(session: WorkoutSession): WorkoutSession {
  return {
    ...session,
    entries: session.entries.map(cloneExerciseLog),
    progressionEvents: [...session.progressionEvents]
  };
}

function cloneExerciseLog(entry: ExerciseLog): ExerciseLog {
  return {
    exerciseId: entry.exerciseId,
    sets: entry.sets.map((set) => ({ ...set }))
  };
}

function readBackupArrays(record: Record<string, unknown>):
  | {
      exercises: unknown[];
      ok: true;
      rows: unknown[];
      sessions: unknown[];
      settings: unknown[];
      weighins: unknown[];
    }
  | { error: string; ok: false } {
  const sessions = readArray(record, "sessions", "workouts");
  if (!sessions.ok) {
    return sessions;
  }

  const rows = readArray(record, "rows", "rower sessions");
  if (!rows.ok) {
    return rows;
  }

  const weighins = readArray(record, "weighins", "weigh-ins");
  if (!weighins.ok) {
    return weighins;
  }

  const exercises = readArray(record, "exercises", "exercises");
  if (!exercises.ok) {
    return exercises;
  }

  const settings = readArray(record, "settings", "settings");
  if (!settings.ok) {
    return settings;
  }

  return {
    exercises: exercises.value,
    ok: true,
    rows: rows.value,
    sessions: sessions.value,
    settings: settings.value,
    weighins: weighins.value
  };
}

function readArray(
  record: Record<string, unknown>,
  field: string,
  label: string
): { ok: true; value: unknown[] } | { error: string; ok: false } {
  const value = record[field];

  if (!Array.isArray(value)) {
    return { error: `Backup is missing the ${label} array.`, ok: false };
  }

  return { ok: true, value };
}

function validateWorkoutSession(value: unknown, index: number): string | null {
  const label = `Workout ${index + 1}`;
  const record = asRecord(value);

  if (!record) {
    return `${label} is not a valid object.`;
  }

  const idError = validateOptionalId(record.id, label);
  if (idError) {
    return idError;
  }

  if (!isValidDateString(record.date)) {
    return `${label} has an invalid date. Dates must use YYYY-MM-DD.`;
  }

  if (record.workout !== "A" && record.workout !== "B" && record.workout !== "P") {
    return `${label} has an unknown workout code.`;
  }

  if (!Array.isArray(record.entries)) {
    return `${label} is missing its exercise entries.`;
  }

  for (let entryIndex = 0; entryIndex < record.entries.length; entryIndex += 1) {
    const entryError = validateExerciseLog(record.entries[entryIndex], `${label} entry ${entryIndex + 1}`);

    if (entryError) {
      return entryError;
    }
  }

  if (!isNonNegativeFiniteNumber(record.startedAt)) {
    return `${label} has an invalid start time.`;
  }

  if (record.finishedAt !== undefined && !isNonNegativeFiniteNumber(record.finishedAt)) {
    return `${label} has an invalid finish time.`;
  }

  if (!isNonNegativeFiniteNumber(record.xp)) {
    return `${label} has an invalid XP value.`;
  }

  if (!Array.isArray(record.progressionEvents)) {
    return `${label} is missing progression events.`;
  }

  if (!record.progressionEvents.every((event) => typeof event === "string")) {
    return `${label} has an invalid progression event.`;
  }

  return null;
}

function validateExerciseLog(value: unknown, label: string): string | null {
  const record = asRecord(value);

  if (!record) {
    return `${label} is not a valid object.`;
  }

  if (!isNonEmptyString(record.exerciseId)) {
    return `${label} is missing an exercise id.`;
  }

  if (!Array.isArray(record.sets)) {
    return `${label} is missing sets.`;
  }

  for (let setIndex = 0; setIndex < record.sets.length; setIndex += 1) {
    const setError = validateSetEntry(record.sets[setIndex], `${label} set ${setIndex + 1}`);

    if (setError) {
      return setError;
    }
  }

  return null;
}

function validateSetEntry(value: unknown, label: string): string | null {
  const record = asRecord(value) as Partial<SetEntry> | null;

  if (!record) {
    return `${label} is not a valid object.`;
  }

  if (!isNonNegativeFiniteNumber(record.weight)) {
    return `${label} has an invalid weight.`;
  }

  if (!isNonNegativeInteger(record.reps)) {
    return `${label} has an invalid rep count.`;
  }

  if (record.seconds !== undefined && !isNonNegativeFiniteNumber(record.seconds)) {
    return `${label} has an invalid hold time.`;
  }

  return null;
}

function validateRowSession(value: unknown, index: number): string | null {
  const label = `Rower session ${index + 1}`;
  const record = asRecord(value);

  if (!record) {
    return `${label} is not a valid object.`;
  }

  const idError = validateOptionalId(record.id, label);
  if (idError) {
    return idError;
  }

  if (!isValidDateString(record.date)) {
    return `${label} has an invalid date. Dates must use YYYY-MM-DD.`;
  }

  if (!isPositiveFiniteNumber(record.minutes)) {
    return `${label} has invalid minutes.`;
  }

  if (record.meters !== undefined && !isNonNegativeInteger(record.meters)) {
    return `${label} has invalid meters.`;
  }

  if (!isNonNegativeFiniteNumber(record.xp)) {
    return `${label} has an invalid XP value.`;
  }

  return null;
}

function validateWeighIn(value: unknown, index: number): string | null {
  const label = `Weigh-in ${index + 1}`;
  const record = asRecord(value);

  if (!record) {
    return `${label} is not a valid object.`;
  }

  const idError = validateOptionalId(record.id, label);
  if (idError) {
    return idError;
  }

  if (!isValidDateString(record.date)) {
    return `${label} has an invalid date. Dates must use YYYY-MM-DD.`;
  }

  if (!isPositiveFiniteNumber(record.kg)) {
    return `${label} has an invalid body weight.`;
  }

  if (!isNonNegativeFiniteNumber(record.xp)) {
    return `${label} has an invalid XP value.`;
  }

  return null;
}

function validateExerciseDef(value: unknown, index: number): string | null {
  const label = `Exercise ${index + 1}`;
  const record = asRecord(value);

  if (!record) {
    return `${label} is not a valid object.`;
  }

  if (!isNonEmptyString(record.id)) {
    return `${label} is missing an id.`;
  }

  if (!isNonEmptyString(record.name)) {
    return `${label} is missing a name.`;
  }

  if (record.workout !== "A" && record.workout !== "B" && record.workout !== "P") {
    return `${label} has an unknown workout code.`;
  }

  if (!isPositiveInteger(record.order)) {
    return `${label} has an invalid order.`;
  }

  if (!isPositiveInteger(record.sets)) {
    return `${label} has an invalid set count.`;
  }

  if (!isPositiveInteger(record.repLow)) {
    return `${label} has an invalid low rep target.`;
  }

  if (!isPositiveInteger(record.repHigh) || record.repHigh < record.repLow) {
    return `${label} has an invalid high rep target.`;
  }

  if (record.loadType !== "weight" && record.loadType !== "assist" && record.loadType !== "body") {
    return `${label} has an unknown load type.`;
  }

  if (record.measure !== undefined && record.measure !== "reps" && record.measure !== "seconds") {
    return `${label} has an unknown measure.`;
  }

  if (!isNonNegativeFiniteNumber(record.incrementKg)) {
    return `${label} has an invalid increment.`;
  }

  if (typeof record.note !== "string") {
    return `${label} has an invalid note.`;
  }

  if (!Array.isArray(record.cues) || !record.cues.every((cue) => typeof cue === "string")) {
    return `${label} has invalid form cues.`;
  }

  return null;
}

function validateSetting(value: unknown, index: number): string | null {
  const label = `Setting ${index + 1}`;
  const record = asRecord(value);

  if (!record) {
    return `${label} is not a valid object.`;
  }

  if (!isNonEmptyString(record.key)) {
    return `${label} is missing a key.`;
  }

  if (!Object.prototype.hasOwnProperty.call(record, "value")) {
    return `${label} is missing a value.`;
  }

  if (record.key === "xpTotal" && !isNonNegativeFiniteNumber(record.value)) {
    return `${label} has an invalid XP total.`;
  }

  if (record.key === "schemaVersion" && record.value !== BACKUP_SCHEMA_VERSION) {
    return `${label} has an unsupported schema version.`;
  }

  if (
    record.key === "pullupStage" &&
    (typeof record.value !== "string" || !PULLUP_STAGE_VALUES.includes(record.value))
  ) {
    return `${label} has an unknown pull-up stage.`;
  }

  if (
    (record.key === "targetWeightKg" || record.key === "startWeightKg") &&
    record.value !== null &&
    !isPositiveFiniteNumber(record.value)
  ) {
    return `${label} has an invalid body weight setting.`;
  }

  return null;
}

function validateOptionalId(value: unknown, label: string): string | null {
  if (value === undefined) {
    return null;
  }

  return isPositiveInteger(value) ? null : `${label} has an invalid id.`;
}

function isValidExportedAt(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && Number.isFinite(Date.parse(value));
}

function isValidDateString(value: unknown): value is string {
  if (typeof value !== "string" || !datePattern.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && typeof value === "number" && value > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && typeof value === "number" && value >= 0;
}

function isPositiveFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isNonNegativeFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
