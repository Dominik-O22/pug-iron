import * as SQLite from "expo-sqlite";

import { EXERCISE_DEFS, LADDER_EXERCISE_DEFS, SEED_CUES_BY_ID, SEED_REST_SEC_BY_ID } from "./plan";
import type { BackupPayload, BackupSourceData } from "./logic/backup";
import { advancePullupStage, type PullupStage } from "./logic/progression";
import { parseReminderSettings, type ReminderSettings } from "./logic/reminders";
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
const SCHEMA_VERSION = 4;
const DEFAULT_PULLUP_STAGE: PullupStage = "dead-hang";

export type PugIronDb = SQLite.SQLiteDatabase;

export type XpMutationResult<T> = {
  item: T;
  nextXpTotal: number;
  previousXpTotal: number;
};

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
  cues: string;
  measure: string;
  rest_sec: number;
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

type SettingRow = {
  key: string;
  value: string;
};

type CountRow = {
  count: number;
};

const DEFAULT_SETTINGS: Setting[] = [
  { key: "xpTotal", value: 0 },
  { key: "targetWeightKg", value: 83 },
  { key: "voiceAnnouncements", value: false },
  { key: "schemaVersion", value: 4 }
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
                        rep_low INTEGER, rep_high INTEGER, load_type TEXT, increment_kg REAL, note TEXT,
                        cues TEXT NOT NULL DEFAULT '[]', measure TEXT NOT NULL DEFAULT 'reps',
                        rest_sec INTEGER NOT NULL DEFAULT 90);
CREATE TABLE settings  (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE INDEX idx_sessions_date ON sessions(date);
CREATE INDEX idx_rows_date     ON rows(date);
CREATE INDEX idx_weighins_date ON weighins(date);
`;

const INSERT_EXERCISE_SQL = `
INSERT INTO exercises (id, name, workout, ord, sets, rep_low, rep_high, load_type, increment_kg, note, cues, measure, rest_sec)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
  },
  {
    from: 1,
    to: 2,
    run: async (db) => {
      // Existing v1 installs lack the column; fresh installs already have it from CREATE_SCHEMA_SQL.
      if (!(await columnExists(db, "exercises", "cues"))) {
        await db.execAsync("ALTER TABLE exercises ADD COLUMN cues TEXT NOT NULL DEFAULT '[]';");
      }

      await backfillSeedCues(db);
      await setSettingValue(db, "schemaVersion", 2);
      await db.execAsync("PRAGMA user_version = 2;");
    }
  },
  {
    from: 2,
    to: 3,
    run: async (db) => {
      // Existing v2 installs lack the column; fresh installs already have it from CREATE_SCHEMA_SQL.
      if (!(await columnExists(db, "exercises", "measure"))) {
        await db.execAsync("ALTER TABLE exercises ADD COLUMN measure TEXT NOT NULL DEFAULT 'reps';");
      }

      // seedExerciseDefs inserts every column, including rest_sec from v4 — the column
      // must exist before the ladder seed even though this step only reaches v3.
      if (!(await columnExists(db, "exercises", "rest_sec"))) {
        await db.execAsync("ALTER TABLE exercises ADD COLUMN rest_sec INTEGER NOT NULL DEFAULT 90;");
      }

      await seedExerciseDefs(db, LADDER_EXERCISE_DEFS);
      await db.runAsync(INSERT_SETTING_SQL, ["pullupStage", JSON.stringify(DEFAULT_PULLUP_STAGE)]);
      await setSettingValue(db, "schemaVersion", 3);
      await db.execAsync("PRAGMA user_version = 3;");
    }
  },
  {
    from: 3,
    to: 4,
    run: async (db) => {
      // Existing v3 installs lack the column; fresh installs already have it from CREATE_SCHEMA_SQL.
      if (!(await columnExists(db, "exercises", "rest_sec"))) {
        await db.execAsync("ALTER TABLE exercises ADD COLUMN rest_sec INTEGER NOT NULL DEFAULT 90;");
      }

      await backfillSeedRestSec(db);

      // Widen isolation rep ranges, but only where the def still matches the old seed
      // (rep ranges are user-editable).
      await db.runAsync(
        `UPDATE exercises SET rep_high = 20 WHERE id = 'lateral-raise' AND rep_low = 12 AND rep_high = 15;`
      );
      await db.runAsync(
        `UPDATE exercises SET rep_high = 15 WHERE id = 'hammer-curl' AND rep_low = 10 AND rep_high = 12;`
      );
      await db.runAsync(
        `UPDATE exercises SET rep_high = 15 WHERE id = 'oh-triceps-ext' AND rep_low = 10 AND rep_high = 12;`
      );

      await seedExerciseDefs(
        db,
        EXERCISE_DEFS.filter((exercise) => exercise.id === "rear-delt-raise")
      );
      await setSettingValue(db, "schemaVersion", 4);
      await db.execAsync("PRAGMA user_version = 4;");
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
    `SELECT id, name, workout, ord, sets, rep_low, rep_high, load_type, increment_kg, note, cues, measure, rest_sec
     FROM exercises
     ORDER BY workout ASC, ord ASC;`
  );

  return rows.map(mapExerciseRow);
}

export async function getXpTotal(db: PugIronDb): Promise<number> {
  return getSettingValue(db, "xpTotal", 0);
}

export async function getPullupStage(db: PugIronDb): Promise<PullupStage> {
  return getSettingValue<PullupStage>(db, "pullupStage", DEFAULT_PULLUP_STAGE);
}

export async function getReminderSettings(db: PugIronDb): Promise<ReminderSettings> {
  return parseReminderSettings(await getSettingValue<unknown>(db, "reminderSettings", null));
}

export async function setReminderSettings(
  db: PugIronDb,
  settings: ReminderSettings
): Promise<void> {
  await setSettingValue(db, "reminderSettings", settings);
}

export async function getVoiceAnnouncements(db: PugIronDb): Promise<boolean> {
  return getSettingValue(db, "voiceAnnouncements", false);
}

export async function setVoiceAnnouncements(db: PugIronDb, enabled: boolean): Promise<void> {
  await setSettingValue(db, "voiceAnnouncements", enabled);
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

export async function listSettings(db: PugIronDb): Promise<Setting[]> {
  const rows = await db.getAllAsync<SettingRow>(
    `SELECT key, value
     FROM settings
     ORDER BY key ASC;`
  );

  return rows.map((row) => ({
    key: row.key,
    value: parseJson<unknown>(row.value)
  }));
}

export async function getBackupSourceData(db: PugIronDb): Promise<BackupSourceData> {
  const [sessions, rows, weighins, exercises, settings] = await Promise.all([
    listWorkoutSessions(db),
    listRowSessions(db),
    listWeighIns(db),
    listExerciseDefs(db),
    listSettings(db)
  ]);

  return { exercises, rows, sessions, settings, weighins };
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
): Promise<XpMutationResult<WorkoutSession>> {
  let insertedId: number | undefined;
  let previousXpTotal = 0;
  let nextXpTotal = 0;

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

    previousXpTotal = await getSettingValue(db, "xpTotal", 0);
    nextXpTotal = previousXpTotal + session.xp;
    await setSettingValue(db, "xpTotal", nextXpTotal);

    // Any session logging the active ladder exercise (the "P" mini-session or the
    // stage-swapped workout B slot) can graduate the ladder; keep the stored stage
    // in step with the entries that were just saved.
    const currentStage = await getSettingValue<PullupStage>(db, "pullupStage", DEFAULT_PULLUP_STAGE);
    const { stage } = advancePullupStage(currentStage, EXERCISE_DEFS, session.entries);

    if (stage !== currentStage) {
      await setSettingValue(db, "pullupStage", stage);
    }
  });

  return {
    item: { ...session, id: insertedId },
    nextXpTotal,
    previousXpTotal
  };
}

export async function insertRowSessionWithXp(
  db: PugIronDb,
  rowSession: Omit<RowSession, "id" | "xp">
): Promise<XpMutationResult<RowSession>> {
  let insertedId: number | undefined;
  let nextXpTotal = 0;
  let previousXpTotal = 0;
  const xp = XP_EVENTS.rowerSession;

  await db.withTransactionAsync(async () => {
    const result = await db.runAsync(
      `INSERT INTO rows (date, minutes, meters, xp)
       VALUES (?, ?, ?, ?);`,
      [rowSession.date, rowSession.minutes, rowSession.meters ?? null, xp]
    );

    insertedId = result.lastInsertRowId;

    previousXpTotal = await getSettingValue(db, "xpTotal", 0);
    nextXpTotal = previousXpTotal + xp;
    await setSettingValue(db, "xpTotal", nextXpTotal);
  });

  return {
    item: { ...rowSession, id: insertedId, xp },
    nextXpTotal,
    previousXpTotal
  };
}

export async function insertWeighInWithXp(
  db: PugIronDb,
  weighIn: Omit<WeighIn, "id" | "xp">
): Promise<XpMutationResult<WeighIn>> {
  let insertedId: number | undefined;
  let nextXpTotal = 0;
  let previousXpTotal = 0;
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

    previousXpTotal = await getSettingValue(db, "xpTotal", 0);
    nextXpTotal = previousXpTotal + xp;

    if (xp > 0) {
      await setSettingValue(db, "xpTotal", nextXpTotal);
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

  return {
    item: { ...weighIn, id: insertedId, xp },
    nextXpTotal,
    previousXpTotal
  };
}

export async function updateWorkoutSessionKeepingXp(
  db: PugIronDb,
  session: WorkoutSession & { id: number }
): Promise<WorkoutSession> {
  await db.runAsync(
    `UPDATE sessions
     SET entries = ?, progression_events = ?, finished_at = ?
     WHERE id = ?;`,
    [
      JSON.stringify(session.entries),
      JSON.stringify(session.progressionEvents),
      session.finishedAt ?? null,
      session.id
    ]
  );

  return session;
}

export async function deleteWorkoutSessionKeepingXp(db: PugIronDb, id: number): Promise<void> {
  await db.runAsync(`DELETE FROM sessions WHERE id = ?;`, [id]);
}

export async function deleteRowSessionKeepingXp(db: PugIronDb, id: number): Promise<void> {
  await db.runAsync(`DELETE FROM rows WHERE id = ?;`, [id]);
}

export async function deleteWeighInKeepingXp(db: PugIronDb, id: number): Promise<void> {
  await db.runAsync(`DELETE FROM weighins WHERE id = ?;`, [id]);
}

export async function updateExerciseDefs(
  db: PugIronDb,
  exercises: ExerciseDef[]
): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const exercise of exercises) {
      await db.runAsync(
        `UPDATE exercises
         SET name = ?, workout = ?, ord = ?, sets = ?, rep_low = ?, rep_high = ?,
             load_type = ?, increment_kg = ?, note = ?, cues = ?
         WHERE id = ?;`,
        [
          exercise.name,
          exercise.workout,
          exercise.order,
          exercise.sets,
          exercise.repLow,
          exercise.repHigh,
          exercise.loadType,
          exercise.incrementKg,
          exercise.note,
          JSON.stringify(exercise.cues),
          exercise.id
        ]
      );
    }
  });
}

export async function replaceAllDataWithBackup(
  db: PugIronDb,
  backup: BackupPayload | BackupSourceData
): Promise<void> {
  await db.withTransactionAsync(async () => {
    await clearAllTables(db);

    for (const session of backup.sessions) {
      await insertWorkoutSessionFromBackup(db, session);
    }

    for (const rowSession of backup.rows) {
      await insertRowSessionFromBackup(db, rowSession);
    }

    for (const weighIn of backup.weighins) {
      await insertWeighInFromBackup(db, weighIn);
    }

    for (const exercise of backup.exercises) {
      await insertExerciseDefFromBackup(db, exercise);
    }

    for (const setting of backup.settings) {
      await insertSettingValue(db, setting);
    }
  });
}

export async function wipeAllDataAndReseed(db: PugIronDb): Promise<void> {
  await db.withTransactionAsync(async () => {
    await clearAllTables(db);
    await seedExerciseDefs(db, EXERCISE_DEFS);
    await seedDefaultSettings(db);
  });
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
      exercise.note,
      JSON.stringify(exercise.cues),
      exercise.measure ?? "reps",
      exercise.restSec ?? 90
    ]);
  }
}

async function columnExists(db: PugIronDb, table: string, column: string): Promise<boolean> {
  const columns = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table});`);

  return columns.some((entry) => entry.name === column);
}

async function backfillSeedRestSec(db: PugIronDb): Promise<void> {
  for (const [id, restSec] of Object.entries(SEED_REST_SEC_BY_ID)) {
    await db.runAsync(`UPDATE exercises SET rest_sec = ? WHERE id = ? AND rest_sec = 90;`, [
      restSec,
      id
    ]);
  }
}

async function backfillSeedCues(db: PugIronDb): Promise<void> {
  for (const [id, cues] of Object.entries(SEED_CUES_BY_ID)) {
    await db.runAsync(
      `UPDATE exercises
       SET cues = ?
       WHERE id = ? AND (cues IS NULL OR cues = '' OR cues = '[]');`,
      [JSON.stringify(cues), id]
    );
  }
}

async function seedDefaultSettings(db: PugIronDb): Promise<void> {
  for (const setting of DEFAULT_SETTINGS) {
    await db.runAsync(INSERT_SETTING_SQL, [setting.key, JSON.stringify(setting.value)]);
  }
}

async function clearAllTables(db: PugIronDb): Promise<void> {
  await db.execAsync(`
DELETE FROM sessions;
DELETE FROM rows;
DELETE FROM weighins;
DELETE FROM exercises;
DELETE FROM settings;
`);
}

async function insertWorkoutSessionFromBackup(
  db: PugIronDb,
  session: WorkoutSession
): Promise<void> {
  const values = [
    session.date,
    session.workout,
    JSON.stringify(session.entries),
    JSON.stringify(session.progressionEvents),
    session.startedAt,
    session.finishedAt ?? null,
    session.xp
  ];

  if (typeof session.id === "number") {
    await db.runAsync(
      `INSERT INTO sessions (id, date, workout, entries, progression_events, started_at, finished_at, xp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      [session.id, ...values]
    );
    return;
  }

  await db.runAsync(
    `INSERT INTO sessions (date, workout, entries, progression_events, started_at, finished_at, xp)
     VALUES (?, ?, ?, ?, ?, ?, ?);`,
    values
  );
}

async function insertRowSessionFromBackup(
  db: PugIronDb,
  rowSession: RowSession
): Promise<void> {
  const values = [rowSession.date, rowSession.minutes, rowSession.meters ?? null, rowSession.xp];

  if (typeof rowSession.id === "number") {
    await db.runAsync(
      `INSERT INTO rows (id, date, minutes, meters, xp)
       VALUES (?, ?, ?, ?, ?);`,
      [rowSession.id, ...values]
    );
    return;
  }

  await db.runAsync(
    `INSERT INTO rows (date, minutes, meters, xp)
     VALUES (?, ?, ?, ?);`,
    values
  );
}

async function insertWeighInFromBackup(db: PugIronDb, weighIn: WeighIn): Promise<void> {
  const values = [weighIn.date, weighIn.kg, weighIn.xp];

  if (typeof weighIn.id === "number") {
    await db.runAsync(
      `INSERT INTO weighins (id, date, kg, xp)
       VALUES (?, ?, ?, ?);`,
      [weighIn.id, ...values]
    );
    return;
  }

  await db.runAsync(
    `INSERT INTO weighins (date, kg, xp)
     VALUES (?, ?, ?);`,
    values
  );
}

async function insertExerciseDefFromBackup(
  db: PugIronDb,
  exercise: ExerciseDef
): Promise<void> {
  await db.runAsync(
    `INSERT INTO exercises (id, name, workout, ord, sets, rep_low, rep_high, load_type, increment_kg, note, cues, measure, rest_sec)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      exercise.id,
      exercise.name,
      exercise.workout,
      exercise.order,
      exercise.sets,
      exercise.repLow,
      exercise.repHigh,
      exercise.loadType,
      exercise.incrementKg,
      exercise.note,
      JSON.stringify(exercise.cues),
      exercise.measure ?? "reps",
      exercise.restSec ?? 90
    ]
  );
}

async function insertSettingValue(db: PugIronDb, setting: Setting): Promise<void> {
  await db.runAsync(`INSERT INTO settings (key, value) VALUES (?, ?);`, [
    setting.key,
    JSON.stringify(setting.value)
  ]);
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
    loadType: parseLoadType(row.load_type),
    measure: row.measure === "seconds" ? "seconds" : "reps",
    incrementKg: row.increment_kg,
    restSec: row.rest_sec ?? 90,
    note: row.note,
    cues: parseCues(row.cues)
  };
}

function parseLoadType(value: string): ExerciseDef["loadType"] {
  if (value === "assist" || value === "body") {
    return value;
  }

  return "weight";
}

function parseCues(value: string | null): string[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);

    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
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
  if (value !== "A" && value !== "B" && value !== "P") {
    throw new Error(`Unknown workout code: ${value}`);
  }

  return value;
}

function parseJson<T>(value: string): T {
  return JSON.parse(value) as T;
}
