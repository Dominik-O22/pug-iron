import * as SQLite from "expo-sqlite";

import { EXERCISE_DEFS } from "./plan";
import { XP_EVENTS } from "./logic/xp";
import type {
  ExerciseDef,
  ExerciseLog,
  LifetimeTotals,
  RowSession,
  Setting,
  WeighIn,
  WeightSettings,
  WorkoutSession
} from "./types";

const DATABASE_NAME = "pug-iron.db";
const SCHEMA_VERSION = 1;

export type PugIronDb = SQLite.SQLiteDatabase;

type UserVersionRow = {
  user_version: number;
};

type ExerciseRow = {
  id: string;
  name: string;
  workout: string;
  ord: number;
  sets: number;
  rep_low: number;
  rep_high: number;
  load_type: string;
  increment_kg: number;
  note: string;
};

type SessionRow = {
  id: number;
  date: string;
  workout: string;
  entries: string;
  progression_events: string;
  started_at: number;
  finished_at: number | null;
  xp: number;
};

type RowSessionRow = {
  id: number;
  date: string;
  minutes: number;
  meters: number | null;
  xp: number;
};

type WeighInRow = {
  id: number;
  date: string;
  kg: number;
  xp: number;
};

type SettingValueRow = {
  value: string;
};

type CountRow = {
  count: number;
};

const DEFAULT_SETTINGS: Setting[] = [
  { key: "xpTotal", value: 0 },
  { key: "targetWeightKg", value: 83 },
  { key: "schemaVersion", value: 1 }
];

const CREATE_SCHEMA_SQL = `
CREATE TABLE sessions  (id INTEGER PRIMARY KEY, date TEXT NOT NULL, workout TEXT NOT NULL,
                        entries TEXT NOT NULL,
                        progression_events TEXT NOT NULL,
                        started_at INTEGER NOT NULL, finished_at INTEGER, xp INTEGER NOT NULL);
CREATE TABLE rows      (id INTEGER PRIMARY KEY, date TEXT NOT NULL, minutes REAL NOT NULL,
                        meters INTEGER, xp INTEGER NOT NULL);
CREATE TABLE weighins  (id INTEGER PRIMARY KEY, date TEXT NOT NULL, kg REAL NOT NULL, xp INTEGER NOT NULL);
CREATE TABLE exercises (id TEXT PRIMARY KEY, name TEXT, workout TEXT, ord INTEGER, sets INTEGER,
                        rep_low INTEGER, rep_high INTEGER, load_type TEXT, increment_kg REAL, note TEXT);
CREATE TABLE settings  (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE INDEX idx_sessions_date ON sessions(date);
CREATE INDEX idx_rows_date     ON rows(date);
CREATE INDEX idx_weighins_date ON weighins(date);
`;

const INSERT_EXERCISE_SQL = `
INSERT INTO exercises (id, name, workout, ord, sets, rep_low, rep_high, load_type, increment_kg, note)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(id) DO NOTHING;
`;

const INSERT_SETTING_SQL = `
INSERT INTO settings (key, value)
VALUES (?, ?)
ON CONFLICT(key) DO NOTHING;
`;

type MigrationStep = {
  from: number;
  to: number;
  run: (db: PugIronDb) => Promise<void>;
};

const migrationSteps: MigrationStep[] = [
  {
    from: 0,
    to: 1,
    run: async (db) => {
      await db.execAsync(CREATE_SCHEMA_SQL);
      await seedExerciseDefs(db, EXERCISE_DEFS);
      await seedDefaultSettings(db);
      await db.execAsync("PRAGMA user_version = 1;");
    }
  }
];

export async function openPugIronDb(): Promise<PugIronDb> {
  const db = await SQLite.openDatabaseAsync(DATABASE_NAME);

  await db.execAsync("PRAGMA journal_mode = WAL;");
  await runMigrations(db);
  await seedDefaultSettings(db);

  return db;
}

export async function listExerciseDefs(db: PugIronDb): Promise<ExerciseDef[]> {
  const rows = await db.getAllAsync<ExerciseRow>(
    `SELECT id, name, workout, ord, sets, rep_low, rep_high, load_type, increment_kg, note
     FROM exercises
     ORDER BY workout ASC, ord ASC;`
  );

  return rows.map(mapExerciseRow);
}

export async function getXpTotal(db: PugIronDb): Promise<number> {
  return getSettingValue(db, "xpTotal", 0);
}

export async function getLastWorkoutSession(db: PugIronDb): Promise<WorkoutSession | null> {
  const row = await db.getFirstAsync<SessionRow>(
    `SELECT id, date, workout, entries, progression_events, started_at, finished_at, xp
     FROM sessions
     ORDER BY started_at DESC, id DESC
     LIMIT 1;`
  );

  return row ? mapSessionRow(row) : null;
}

export async function getTodayWorkoutSessions(
  db: PugIronDb,
  date: string
): Promise<WorkoutSession[]> {
  const rows = await db.getAllAsync<SessionRow>(
    `SELECT id, date, workout, entries, progression_events, started_at, finished_at, xp
     FROM sessions
     WHERE date = ?
     ORDER BY started_at DESC, id DESC;`,
    [date]
  );

  return rows.map(mapSessionRow);
}

export async function listWorkoutSessions(db: PugIronDb): Promise<WorkoutSession[]> {
  const rows = await db.getAllAsync<SessionRow>(
    `SELECT id, date, workout, entries, progression_events, started_at, finished_at, xp
     FROM sessions
     ORDER BY started_at DESC, id DESC;`
  );

  return rows.map(mapSessionRow);
}

export async function listRowSessions(db: PugIronDb): Promise<RowSession[]> {
  const rows = await db.getAllAsync<RowSessionRow>(
    `SELECT id, date, minutes, meters, xp
     FROM rows
     ORDER BY date DESC, id DESC;`
  );

  return rows.map(mapRowSessionRow);
}

export async function listWeighIns(db: PugIronDb): Promise<WeighIn[]> {
  const rows = await db.getAllAsync<WeighInRow>(
    `SELECT id, date, kg, xp
     FROM weighins
     ORDER BY date ASC, id ASC;`
  );

  return rows.map(mapWeighInRow);
}

export async function getLatestExerciseLogs(
  db: PugIronDb,
  exerciseIds: string[]
): Promise<Record<string, ExerciseLog>> {
  if (exerciseIds.length === 0) {
    return {};
  }

  const targets = new Set(exerciseIds);
  const logs: Record<string, ExerciseLog> = {};
  const rows = await db.getAllAsync<Pick<SessionRow, "entries">>(
    `SELECT entries
     FROM sessions
     ORDER BY started_at DESC, id DESC;`
  );

  for (const row of rows) {
    const entries = parseJson<ExerciseLog[]>(row.entries);

    for (const entry of entries) {
      if (targets.has(entry.exerciseId) && !logs[entry.exerciseId]) {
        logs[entry.exerciseId] = entry;
      }
    }

    if (Object.keys(logs).length === targets.size) {
      break;
    }
  }

  return logs;
}

export async function getWeightSettings(db: PugIronDb): Promise<WeightSettings> {
  const targetWeightKg = await getSettingValue(db, "targetWeightKg", 83);
  let startWeightKg = await getSettingValue<number | null>(db, "startWeightKg", null);

  if (typeof startWeightKg !== "number") {
    const firstWeighIn = await db.getFirstAsync<Pick<WeighInRow, "kg">>(
      `SELECT kg
       FROM weighins
       ORDER BY date ASC, id ASC
       LIMIT 1;`
    );

    if (firstWeighIn) {
      startWeightKg = firstWeighIn.kg;
      await setSettingValue(db, "startWeightKg", startWeightKg);
    }
  }

  return {
    targetWeightKg,
    startWeightKg: typeof startWeightKg === "number" ? startWeightKg : null
  };
}

export async function getLifetimeTotals(db: PugIronDb): Promise<LifetimeTotals> {
  const [sessions, rowSessions, exercises] = await Promise.all([
    listWorkoutSessions(db),
    listRowSessions(db),
    listExerciseDefs(db)
  ]);
  const exercisesById = new Map(exercises.map((exercise) => [exercise.id, exercise]));

  return {
    sessions: sessions.length,
    sets: sessions.reduce(
      (total, session) =>
        total + session.entries.reduce((sessionTotal, entry) => sessionTotal + entry.sets.length, 0),
      0
    ),
    kgLifted: sessions.reduce(
      (total, session) =>
        total +
        session.entries.reduce((sessionTotal, entry) => {
          const exercise = exercisesById.get(entry.exerciseId);

          if (exercise?.loadType !== "weight") {
            return sessionTotal;
          }

          return (
            sessionTotal +
            entry.sets.reduce((entryTotal, set) => entryTotal + set.weight * set.reps, 0)
          );
        }, 0),
      0
    ),
    metersRowed: rowSessions.reduce((total, rowSession) => total + (rowSession.meters ?? 0), 0)
  };
}

export async function insertWorkoutSessionWithXp(
  db: PugIronDb,
  session: WorkoutSession
): Promise<WorkoutSession> {
  let insertedId: number | undefined;

  await db.withTransactionAsync(async () => {
    const result = await db.runAsync(
      `INSERT INTO sessions (date, workout, entries, progression_events, started_at, finished_at, xp)
       VALUES (?, ?, ?, ?, ?, ?, ?);`,
      [
        session.date,
        session.workout,
        JSON.stringify(session.entries),
        JSON.stringify(session.progressionEvents),
        session.startedAt,
        session.finishedAt ?? null,
        session.xp
      ]
    );

    insertedId = result.lastInsertRowId;

    const currentXp = await getSettingValue(db, "xpTotal", 0);
    await setSettingValue(db, "xpTotal", currentXp + session.xp);
  });

  return { ...session, id: insertedId };
}

export async function insertRowSessionWithXp(
  db: PugIronDb,
  rowSession: Omit<RowSession, "id" | "xp">
): Promise<RowSession> {
  let insertedId: number | undefined;
  const xp = XP_EVENTS.rowerSession;

  await db.withTransactionAsync(async () => {
    const result = await db.runAsync(
      `INSERT INTO rows (date, minutes, meters, xp)
       VALUES (?, ?, ?, ?);`,
      [rowSession.date, rowSession.minutes, rowSession.meters ?? null, xp]
    );

    insertedId = result.lastInsertRowId;

    const currentXp = await getSettingValue(db, "xpTotal", 0);
    await setSettingValue(db, "xpTotal", currentXp + xp);
  });

  return { ...rowSession, id: insertedId, xp };
}

export async function insertWeighInWithXp(
  db: PugIronDb,
  weighIn: Omit<WeighIn, "id" | "xp">
): Promise<WeighIn> {
  let insertedId: number | undefined;
  let xp = 0;

  await db.withTransactionAsync(async () => {
    const existingForDate = await db.getFirstAsync<CountRow>(
      `SELECT COUNT(*) AS count
       FROM weighins
       WHERE date = ?;`,
      [weighIn.date]
    );
    xp = (existingForDate?.count ?? 0) > 0 ? 0 : XP_EVENTS.weighIn;

    const result = await db.runAsync(
      `INSERT INTO weighins (date, kg, xp)
       VALUES (?, ?, ?);`,
      [weighIn.date, weighIn.kg, xp]
    );

    insertedId = result.lastInsertRowId;

    if (xp > 0) {
      const currentXp = await getSettingValue(db, "xpTotal", 0);
      await setSettingValue(db, "xpTotal", currentXp + xp);
    }

    const currentStartWeight = await getSettingValue<number | null>(db, "startWeightKg", null);

    if (typeof currentStartWeight !== "number") {
      const firstWeighIn = await db.getFirstAsync<Pick<WeighInRow, "kg">>(
        `SELECT kg
         FROM weighins
         ORDER BY date ASC, id ASC
         LIMIT 1;`
      );

      if (firstWeighIn) {
        await setSettingValue(db, "startWeightKg", firstWeighIn.kg);
      }
    }
  });

  return { ...weighIn, id: insertedId, xp };
}

async function runMigrations(db: PugIronDb): Promise<void> {
  let currentVersion = await getUserVersion(db);

  while (currentVersion < SCHEMA_VERSION) {
    const migration = migrationSteps.find((step) => step.from === currentVersion);

    if (!migration) {
      throw new Error(`No migration path from schema version ${currentVersion}`);
    }

    await db.withTransactionAsync(async () => {
      await migration.run(db);
    });

    currentVersion = migration.to;
  }
}

async function getUserVersion(db: PugIronDb): Promise<number> {
  const row = await db.getFirstAsync<UserVersionRow>("PRAGMA user_version;");

  return row?.user_version ?? 0;
}

async function seedExerciseDefs(db: PugIronDb, exerciseDefs: ExerciseDef[]): Promise<void> {
  for (const exercise of exerciseDefs) {
    await db.runAsync(INSERT_EXERCISE_SQL, [
      exercise.id,
      exercise.name,
      exercise.workout,
      exercise.order,
      exercise.sets,
      exercise.repLow,
      exercise.repHigh,
      exercise.loadType,
      exercise.incrementKg,
      exercise.note
    ]);
  }
}

async function seedDefaultSettings(db: PugIronDb): Promise<void> {
  for (const setting of DEFAULT_SETTINGS) {
    await db.runAsync(INSERT_SETTING_SQL, [setting.key, JSON.stringify(setting.value)]);
  }
}

async function getSettingValue<T>(db: PugIronDb, key: string, fallback: T): Promise<T> {
  const row = await db.getFirstAsync<SettingValueRow>("SELECT value FROM settings WHERE key = ?;", [
    key
  ]);

  if (!row) {
    return fallback;
  }

  try {
    return JSON.parse(row.value) as T;
  } catch {
    return fallback;
  }
}

async function setSettingValue(db: PugIronDb, key: string, value: unknown): Promise<void> {
  await db.runAsync(
    `INSERT INTO settings (key, value)
     VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value;`,
    [key, JSON.stringify(value)]
  );
}

function mapExerciseRow(row: ExerciseRow): ExerciseDef {
  return {
    id: row.id,
    name: row.name,
    workout: parseWorkout(row.workout),
    order: row.ord,
    sets: row.sets,
    repLow: row.rep_low,
    repHigh: row.rep_high,
    loadType: row.load_type === "assist" ? "assist" : "weight",
    incrementKg: row.increment_kg,
    note: row.note
  };
}

function mapSessionRow(row: SessionRow): WorkoutSession {
  return {
    id: row.id,
    date: row.date,
    workout: parseWorkout(row.workout),
    entries: parseJson<ExerciseLog[]>(row.entries),
    progressionEvents: parseJson<string[]>(row.progression_events),
    startedAt: row.started_at,
    ...(row.finished_at === null ? {} : { finishedAt: row.finished_at }),
    xp: row.xp
  };
}

function mapRowSessionRow(row: RowSessionRow): RowSession {
  return {
    id: row.id,
    date: row.date,
    minutes: row.minutes,
    ...(row.meters === null ? {} : { meters: row.meters }),
    xp: row.xp
  };
}

function mapWeighInRow(row: WeighInRow): WeighIn {
  return {
    id: row.id,
    date: row.date,
    kg: row.kg,
    xp: row.xp
  };
}

function parseWorkout(value: string): WorkoutSession["workout"] {
  if (value !== "A" && value !== "B") {
    throw new Error(`Unknown workout code: ${value}`);
  }

  return value;
}

function parseJson<T>(value: string): T {
  return JSON.parse(value) as T;
}
