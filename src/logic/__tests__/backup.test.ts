import {
  BACKUP_APP,
  BACKUP_SCHEMA_VERSION,
  buildBackupPayload,
  countBackupRecords,
  deserializeBackup,
  serializeBackup,
  validateBackupPayload,
  type BackupSourceData
} from "../backup";

const sourceData: BackupSourceData = {
  sessions: [
    {
      id: 7,
      date: "2026-07-06",
      workout: "A",
      entries: [
        {
          exerciseId: "flat-db-press",
          sets: [
            { weight: 14, reps: 12 },
            { weight: 14, reps: 11 }
          ]
        }
      ],
      startedAt: 1783338000000,
      finishedAt: 1783341600000,
      xp: 125,
      progressionEvents: ["flat-db-press"]
    }
  ],
  rows: [{ id: 2, date: "2026-07-07", minutes: 10, meters: 2200, xp: 40 }],
  weighins: [{ id: 3, date: "2026-07-08", kg: 91.4, xp: 10 }],
  exercises: [
    {
      id: "flat-db-press",
      name: "Flat dumbbell bench press",
      workout: "A",
      order: 1,
      sets: 3,
      repLow: 8,
      repHigh: 12,
      loadType: "weight",
      incrementKg: 2,
      note: "Feet planted"
    }
  ],
  settings: [
    { key: "xpTotal", value: 175 },
    { key: "targetWeightKg", value: 83 },
    { key: "schemaVersion", value: 1 }
  ]
};

const exportedAt = new Date("2026-07-06T10:30:00.000Z");

describe("backup serialization", () => {
  it("round-trips domain-shaped data without changing records", () => {
    const serialized = serializeBackup(sourceData, exportedAt);
    const result = deserializeBackup(serialized);

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.backup).toEqual({
        app: BACKUP_APP,
        schemaVersion: BACKUP_SCHEMA_VERSION,
        exportedAt: "2026-07-06T10:30:00.000Z",
        ...sourceData
      });
    }
  });

  it("rejects backups for the wrong app or schema version", () => {
    expect(validateBackupPayload({ ...buildBackupPayload(sourceData, exportedAt), app: "other" })).toEqual({
      error: "This backup was made for another app.",
      ok: false
    });

    const wrongVersion = validateBackupPayload({
      ...buildBackupPayload(sourceData, exportedAt),
      schemaVersion: 2
    });

    expect(wrongVersion.ok).toBe(false);
    expect(wrongVersion.ok ? "" : wrongVersion.error).toContain("schema version 2");
  });

  it("rejects malformed records with a plain-language error", () => {
    const malformedDate = validateBackupPayload({
      ...buildBackupPayload(sourceData, exportedAt),
      rows: [{ id: 2, date: "07/07/2026", minutes: 10, meters: 2200, xp: 40 }]
    });

    expect(malformedDate.ok).toBe(false);
    expect(malformedDate.ok ? "" : malformedDate.error).toBe(
      "Rower session 1 has an invalid date. Dates must use YYYY-MM-DD."
    );

    const malformedNumber = validateBackupPayload({
      ...buildBackupPayload(sourceData, exportedAt),
      weighins: [{ id: 3, date: "2026-07-08", kg: Infinity, xp: 10 }]
    });

    expect(malformedNumber.ok).toBe(false);
    expect(malformedNumber.ok ? "" : malformedNumber.error).toBe(
      "Weigh-in 1 has an invalid body weight."
    );
  });

  it("accepts an empty backup with all required arrays", () => {
    const result = deserializeBackup(
      JSON.stringify({
        app: BACKUP_APP,
        schemaVersion: BACKUP_SCHEMA_VERSION,
        exportedAt: "2026-07-06T10:30:00.000Z",
        sessions: [],
        rows: [],
        weighins: [],
        exercises: [],
        settings: []
      })
    );

    expect(result).toEqual({
      backup: {
        app: BACKUP_APP,
        schemaVersion: BACKUP_SCHEMA_VERSION,
        exportedAt: "2026-07-06T10:30:00.000Z",
        sessions: [],
        rows: [],
        weighins: [],
        exercises: [],
        settings: []
      },
      counts: {
        exercises: 0,
        rows: 0,
        sessions: 0,
        settings: 0,
        weighins: 0
      },
      ok: true
    });
  });

  it("reports counts for every exported table", () => {
    const backup = buildBackupPayload(
      {
        ...sourceData,
        rows: [
          { id: 1, date: "2026-07-07", minutes: 10, xp: 40 },
          { id: 2, date: "2026-07-08", minutes: 12, meters: 2600, xp: 40 }
        ],
        settings: [...sourceData.settings, { key: "startWeightKg", value: 92 }]
      },
      exportedAt
    );

    expect(countBackupRecords(backup)).toEqual({
      exercises: 1,
      rows: 2,
      sessions: 1,
      settings: 4,
      weighins: 1
    });
  });
});
