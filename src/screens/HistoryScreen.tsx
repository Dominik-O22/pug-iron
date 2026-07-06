import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";

import { Num } from "../components/Num";
import { Panel } from "../components/Panel";
import { Stepper } from "../components/Stepper";
import { dateParts, formatVolume, formatWeight, labelTracking, localDateString } from "../lib/format";
import { countLoggedSets, groupHistoryByWeek, type HistoryEntry } from "../lib/session";
import {
  buildMonthCalendarStrip,
  classifyHabitFloor,
  monthKeyFromDate,
  type HabitFloor
} from "../logic/history";
import { calculateSessionVolume } from "../logic/workouts";
import type { ExerciseDef, ExerciseLog, RowSession, SetEntry, WeighIn, WorkoutSession } from "../types";

type HistorySelection =
  | { item: WorkoutSession; kind: "workout" }
  | { item: RowSession; kind: "rower" }
  | { item: WeighIn; kind: "weigh-in" };

export function HistoryScreen({
  exercises,
  onDeleteRowSession,
  onDeleteWeighIn,
  onDeleteWorkoutSession,
  onUpdateSession,
  rowSessions,
  sessions,
  weighIns
}: {
  exercises: ExerciseDef[];
  onDeleteRowSession: (rowSessionId: number) => Promise<void>;
  onDeleteWeighIn: (weighInId: number) => Promise<void>;
  onDeleteWorkoutSession: (sessionId: number) => Promise<void>;
  onUpdateSession: (session: WorkoutSession & { id: number }) => Promise<void>;
  rowSessions: RowSession[];
  sessions: WorkoutSession[];
  weighIns: WeighIn[];
}) {
  const [selectedEntry, setSelectedEntry] = useState<HistorySelection | null>(null);
  const [editingSession, setEditingSession] = useState<WorkoutSession | null>(null);
  const groups = useMemo(
    () => groupHistoryByWeek({ rowSessions, sessions, weighIns }),
    [rowSessions, sessions, weighIns]
  );
  const calendarMonth = monthKeyFromDate(localDateString(new Date()));
  const calendarDays = useMemo(
    () => buildMonthCalendarStrip({ month: calendarMonth, rowSessions, sessions, weighIns }),
    [calendarMonth, rowSessions, sessions, weighIns]
  );
  const exerciseById = useMemo(
    () => new Map(exercises.map((exercise) => [exercise.id, exercise])),
    [exercises]
  );

  if (editingSession) {
    return (
      <SessionEditor
        exerciseById={exerciseById}
        onCancel={() => setEditingSession(null)}
        onSave={async (updatedSession) => {
          await onUpdateSession(updatedSession);
          setSelectedEntry({ item: updatedSession, kind: "workout" });
          setEditingSession(null);
        }}
        session={editingSession}
      />
    );
  }

  if (selectedEntry) {
    return (
      <HistoryDetail
        entry={selectedEntry}
        exerciseById={exerciseById}
        onBack={() => setSelectedEntry(null)}
        onDeleteRowSession={async (rowSessionId) => {
          await onDeleteRowSession(rowSessionId);
          setSelectedEntry(null);
        }}
        onDeleteWeighIn={async (weighInId) => {
          await onDeleteWeighIn(weighInId);
          setSelectedEntry(null);
        }}
        onDeleteWorkoutSession={async (sessionId) => {
          await onDeleteWorkoutSession(sessionId);
          setSelectedEntry(null);
        }}
        onEditWorkout={(session) => setEditingSession(session)}
      />
    );
  }

  if (sessions.length === 0 && rowSessions.length === 0 && weighIns.length === 0) {
    return (
      <Panel eyebrow="history log" className="min-h-[180px]">
        <Text className="font-barlow-semibold text-[24px] leading-[29px] text-text">
          Workouts, rows, and weigh-ins appear here by week.
        </Text>
        <Text className="mt-2 font-barlow text-[16px] leading-[22px] text-text-dim">
          Each row will show the date and the main numbers from that entry.
        </Text>
      </Panel>
    );
  }

  return (
    <ScrollView className="flex-1" contentContainerClassName="gap-4 pb-4">
      <CalendarStrip days={calendarDays} month={calendarMonth} />

      {groups.map((group) => {
        const liftingSessionCount = group.entries.filter((entry) => entry.kind === "workout").length;

        return (
          <View className="gap-3" key={group.weekStart}>
            <WeekHeader
              habitFloor={classifyHabitFloor(liftingSessionCount)}
              sessionCount={liftingSessionCount}
              weekStart={group.weekStart}
            />
            {group.entries.map((entry) => (
              <HistoryEntryCard
                entry={entry}
                key={`${entry.kind}-${entry.sortValue}`}
                onSelect={() => setSelectedEntry(selectionFromHistoryEntry(entry))}
              />
            ))}
          </View>
        );
      })}
    </ScrollView>
  );
}

function selectionFromHistoryEntry(entry: HistoryEntry): HistorySelection {
  if (entry.kind === "workout") {
    return { item: entry.item, kind: "workout" };
  }

  if (entry.kind === "rower") {
    return { item: entry.item, kind: "rower" };
  }

  return { item: entry.item, kind: "weigh-in" };
}

function CalendarStrip({ days, month }: { days: ReturnType<typeof buildMonthCalendarStrip>; month: string }) {
  const monthParts = dateParts(`${month}-01`);

  return (
    <Panel eyebrow="month strip">
      <View className="mb-1 flex-row items-center">
        <Text className="font-barlow-bold text-[24px] uppercase leading-[28px] text-text">
          {monthParts.month}{" "}
        </Text>
        <Num weight="medium" className="text-[24px] leading-[28px] text-text">
          {monthParts.year}
        </Num>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View className="mt-3 flex-row gap-2">
          {days.map((day) => {
            const parts = dateParts(day.date);

            return (
              <View
                className={`min-w-[42px] items-center rounded-lg border px-2 py-2 ${
                  day.active ? "border-mint bg-petrol" : "border-line bg-panel-2"
                }`}
                key={day.date}
              >
                <Text className="font-mono-medium text-[11px] uppercase text-text-dim">
                  {parts.weekday.slice(0, 1)}
                </Text>
                <Num weight="medium" className={day.active ? "text-[16px] text-mint" : "text-[16px] text-text"}>
                  {day.dayOfMonth}
                </Num>
                <View className={`mt-1 h-2 w-2 rounded-full ${day.active ? "bg-mint" : "bg-transparent"}`} />
              </View>
            );
          })}
        </View>
      </ScrollView>
    </Panel>
  );
}

function WeekHeader({
  habitFloor,
  sessionCount,
  weekStart
}: {
  habitFloor: HabitFloor;
  sessionCount: number;
  weekStart: string;
}) {
  const weekParts = dateParts(weekStart);
  const sessionTextClass =
    habitFloor === "good" ? "text-mint" : habitFloor === "single" ? "text-text-dim" : "text-text";
  const sessionChipClass = habitFloor === "good" ? "bg-petrol" : "bg-transparent";

  return (
    <View className="flex-row items-center justify-between gap-4">
      <View className="flex-row items-center">
        <Text className="font-mono-medium text-[11px] uppercase text-text-dim" style={labelTracking}>
          week of {weekParts.month}{" "}
        </Text>
        <Num className="text-[11px] uppercase text-text-dim">{weekParts.day}</Num>
        <Text className="font-mono-medium text-[11px] uppercase text-text-dim" style={labelTracking}>
          {", "}
        </Text>
        <Num className="text-[11px] uppercase text-text-dim">{weekParts.year}</Num>
      </View>
      <View className={`rounded-lg px-3 py-2 ${sessionChipClass}`}>
        <View className="flex-row items-center">
          <Num weight="medium" className={`text-[13px] ${sessionTextClass}`}>
            {sessionCount}
          </Num>
          <Text className={`font-barlow text-[13px] ${sessionTextClass}`}>
            {sessionCount === 1 ? " session" : " sessions"}
          </Text>
        </View>
      </View>
    </View>
  );
}

function HistoryEntryCard({ entry, onSelect }: { entry: HistoryEntry; onSelect: () => void }) {
  if (entry.kind === "rower") {
    return (
      <Pressable accessibilityRole="button" onPress={onSelect}>
        <HistoryRowerCard rowSession={entry.item} />
      </Pressable>
    );
  }

  if (entry.kind === "weigh-in") {
    return (
      <Pressable accessibilityRole="button" onPress={onSelect}>
        <HistoryWeighInCard weighIn={entry.item} />
      </Pressable>
    );
  }

  return (
    <Pressable accessibilityRole="button" onPress={onSelect}>
      <HistorySessionCard session={entry.item} />
    </Pressable>
  );
}

function HistorySessionCard({ session }: { session: WorkoutSession }) {
  const parts = dateParts(session.date);
  const volume = calculateSessionVolume(session.entries);
  const setCount = countLoggedSets(session.entries);

  return (
    <View className="rounded-xl border border-line bg-panel p-5">
      <View className="flex-row items-center justify-between gap-4">
        <View className="min-h-[56px] min-w-[56px] items-center justify-center rounded-lg bg-petrol">
          <Text className="font-barlow-bold text-[24px] text-mint">{session.workout}</Text>
        </View>
        <View className="flex-1">
          <DateLine parts={parts} />
          <View className="mt-2 flex-row flex-wrap items-center gap-3">
            <Metric value={formatVolume(volume)} unit="kg" />
            <Metric value={setCount} unit={setCount === 1 ? "set" : "sets"} />
            {session.progressionEvents.length > 0 ? (
              <Metric
                color="amber"
                value={`+${session.progressionEvents.length}`}
                unit="progression"
              />
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}

function HistoryRowerCard({ rowSession }: { rowSession: RowSession }) {
  const parts = dateParts(rowSession.date);

  return (
    <View className="rounded-xl border border-line bg-panel p-5">
      <View className="flex-row items-center justify-between gap-4">
        <View className="min-h-[56px] min-w-[56px] items-center justify-center rounded-lg bg-panel-2">
          <Text className="font-barlow-bold text-[18px] uppercase text-mint">row</Text>
        </View>
        <View className="flex-1">
          <DateLine parts={parts} />
          <View className="mt-2 flex-row flex-wrap items-center gap-3">
            <Metric value={formatVolume(rowSession.minutes)} unit="min" />
            {typeof rowSession.meters === "number" ? <Metric value={rowSession.meters} unit="m" /> : null}
            <Metric value={`+${rowSession.xp}`} unit="XP" />
          </View>
        </View>
      </View>
    </View>
  );
}

function HistoryWeighInCard({ weighIn }: { weighIn: WeighIn }) {
  const parts = dateParts(weighIn.date);

  return (
    <View className="rounded-xl border border-line bg-panel p-5">
      <View className="flex-row items-center justify-between gap-4">
        <View className="min-h-[56px] min-w-[56px] items-center justify-center rounded-lg bg-panel-2">
          <Text className="font-barlow-bold text-[18px] uppercase text-mint">kg</Text>
        </View>
        <View className="flex-1">
          <DateLine parts={parts} />
          <View className="mt-2 flex-row flex-wrap items-center gap-3">
            <Metric value={formatWeight(weighIn.kg)} unit="kg" />
            {weighIn.xp > 0 ? <Metric value={`+${weighIn.xp}`} unit="XP" /> : null}
          </View>
        </View>
      </View>
    </View>
  );
}

function HistoryDetail({
  entry,
  exerciseById,
  onBack,
  onDeleteRowSession,
  onDeleteWeighIn,
  onDeleteWorkoutSession,
  onEditWorkout
}: {
  entry: HistorySelection;
  exerciseById: Map<string, ExerciseDef>;
  onBack: () => void;
  onDeleteRowSession: (rowSessionId: number) => Promise<void>;
  onDeleteWeighIn: (weighInId: number) => Promise<void>;
  onDeleteWorkoutSession: (sessionId: number) => Promise<void>;
  onEditWorkout: (session: WorkoutSession) => void;
}) {
  if (entry.kind === "workout") {
    return (
      <WorkoutSessionDetail
        exerciseById={exerciseById}
        onBack={onBack}
        onDelete={onDeleteWorkoutSession}
        onEdit={() => onEditWorkout(entry.item)}
        session={entry.item}
      />
    );
  }

  if (entry.kind === "rower") {
    return (
      <SimpleHistoryDetail
        badge="row"
        date={entry.item.date}
        metrics={[
          { unit: "min", value: formatVolume(entry.item.minutes) },
          ...(typeof entry.item.meters === "number" ? [{ unit: "m", value: entry.item.meters }] : []),
          { unit: "XP", value: `+${entry.item.xp}` }
        ]}
        onBack={onBack}
        onDelete={() => confirmSimpleDelete("Delete this row?", onDeleteRowSession, entry.item.id)}
        title="Rower session"
      />
    );
  }

  return (
    <SimpleHistoryDetail
      badge="kg"
      date={entry.item.date}
      metrics={[
        { unit: "kg", value: formatWeight(entry.item.kg) },
        ...(entry.item.xp > 0 ? [{ unit: "XP", value: `+${entry.item.xp}` }] : [])
      ]}
      onBack={onBack}
      onDelete={() => confirmSimpleDelete("Delete this weigh-in?", onDeleteWeighIn, entry.item.id)}
      title="Weigh-in"
    />
  );
}

function WorkoutSessionDetail({
  exerciseById,
  onBack,
  onDelete,
  onEdit,
  session
}: {
  exerciseById: Map<string, ExerciseDef>;
  onBack: () => void;
  onDelete: (sessionId: number) => Promise<void>;
  onEdit: () => void;
  session: WorkoutSession;
}) {
  const parts = dateParts(session.date);
  const volume = calculateSessionVolume(session.entries);
  const progressionNames = session.progressionEvents.map(
    (exerciseId) => exerciseById.get(exerciseId)?.name ?? exerciseId
  );

  return (
    <ScrollView className="flex-1" contentContainerClassName="gap-4 pb-4">
      <BackButton onPress={onBack} />

      <Panel eyebrow="workout detail">
        <Text className="font-barlow-bold text-[32px] uppercase leading-[36px] text-text">
          Workout {session.workout}
        </Text>
        <DateLine className="mt-2" parts={parts} />
        <View className="mt-5 gap-3">
          <DetailMetric label="volume" unit="kg" value={formatVolume(volume)} />
          <DetailMetric label="sets" value={countLoggedSets(session.entries)} />
          <DetailMetric label="xp" value={`+${session.xp}`} />
        </View>
        <Text className="mt-4 font-barlow text-[16px] leading-[22px] text-text-dim">
          XP stays as earned when details change.
        </Text>
      </Panel>

      <Panel eyebrow="sets">
        <View className="gap-4">
          {session.entries.map((entry) => (
            <ExerciseSetReadout
              entry={entry}
              exercise={exerciseById.get(entry.exerciseId)}
              key={entry.exerciseId}
            />
          ))}
        </View>
      </Panel>

      {progressionNames.length > 0 ? (
        <Panel eyebrow="progression events">
          <View className="gap-2">
            {progressionNames.map((name) => (
              <Text className="font-barlow-semibold text-[18px] leading-[22px] text-amber" key={name}>
                {name}
              </Text>
            ))}
          </View>
        </Panel>
      ) : null}

      <View className="flex-row gap-3">
        <Pressable
          accessibilityRole="button"
          className="min-h-[56px] flex-1 items-center justify-center rounded-lg border border-line bg-panel-2 px-4"
          onPress={onEdit}
        >
          <Text className="font-barlow-bold text-[16px] uppercase text-text">Edit</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          className="min-h-[56px] flex-1 items-center justify-center rounded-lg border border-danger bg-panel-2 px-4"
          onPress={() => confirmWorkoutDelete(session.id, onDelete)}
        >
          <Text className="font-barlow-bold text-[16px] uppercase text-danger">Delete</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function SimpleHistoryDetail({
  badge,
  date,
  metrics,
  onBack,
  onDelete,
  title
}: {
  badge: string;
  date: string;
  metrics: Array<{ unit: string; value: number | string }>;
  onBack: () => void;
  onDelete: () => void;
  title: string;
}) {
  const parts = dateParts(date);

  return (
    <ScrollView className="flex-1" contentContainerClassName="gap-4 pb-4">
      <BackButton onPress={onBack} />
      <Panel eyebrow="entry detail">
        <View className="flex-row items-start justify-between gap-4">
          <View className="flex-1">
            <Text className="font-barlow-bold text-[32px] leading-[36px] text-text">{title}</Text>
            <DateLine className="mt-2" parts={parts} />
          </View>
          <View className="min-h-[56px] min-w-[56px] items-center justify-center rounded-lg bg-panel-2">
            <Text className="font-barlow-bold text-[18px] uppercase text-mint">{badge}</Text>
          </View>
        </View>
        <View className="mt-5 gap-3">
          {metrics.map((metric) => (
            <DetailMetric key={`${metric.unit}-${metric.value}`} label={metric.unit} value={metric.value} />
          ))}
        </View>
        <Text className="mt-4 font-barlow text-[16px] leading-[22px] text-text-dim">
          XP stays as earned.
        </Text>
      </Panel>
      <Pressable
        accessibilityRole="button"
        className="min-h-[56px] items-center justify-center rounded-lg border border-danger bg-panel-2 px-4"
        onPress={onDelete}
      >
        <Text className="font-barlow-bold text-[16px] uppercase text-danger">Delete</Text>
      </Pressable>
    </ScrollView>
  );
}

function SessionEditor({
  exerciseById,
  onCancel,
  onSave,
  session
}: {
  exerciseById: Map<string, ExerciseDef>;
  onCancel: () => void;
  onSave: (session: WorkoutSession & { id: number }) => Promise<void>;
  session: WorkoutSession;
}) {
  const [entries, setEntries] = useState<ExerciseLog[]>(session.entries);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (typeof session.id !== "number" || saving) {
      return;
    }

    setSaving(true);

    try {
      await onSave({ ...session, entries, id: session.id });
    } catch (error: unknown) {
      console.error("Failed to update workout session", error);
      Alert.alert("Workout could not be updated.", "Try again.");
      setSaving(false);
    }
  }

  function updateSet(entryIndex: number, setIndex: number, nextSet: Partial<SetEntry>) {
    setEntries((current) =>
      current.map((entry, currentEntryIndex) => {
        if (currentEntryIndex !== entryIndex) {
          return entry;
        }

        return {
          ...entry,
          sets: entry.sets.map((set, currentSetIndex) =>
            currentSetIndex === setIndex ? { ...set, ...nextSet } : set
          )
        };
      })
    );
  }

  return (
    <ScrollView className="flex-1" contentContainerClassName="gap-4 pb-4">
      <BackButton onPress={onCancel} />
      <Panel eyebrow="edit workout">
        <Text className="font-barlow-bold text-[32px] uppercase leading-[36px] text-text">
          Workout {session.workout}
        </Text>
        <Text className="mt-2 font-barlow text-[16px] leading-[22px] text-text-dim">
          Adjust the saved sets. XP stays as earned.
        </Text>
      </Panel>

      {entries.map((entry, entryIndex) => {
        const exercise = exerciseById.get(entry.exerciseId);

        return (
          <Panel eyebrow={exercise?.loadType === "assist" ? "assist sets" : "weight sets"} key={entry.exerciseId}>
            <Text className="font-barlow-bold text-[24px] leading-[28px] text-text">
              {exercise?.name ?? entry.exerciseId}
            </Text>
            <View className="mt-4 gap-4">
              {entry.sets.map((set, setIndex) => (
                <View className="gap-4 rounded-lg border border-line bg-panel-2 p-4" key={setIndex}>
                  <View className="flex-row items-center">
                    <Text className="font-barlow-semibold text-[18px] text-text">Set </Text>
                    <Num weight="medium" className="text-[18px] text-text">
                      {setIndex + 1}
                    </Num>
                  </View>
                  <Stepper
                    formatValue={formatWeight}
                    label={exercise?.loadType === "assist" ? "Assist level" : "Weight"}
                    min={0}
                    onChange={(weight) => updateSet(entryIndex, setIndex, { weight })}
                    step={exercise?.loadType === "assist" ? 1 : 0.5}
                    unit={exercise?.loadType === "assist" ? "band" : "kg"}
                    value={set.weight}
                  />
                  <Stepper
                    formatValue={(value) => String(value)}
                    label="Reps"
                    min={0}
                    onChange={(reps) => updateSet(entryIndex, setIndex, { reps })}
                    step={1}
                    value={set.reps}
                  />
                </View>
              ))}
            </View>
          </Panel>
        );
      })}

      <View className="flex-row gap-3">
        <Pressable
          accessibilityRole="button"
          className="min-h-[56px] flex-1 items-center justify-center rounded-lg border border-line bg-panel-2 px-4"
          disabled={saving}
          onPress={onCancel}
        >
          <Text className="font-barlow-bold text-[16px] uppercase text-text">Cancel</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: saving || typeof session.id !== "number" }}
          className={`min-h-[56px] flex-1 items-center justify-center rounded-lg bg-mint px-4 ${
            saving || typeof session.id !== "number" ? "opacity-50" : ""
          }`}
          disabled={saving || typeof session.id !== "number"}
          onPress={save}
        >
          <Text className="font-barlow-bold text-[16px] uppercase text-bg">
            {saving ? "Saving" : "Save changes"}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function ExerciseSetReadout({
  entry,
  exercise
}: {
  entry: ExerciseLog;
  exercise?: ExerciseDef;
}) {
  return (
    <View className="rounded-lg border border-line bg-panel-2 p-4">
      <Text className="font-barlow-semibold text-[20px] leading-[24px] text-text">
        {exercise?.name ?? entry.exerciseId}
      </Text>
      <View className="mt-3 gap-2">
        {entry.sets.map((set, index) => (
          <View className="flex-row items-center justify-between gap-4" key={index}>
            <View className="flex-row items-center">
              <Text className="font-barlow text-[16px] text-text-dim">Set </Text>
              <Num className="text-[16px] text-text-dim">{index + 1}</Num>
            </View>
            <View className="flex-row items-center">
              <Num weight="medium" className="text-[16px] text-mint">
                {formatWeight(set.weight)}
              </Num>
              <Text className="ml-1 font-barlow text-[16px] text-text-dim">
                {exercise?.loadType === "assist" ? "band" : "kg"}
              </Text>
              <Text className="mx-2 font-barlow text-[16px] text-text-dim">x</Text>
              <Num weight="medium" className="text-[16px] text-mint">
                {set.reps}
              </Num>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function DateLine({
  className,
  parts
}: {
  className?: string;
  parts: ReturnType<typeof dateParts>;
}) {
  return (
    <View className={`flex-row items-center ${className ?? ""}`}>
      <Text className="font-barlow-semibold text-[18px] text-text">
        {parts.weekday}, {parts.month}{" "}
      </Text>
      <Num weight="medium" className="text-[18px] text-text">
        {parts.day}
      </Num>
      <Text className="font-barlow-semibold text-[18px] text-text">{", "}</Text>
      <Num weight="medium" className="text-[18px] text-text">
        {parts.year}
      </Num>
    </View>
  );
}

function Metric({
  color = "mint",
  unit,
  value
}: {
  color?: "amber" | "mint";
  unit: string;
  value: number | string;
}) {
  const valueClass = color === "amber" ? "text-amber" : "text-mint";

  return (
    <View className="flex-row items-center">
      <Num weight="medium" className={`text-[16px] ${valueClass}`}>
        {value}
      </Num>
      <Text className="font-barlow text-[16px] text-text-dim"> {unit}</Text>
    </View>
  );
}

function DetailMetric({
  label,
  unit,
  value
}: {
  label: string;
  unit?: string;
  value: number | string;
}) {
  return (
    <View className="rounded-lg border border-line bg-panel-2 p-4">
      <Text className="font-mono-medium text-[11px] uppercase text-text-dim" style={labelTracking}>
        {label}
      </Text>
      <View className="mt-1 flex-row items-baseline">
        <Num weight="medium" className="text-[28px] leading-[34px] text-mint">
          {value}
        </Num>
        {unit ? <Text className="ml-2 font-barlow text-[16px] text-text-dim">{unit}</Text> : null}
      </View>
    </View>
  );
}

function BackButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      className="min-h-[56px] justify-center rounded-lg border border-line bg-panel-2 px-4"
      onPress={onPress}
    >
      <Text className="font-barlow-bold text-[16px] uppercase text-text">Back</Text>
    </Pressable>
  );
}

function confirmWorkoutDelete(
  sessionId: number | undefined,
  onDelete: (sessionId: number) => Promise<void>
) {
  if (typeof sessionId !== "number") {
    return;
  }

  Alert.alert("Delete this workout?", "This removes the session entry. XP stays as earned.", [
    { text: "Keep", style: "cancel" },
    {
      onPress: () =>
        Alert.alert("Delete workout now?", "The entry will be removed from History.", [
          { text: "Keep", style: "cancel" },
          { text: "Delete", style: "destructive", onPress: () => void onDelete(sessionId) }
        ]),
      style: "destructive",
      text: "Continue"
    }
  ]);
}

function confirmSimpleDelete(
  title: string,
  onDelete: (id: number) => Promise<void>,
  id: number | undefined
) {
  if (typeof id !== "number") {
    return;
  }

  Alert.alert(title, "The entry will be removed from History. XP stays as earned.", [
    { text: "Keep", style: "cancel" },
    { text: "Delete", style: "destructive", onPress: () => void onDelete(id) }
  ]);
}
