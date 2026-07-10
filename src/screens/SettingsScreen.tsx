import { useEffect, useMemo, useState } from "react";
import { AppState, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

import { useDialog } from "../components/ConfirmDialog";
import { Num } from "../components/Num";
import { Panel } from "../components/Panel";
import { Stepper } from "../components/Stepper";
import {
  getBackupSourceData,
  replaceAllDataWithBackup,
  updateExerciseDefs,
  wipeAllDataAndReseed,
  type PugIronDb
} from "../db";
import { formatWeight, labelTracking, localDateString } from "../lib/format";
import { hasNotificationPermission, requestNotificationPermission } from "../lib/notifications";
import { tokens } from "../lib/tokens";
import {
  deserializeBackup,
  serializeBackup,
  type BackupCounts,
  type BackupPayload
} from "../logic/backup";
import type { ReminderSettings } from "../logic/reminders";
import type { ExerciseDef, WorkoutSession } from "../types";

type BusyAction = "export" | "import" | "exercises" | "wipe";

type ImportPreview = {
  backup: BackupPayload;
  counts: BackupCounts;
  fileName: string;
};

export function SettingsScreen({
  db,
  exercises,
  onDataChanged,
  onUpdateReminderSettings,
  reminderSettings
}: {
  db: PugIronDb;
  exercises: ExerciseDef[];
  onDataChanged: () => Promise<void>;
  onUpdateReminderSettings: (settings: ReminderSettings) => Promise<void>;
  reminderSettings: ReminderSettings;
}) {
  const [busyAction, setBusyAction] = useState<BusyAction | null>(null);
  const [draftExercises, setDraftExercises] = useState(() => normalizeExerciseOrders(exercises));
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const { dialog, show } = useDialog();
  const info = (eyebrow: string, title: string, body: string) =>
    show({ eyebrow, title, body, buttons: [{ label: "OK", variant: "primary" }] });
  const groupedExercises = useMemo(
    () => ({
      A: draftExercises
        .filter((exercise) => exercise.workout === "A")
        .sort((first, second) => first.order - second.order),
      B: draftExercises
        .filter((exercise) => exercise.workout === "B")
        .sort((first, second) => first.order - second.order)
    }),
    [draftExercises]
  );

  useEffect(() => {
    setDraftExercises(normalizeExerciseOrders(exercises));
  }, [exercises]);

  async function exportBackup() {
    if (busyAction) {
      return;
    }

    setBusyAction("export");

    try {
      const cacheDirectory = FileSystem.cacheDirectory;

      if (!cacheDirectory) {
        info("backup", "Backup could not be exported.", "Temporary storage is not available.");
        return;
      }

      const sourceData = await getBackupSourceData(db);
      const fileName = `pug-iron-backup-${localDateString(new Date())}.json`;
      const uri = `${cacheDirectory}${fileName}`;

      await FileSystem.writeAsStringAsync(uri, serializeBackup(sourceData));

      if (!(await Sharing.isAvailableAsync())) {
        info("backup", "Backup file created.", "Sharing is not available on this device.");
        return;
      }

      await Sharing.shareAsync(uri, {
        UTI: "public.json",
        dialogTitle: "Export Pug Iron backup",
        mimeType: "application/json"
      });
    } catch (error: unknown) {
      console.error("Failed to export backup", error);
      info("backup", "Backup could not be exported.", "Give it another go.");
    } finally {
      setBusyAction(null);
    }
  }

  async function pickImportFile() {
    if (busyAction) {
      return;
    }

    setBusyAction("import");

    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
        type: "application/json"
      });

      if (result.canceled) {
        return;
      }

      const asset = result.assets[0];

      if (!asset) {
        info("backup", "Backup could not be read.", "No file was selected.");
        return;
      }

      const contents = await FileSystem.readAsStringAsync(asset.uri);
      const parsed = deserializeBackup(contents);

      if (!parsed.ok) {
        info("backup", "Import stopped.", parsed.error);
        return;
      }

      setImportPreview({
        backup: parsed.backup,
        counts: parsed.counts,
        fileName: asset.name
      });
    } catch (error: unknown) {
      console.error("Failed to read backup", error);
      info("backup", "Backup could not be read.", "Give it another go.");
    } finally {
      setBusyAction(null);
    }
  }

  async function confirmImport(backup: BackupPayload) {
    if (busyAction) {
      return;
    }

    setBusyAction("import");

    try {
      await replaceAllDataWithBackup(db, backup);
      setImportPreview(null);
      await onDataChanged();
      info("backup", "Backup imported.", "Current data now matches the backup.");
    } catch (error: unknown) {
      console.error("Failed to import backup", error);
      info("backup", "Import could not finish.", "Current data stayed in place.");
    } finally {
      setBusyAction(null);
    }
  }

  async function saveExerciseEdits() {
    if (busyAction) {
      return;
    }

    const normalized = normalizeExerciseOrders(
      draftExercises.map((exercise) => ({
        ...exercise,
        name: exercise.name.trim(),
        cues: exercise.cues.map((cue) => cue.trim()).filter((cue) => cue.length > 0)
      }))
    );

    if (normalized.some((exercise) => exercise.name.length === 0)) {
      info("exercise editor", "Exercise needs a name.", "Add a name before saving.");
      return;
    }

    if (normalized.some((exercise) => exercise.repHigh < exercise.repLow)) {
      info(
        "exercise editor",
        "Rep range needs a top value.",
        "Set the high rep value at or above the low value."
      );
      return;
    }

    setBusyAction("exercises");

    try {
      await updateExerciseDefs(db, normalized);
      setDraftExercises(normalized);
      await onDataChanged();
      info("exercise editor", "Exercises saved.", "Plan edits are ready.");
    } catch (error: unknown) {
      console.error("Failed to save exercises", error);
      info("exercise editor", "Exercises could not be saved.", "Give it another go.");
    } finally {
      setBusyAction(null);
    }
  }

  function updateExercise(exerciseId: string, updater: (exercise: ExerciseDef) => ExerciseDef) {
    setDraftExercises((current) =>
      current.map((exercise) => (exercise.id === exerciseId ? updater(exercise) : exercise))
    );
  }

  function moveExercise(exerciseId: string, direction: -1 | 1) {
    setDraftExercises((current) => {
      const exercise = current.find((item) => item.id === exerciseId);

      if (!exercise) {
        return current;
      }

      const group = current
        .filter((item) => item.workout === exercise.workout)
        .sort((first, second) => first.order - second.order);
      const groupIndex = group.findIndex((item) => item.id === exerciseId);
      const target = group[groupIndex + direction];

      if (!target) {
        return current;
      }

      const next = [...current];
      const currentIndex = next.findIndex((item) => item.id === exerciseId);
      const targetIndex = next.findIndex((item) => item.id === target.id);

      [next[currentIndex], next[targetIndex]] = [next[targetIndex], next[currentIndex]];

      return normalizeExerciseOrders(next);
    });
  }

  function confirmWipe() {
    if (busyAction) {
      return;
    }

    show({
      eyebrow: "danger zone",
      title: "Wipe all data?",
      body: "This removes workouts, rows, weigh-ins, and exercise edits.",
      buttons: [
        { label: "Keep data", variant: "secondary" },
        {
          label: "Continue",
          variant: "danger",
          onPress: () =>
            show({
              eyebrow: "danger zone",
              title: "Wipe now?",
              body: "The seed plan and settings will be restored.",
              buttons: [
                { label: "Keep data", variant: "secondary" },
                { label: "Wipe data", variant: "danger", onPress: () => void wipeData() }
              ]
            })
        }
      ]
    });
  }

  async function wipeData() {
    setBusyAction("wipe");

    try {
      await wipeAllDataAndReseed(db);
      setImportPreview(null);
      await onDataChanged();
      info("danger zone", "Data wiped.", "The seed plan is ready.");
    } catch (error: unknown) {
      console.error("Failed to wipe data", error);
      info("danger zone", "Data could not be wiped.", "Give it another go.");
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <>
      <ScrollView className="flex-1" contentContainerClassName="gap-4 pb-4">
      <Panel eyebrow="backup">
        <Text className="font-barlow-bold text-[32px] leading-[36px] text-text">Backup</Text>
        <View className="mt-5 gap-3">
          <ActionButton
            busy={busyAction === "export"}
            disabled={busyAction !== null}
            label="Export data"
            onPress={exportBackup}
          />
          <ActionButton
            busy={busyAction === "import"}
            disabled={busyAction !== null}
            label="Import data"
            onPress={pickImportFile}
            variant="secondary"
          />
        </View>

        {importPreview ? (
          <ImportPreviewPanel
            busy={busyAction === "import"}
            counts={importPreview.counts}
            fileName={importPreview.fileName}
            onCancel={() => setImportPreview(null)}
            onConfirm={() => void confirmImport(importPreview.backup)}
          />
        ) : null}
      </Panel>

      <Panel eyebrow="exercise editor">
        <Text className="font-barlow-bold text-[32px] leading-[36px] text-text">Exercises</Text>

        <View className="mt-5 gap-5">
          <WorkoutExerciseGroup
            exercises={groupedExercises.A}
            onMove={moveExercise}
            onUpdate={updateExercise}
            workout="A"
          />
          <WorkoutExerciseGroup
            exercises={groupedExercises.B}
            onMove={moveExercise}
            onUpdate={updateExercise}
            workout="B"
          />
        </View>

        <ActionButton
          busy={busyAction === "exercises"}
          className="mt-5"
          disabled={busyAction !== null}
          label="Save exercises"
          onPress={saveExerciseEdits}
        />
      </Panel>

      <ReminderPanel
        onInfo={info}
        onUpdate={onUpdateReminderSettings}
        settings={reminderSettings}
      />

      <Panel eyebrow="danger zone">
        <Text className="font-barlow-bold text-[32px] leading-[36px] text-text">Wipe data</Text>
        <ActionButton
          busy={busyAction === "wipe"}
          className="mt-5"
          disabled={busyAction !== null}
          label="Wipe all data"
          onPress={confirmWipe}
          variant="danger"
        />
      </Panel>
      </ScrollView>
      {dialog}
    </>
  );
}

const WEEKDAY_CHIPS: { day: number; label: string }[] = [
  { day: 1, label: "MON" },
  { day: 2, label: "TUE" },
  { day: 3, label: "WED" },
  { day: 4, label: "THU" },
  { day: 5, label: "FRI" },
  { day: 6, label: "SAT" },
  { day: 7, label: "SUN" }
];

function ReminderPanel({
  onInfo,
  onUpdate,
  settings
}: {
  onInfo: (eyebrow: string, title: string, body: string) => void;
  onUpdate: (settings: ReminderSettings) => Promise<void>;
  settings: ReminderSettings;
}) {
  const [permissionOk, setPermissionOk] = useState(true);

  useEffect(() => {
    if (!settings.enabled) {
      return;
    }

    void hasNotificationPermission().then(setPermissionOk);

    // Also re-check on foreground: the user may have flipped the permission in
    // Android settings and come straight back to this panel.
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void hasNotificationPermission().then(setPermissionOk);
      }
    });

    return () => subscription.remove();
  }, [settings.enabled]);

  async function toggleEnabled() {
    if (settings.enabled) {
      await onUpdate({ ...settings, enabled: false });
      return;
    }

    const granted = await requestNotificationPermission();

    if (!granted) {
      onInfo(
        "reminder",
        "Reminders need notification permission.",
        "Allow notifications for Pug Iron in Android settings, then try again."
      );
      return;
    }

    await onUpdate({ ...settings, enabled: true });
  }

  function toggleWeekday(day: number) {
    const weekdays = settings.weekdays.includes(day)
      ? settings.weekdays.filter((value) => value !== day)
      : [...settings.weekdays, day].sort((first, second) => first - second);

    void onUpdate({ ...settings, weekdays });
  }

  return (
    <Panel eyebrow="reminder">
      <Text className="font-barlow-bold text-[32px] leading-[36px] text-text">Reminder</Text>

      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: settings.enabled }}
        className="mt-5 min-h-[56px] flex-row items-center justify-between rounded-lg border border-line bg-panel-2 px-4"
        onPress={() => void toggleEnabled()}
      >
        <Text className="font-barlow-semibold text-[18px] leading-[22px] text-text">
          Session reminder
        </Text>
        <Text
          className={`font-mono-medium text-[13px] uppercase ${
            settings.enabled ? "text-mint" : "text-text-dim"
          }`}
          style={labelTracking}
        >
          {settings.enabled ? "on" : "off"}
        </Text>
      </Pressable>

      {settings.enabled ? (
        <View className="mt-5 gap-4">
          {permissionOk ? null : (
            <Text className="font-barlow text-[14px] leading-[18px] text-text-dim">
              Notifications are off in Android settings, so nothing will show up.
            </Text>
          )}
          <Stepper
            formatValue={(value) => String(value).padStart(2, "0")}
            label="Hour"
            min={0}
            onChange={(hour) =>
              void onUpdate({ ...settings, hour: Math.min(23, Math.round(hour)) })
            }
            step={1}
            value={settings.hour}
          />
          <Stepper
            formatValue={(value) => String(value).padStart(2, "0")}
            label="Minute"
            min={0}
            onChange={(minute) =>
              void onUpdate({ ...settings, minute: Math.min(55, Math.round(minute)) })
            }
            step={5}
            value={settings.minute}
          />

          <View>
            <Text
              className="mb-2 font-mono-medium text-[11px] uppercase text-text-dim"
              style={labelTracking}
            >
              days
            </Text>
            <View className="flex-row gap-1">
              {WEEKDAY_CHIPS.map(({ day, label }) => {
                const selected = settings.weekdays.includes(day);

                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    className={`min-h-[56px] flex-1 items-center justify-center rounded-lg ${
                      selected ? "bg-mint" : "border border-line bg-bg"
                    }`}
                    key={day}
                    onPress={() => toggleWeekday(day)}
                  >
                    <Text
                      className={`font-mono-medium text-[11px] uppercase ${
                        selected ? "text-bg" : "text-text-dim"
                      }`}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {settings.weekdays.length === 0 ? (
              <Text className="mt-2 font-barlow text-[14px] leading-[18px] text-text-dim">
                No days picked, so nothing is scheduled.
              </Text>
            ) : null}
          </View>

          <Text className="font-barlow text-[14px] leading-[18px] text-text-dim">
            One cue on chosen days. Ignoring it costs nothing.
          </Text>
        </View>
      ) : null}
    </Panel>
  );
}

function ImportPreviewPanel({
  busy,
  counts,
  fileName,
  onCancel,
  onConfirm
}: {
  busy: boolean;
  counts: BackupCounts;
  fileName: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <View className="mt-5 rounded-lg border border-line bg-panel-2 p-4">
      <Text className="font-barlow-semibold text-[20px] leading-[24px] text-text" numberOfLines={2}>
        {fileName}
      </Text>
      <View className="mt-4 flex-row flex-wrap gap-3">
        <CountReadout label="workouts" value={counts.sessions} />
        <CountReadout label="rows" value={counts.rows} />
        <CountReadout label="weigh-ins" value={counts.weighins} />
        <CountReadout label="exercises" value={counts.exercises} />
        <CountReadout label="settings" value={counts.settings} />
      </View>
      <Text className="mt-4 font-barlow-semibold text-[18px] leading-[22px] text-text">
        Replace current data?
      </Text>
      <View className="mt-4 flex-row gap-3">
        <ActionButton
          className="flex-1"
          disabled={busy}
          label="Keep current"
          onPress={onCancel}
          variant="secondary"
        />
        <ActionButton
          busy={busy}
          className="flex-1"
          disabled={busy}
          label="Replace"
          onPress={onConfirm}
          variant="danger"
        />
      </View>
    </View>
  );
}

function CountReadout({ label, value }: { label: string; value: number }) {
  return (
    <View className="min-h-[56px] min-w-[96px] justify-center rounded-lg border border-line bg-bg px-3">
      <Num weight="medium" className="text-[22px] leading-[26px] text-mint">
        {value}
      </Num>
      <Text className="font-mono-medium text-[11px] uppercase text-text-dim" style={labelTracking}>
        {label}
      </Text>
    </View>
  );
}

function WorkoutExerciseGroup({
  exercises,
  onMove,
  onUpdate,
  workout
}: {
  exercises: ExerciseDef[];
  onMove: (exerciseId: string, direction: -1 | 1) => void;
  onUpdate: (exerciseId: string, updater: (exercise: ExerciseDef) => ExerciseDef) => void;
  workout: WorkoutSession["workout"];
}) {
  return (
    <View>
      <View className="mb-3 flex-row items-center">
        <Text className="font-mono-medium text-[11px] uppercase text-text-dim" style={labelTracking}>
          workout {workout}
        </Text>
      </View>
      <View className="gap-4">
        {exercises.map((exercise, index) => (
          <EditableExerciseCard
            canMoveDown={index < exercises.length - 1}
            canMoveUp={index > 0}
            exercise={exercise}
            key={exercise.id}
            onMove={onMove}
            onUpdate={onUpdate}
          />
        ))}
      </View>
    </View>
  );
}

function EditableExerciseCard({
  canMoveDown,
  canMoveUp,
  exercise,
  onMove,
  onUpdate
}: {
  canMoveDown: boolean;
  canMoveUp: boolean;
  exercise: ExerciseDef;
  onMove: (exerciseId: string, direction: -1 | 1) => void;
  onUpdate: (exerciseId: string, updater: (exercise: ExerciseDef) => ExerciseDef) => void;
}) {
  return (
    <View className="gap-4 rounded-lg border border-line bg-panel-2 p-4">
      <View className="flex-row items-start gap-3">
        <TextInput
          accessibilityLabel={`${exercise.name} name`}
          className="min-h-[56px] flex-1 rounded-lg border border-line bg-bg px-4 py-3 font-barlow text-[18px] leading-[22px] text-text"
          onChangeText={(name) => onUpdate(exercise.id, (current) => ({ ...current, name }))}
          placeholderTextColor={tokens.colors.textDim}
          value={exercise.name}
        />
        <View className="min-h-[56px] min-w-[56px] items-center justify-center rounded-lg border border-line bg-bg">
          <Num weight="medium" className="text-[18px] text-mint">
            {exercise.order}
          </Num>
        </View>
      </View>

      <View className="flex-row gap-3">
        <MoveButton
          disabled={!canMoveUp}
          label="Up"
          onPress={() => onMove(exercise.id, -1)}
        />
        <MoveButton
          disabled={!canMoveDown}
          label="Down"
          onPress={() => onMove(exercise.id, 1)}
        />
      </View>

      <Stepper
        formatValue={(value) => String(value)}
        label="Sets"
        min={1}
        onChange={(sets) =>
          onUpdate(exercise.id, (current) => ({ ...current, sets: Math.round(sets) }))
        }
        step={1}
        value={exercise.sets}
      />
      <Stepper
        formatValue={(value) => String(value)}
        label="Rep low"
        min={1}
        onChange={(repLow) =>
          onUpdate(exercise.id, (current) => {
            const nextRepLow = Math.round(repLow);

            return {
              ...current,
              repHigh: Math.max(current.repHigh, nextRepLow),
              repLow: nextRepLow
            };
          })
        }
        step={1}
        value={exercise.repLow}
      />
      <Stepper
        formatValue={(value) => String(value)}
        label="Rep high"
        min={exercise.repLow}
        onChange={(repHigh) =>
          onUpdate(exercise.id, (current) => ({
            ...current,
            repHigh: Math.max(current.repLow, Math.round(repHigh))
          }))
        }
        step={1}
        value={exercise.repHigh}
      />
      <Stepper
        formatValue={formatWeight}
        label="Increment"
        min={0.5}
        onChange={(incrementKg) =>
          onUpdate(exercise.id, (current) => ({ ...current, incrementKg }))
        }
        step={0.5}
        unit="kg"
        value={exercise.incrementKg}
      />

      <CuesEditor exercise={exercise} onUpdate={onUpdate} />
    </View>
  );
}

function CuesEditor({
  exercise,
  onUpdate
}: {
  exercise: ExerciseDef;
  onUpdate: (exerciseId: string, updater: (exercise: ExerciseDef) => ExerciseDef) => void;
}) {
  return (
    <View className="gap-3">
      <Text className="font-mono-medium text-[11px] uppercase text-text-dim" style={labelTracking}>
        form cues
      </Text>
      {exercise.cues.map((cue, index) => (
        <View className="flex-row items-center gap-3" key={index}>
          <TextInput
            accessibilityLabel={`${exercise.name} cue ${index + 1}`}
            className="min-h-[56px] flex-1 rounded-lg border border-line bg-bg px-4 py-3 font-barlow text-[16px] leading-[22px] text-text"
            onChangeText={(text) =>
              onUpdate(exercise.id, (current) => ({
                ...current,
                cues: current.cues.map((value, valueIndex) => (valueIndex === index ? text : value))
              }))
            }
            placeholder="Short form cue"
            placeholderTextColor={tokens.colors.textDim}
            value={cue}
          />
          <Pressable
            accessibilityLabel={`Remove ${exercise.name} cue ${index + 1}`}
            accessibilityRole="button"
            className="min-h-[56px] min-w-[56px] items-center justify-center rounded-lg border border-line bg-bg"
            onPress={() =>
              onUpdate(exercise.id, (current) => ({
                ...current,
                cues: current.cues.filter((_, valueIndex) => valueIndex !== index)
              }))
            }
          >
            <Text className="font-barlow-bold text-[18px] text-danger">✕</Text>
          </Pressable>
        </View>
      ))}
      <Pressable
        accessibilityRole="button"
        className="min-h-[56px] items-center justify-center rounded-lg border border-line bg-bg px-4"
        onPress={() =>
          onUpdate(exercise.id, (current) => ({ ...current, cues: [...current.cues, ""] }))
        }
      >
        <Text className="font-barlow-bold text-[16px] uppercase text-text">Add cue</Text>
      </Pressable>
    </View>
  );
}

function MoveButton({
  disabled,
  label,
  onPress
}: {
  disabled: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      className={`min-h-[56px] flex-1 items-center justify-center rounded-lg border border-line bg-bg px-4 ${
        disabled ? "opacity-40" : ""
      }`}
      disabled={disabled}
      onPress={onPress}
    >
      <Text className="font-barlow-bold text-[16px] uppercase text-text">{label}</Text>
    </Pressable>
  );
}

function ActionButton({
  busy,
  className,
  disabled,
  label,
  onPress,
  variant = "primary"
}: {
  busy?: boolean;
  className?: string;
  disabled?: boolean;
  label: string;
  onPress: () => void;
  variant?: "danger" | "primary" | "secondary";
}) {
  const buttonClass =
    variant === "primary"
      ? "bg-mint"
      : variant === "danger"
        ? "border border-danger bg-panel-2"
        : "border border-line bg-panel-2";
  const textClass =
    variant === "primary" ? "text-bg" : variant === "danger" ? "text-danger" : "text-text";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      className={`min-h-[56px] items-center justify-center rounded-lg px-5 ${
        disabled ? "opacity-50" : ""
      } ${buttonClass} ${className ?? ""}`}
      disabled={disabled}
      onPress={onPress}
    >
      <Text className={`font-barlow-bold text-[18px] uppercase ${textClass}`}>
        {busy ? "Working" : label}
      </Text>
    </Pressable>
  );
}

function normalizeExerciseOrders(exercises: ExerciseDef[]): ExerciseDef[] {
  const nextOrder: Record<WorkoutSession["workout"], number> = { A: 0, B: 0, P: 0 };

  return exercises.map((exercise) => ({
    ...exercise,
    order: (nextOrder[exercise.workout] += 1)
  }));
}
