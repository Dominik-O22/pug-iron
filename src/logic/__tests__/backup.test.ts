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
      note: "Feet planted",
      cues: ["Shoulder blades pinned back", "Lower to mid-chest, full range"]
    }
  ],
  settings: [
    { key: "xpTotal", value: 175 },
    { key: "targetWeightKg", value: 83 },
    { key: "schemaVersion", value: 3 },
    { key: "pullupStage", value: "scap-pull" }
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
      schemaVersion: 4
    });

    expect(wrongVersion.ok).toBe(false);
    expect(wrongVersion.ok ? "" : wrongVersion.error).toContain("schema version 4");
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
      settings: 5,
      weighins: 1
    });
  });

  it("imports a v1 backup by shimming missing cues and bumping the schema version", () => {
    const result = deserializeBackup(
      JSON.stringify({
        app: BACKUP_APP,
        schemaVersion: 1,
        exportedAt: "2026-07-06T10:30:00.000Z",
        sessions: [],
        rows: [],
        weighins: [],
        exercises: [
          {
            id: "goblet-squat",
            name: "Goblet squat",
            workout: "A",
            order: 1,
            sets: 3,
            repLow: 8,
            repHigh: 12,
            loadType: "weight",
            incrementKg: 2,
            note: "Move to two-DB front squat when one DB feels light"
          },
          {
            id: "custom-move",
            name: "Custom move",
            workout: "A",
            order: 2,
            sets: 3,
            repLow: 8,
            repHigh: 12,
            loadType: "weight",
            incrementKg: 2,
            note: ""
          }
        ],
        settings: [{ key: "schemaVersion", value: 1 }]
      })
    );

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.backup.schemaVersion).toBe(BACKUP_SCHEMA_VERSION);
      // Known seed id gets its default cues; unknown id falls back to an empty list.
      expect(result.backup.exercises[0].cues).toEqual([
        "Elbows inside knees at the bottom",
        "Heels planted, chest tall",
        "Control down, drive up"
      ]);
      expect(result.backup.exercises[1].cues).toEqual([]);
      // The ladder defs are injected on a pre-v3 import, and the stage defaults to
      // the first rung because the backup has no pull-up logs.
      expect(result.backup.exercises.map((exercise) => exercise.id)).toEqual([
        "goblet-squat",
        "custom-move",
        "dead-hang",
        "scap-pull",
        "pullup-negative"
      ]);
      expect(result.backup.settings).toEqual([
        { key: "schemaVersion", value: BACKUP_SCHEMA_VERSION },
        { key: "pullupStage", value: "dead-hang" }
      ]);
    }
  });

  it("round-trips v2 cues without change", () => {
    const result = deserializeBackup(serializeBackup(sourceData, exportedAt));

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.backup.exercises[0].cues).toEqual([
        "Shoulder blades pinned back",
        "Lower to mid-chest, full range"
      ]);
    }
  });

  it("rejects a v2 exercise whose cues are not an array of strings", () => {
    const invalidCues = validateBackupPayload({
      ...buildBackupPayload(sourceData, exportedAt),
      exercises: [{ ...sourceData.exercises[0], cues: ["ok", 3] }]
    });

    expect(invalidCues.ok).toBe(false);
    expect(invalidCues.ok ? "" : invalidCues.error).toBe("Exercise 1 has invalid form cues.");
  });

  it("seeds the ladder and defaults the stage to dead-hang for a v2 backup without pull-up logs", () => {
    const result = deserializeBackup(
      JSON.stringify({
        app: BACKUP_APP,
        schemaVersion: 2,
        exportedAt: "2026-07-06T10:30:00.000Z",
        sessions: [],
        rows: [],
        weighins: [],
        exercises: [],
        settings: [{ key: "schemaVersion", value: 2 }]
      })
    );

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.backup.exercises.map((exercise) => exercise.id)).toEqual([
        "dead-hang",
        "scap-pull",
        "pullup-negative"
      ]);
      expect(result.backup.settings).toEqual([
        { key: "schemaVersion", value: BACKUP_SCHEMA_VERSION },
        { key: "pullupStage", value: "dead-hang" }
      ]);
    }
  });

  it("defaults the stage to pullup for a v2 backup that already logged pull-ups", () => {
    const result = deserializeBackup(
      JSON.stringify({
        app: BACKUP_APP,
        schemaVersion: 2,
        exportedAt: "2026-07-06T10:30:00.000Z",
        sessions: [
          {
            id: 1,
            date: "2026-07-06",
            workout: "B",
            entries: [{ exerciseId: "pullup", sets: [{ weight: 2, reps: 5 }] }],
            startedAt: 1783338000000,
            xp: 100,
            progressionEvents: []
          }
        ],
        rows: [],
        weighins: [],
        exercises: [],
        settings: [{ key: "schemaVersion", value: 2 }]
      })
    );

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.backup.settings).toContainEqual({ key: "pullupStage", value: "pullup" });
    }
  });

  it("round-trips a v3 hold session without dropping seconds or the P workout", () => {
    const holdSource: BackupSourceData = {
      sessions: [
        {
          id: 9,
          date: "2026-07-09",
          workout: "P",
          entries: [
            {
              exerciseId: "dead-hang",
              sets: [
                { weight: 0, reps: 0, seconds: 30 },
                { weight: 0, reps: 0, seconds: 30 },
                { weight: 0, reps: 0, seconds: 30 }
              ]
            }
          ],
          startedAt: 1783510000000,
          finishedAt: 1783510300000,
          xp: 65,
          progressionEvents: ["dead-hang"]
        }
      ],
      rows: [],
      weighins: [],
      exercises: [
        {
          id: "dead-hang",
          name: "Dead hang",
          workout: "P",
          order: 1,
          sets: 3,
          repLow: 10,
          repHigh: 30,
          loadType: "body",
          measure: "seconds",
          incrementKg: 0,
          note: "",
          cues: []
        }
      ],
      settings: [
        { key: "xpTotal", value: 65 },
        { key: "schemaVersion", value: 3 },
        { key: "pullupStage", value: "scap-pull" }
      ]
    };
    const result = deserializeBackup(serializeBackup(holdSource, exportedAt));

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.backup).toEqual({
        app: BACKUP_APP,
        schemaVersion: BACKUP_SCHEMA_VERSION,
        exportedAt: "2026-07-06T10:30:00.000Z",
        ...holdSource
      });
    }
  });
});
