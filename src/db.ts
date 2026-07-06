import * as SQLite from "expo-sqlite";

import { EXERCISE_DEFS } from "./plan";
import type { ExerciseDef } from "./types";

const DATABASE_NAME = "pug-iron.db";
const SCHEMA_VERSION = 1;

type PugIronDb = SQLite.SQLiteDatabase;

type UserVersionRow = {
  user_version: number;
};

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
      await db.execAsync("PRAGMA user_version = 1;");
    }
  }
];

export async function openPugIronDb(): Promise<PugIronDb> {
  const db = await SQLite.openDatabaseAsync(DATABASE_NAME);

  await db.execAsync("PRAGMA journal_mode = WAL;");
  await runMigrations(db);

  return db;
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
