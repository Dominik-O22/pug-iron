import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useKeepAwake } from "expo-keep-awake";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";

import { useDialog } from "../components/ConfirmDialog";
import { InstructionLine } from "../components/InstructionLine";
import { Num } from "../components/Num";
import { Panel } from "../components/Panel";
import { RestTimer } from "../components/RestTimer";
import { Stepper } from "../components/Stepper";
import {
  abbreviateExerciseName,
  formatVolume,
  formatWeight,
  labelTracking,
  localDateString
} from "../lib/format";
import {
  buildLoggedEntries,
  countLoggedSets,
  type DraftExercise,
  type RestState
} from "../lib/session";
import {
  detectProgressionEvents,
  deriveProgressionTarget,
  type ProgressionEventTarget
} from "../logic/progression";
import { calculateSessionVolume } from "../logic/workouts";
import { XP_EVENTS } from "../logic/xp";
import type { ExerciseDef, ExerciseLog, SetEntry, WorkoutSession } from "../types";

export type LoggerState = {
  startedAt: number;
  workout: WorkoutSession["workout"];
};

type ProgressionSummaryEvent = {
  exerciseName: string;
  target: ProgressionEventTarget;
};

const REST_DURATION_MS = 90000;
const PROGRESSION_MOMENT_MS = 500;

export function WorkoutLoggerModal({
  exercises,
  latestLogs,
  loggerState,
  onClose,
  onSave
}: {
  exercises: ExerciseDef[];
  latestLogs: Record<string, ExerciseLog>;
  loggerState: LoggerState;
  onClose: () => void;
  onSave: (session: WorkoutSession) => Promise<void>;
}) {
  useKeepAwake("pug-iron-workout-logger");

  const [draftExercises, setDraftExercises] = useState<DraftExercise[]>(() =>
    exercises.map((exercise) => {
      const progressionTarget = deriveProgressionTarget(exercise, latestLogs[exercise.id]);

      return {
        exercise,
        hasHistory: progressionTarget.hasHistory,
        instruction: progressionTarget.instruction,
        progressionTarget,
        sets: progressionTarget.sets.map((set) => ({
          weight: set.weight ?? 0,
          reps: set.reps,
          logged: false
        }))
      };
    })
  );
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [setIndexes, setSetIndexes] = useState(() => exercises.map(() => 0));
  const [mode, setMode] = useState<"logging" | "summary" | "saving">("logging");
  const [rest, setRest] = useState<RestState | null>(null);
  const [formOpen, setFormOpen] = useState<boolean[]>(() => exercises.map(() => false));
  const savingRef = useRef(false);
  const { dialog, show } = useDialog();
  const warmupExercises = useMemo(() => exercises.slice(0, 2), [exercises]);
  const loggedEntries = useMemo(() => buildLoggedEntries(draftExercises), [draftExercises]);
  const loggedSetCount = useMemo(() => countLoggedSets(loggedEntries), [loggedEntries]);
  const progressionEvents = useMemo(
    () => detectProgressionEvents(exercises, latestLogs, loggedEntries),
    [exercises, latestLogs, loggedEntries]
  );
  const progressionSummaryEvents = useMemo(() => {
    const eventIds = new Set(progressionEvents);

    return draftExercises.flatMap<ProgressionSummaryEvent>((draft) => {
      const eventTarget = draft.progressionTarget.progressionEvent;

      if (!eventIds.has(draft.exercise.id) || !eventTarget) {
        return [];
      }

      return [{ exerciseName: draft.exercise.name, target: eventTarget }];
    });
  }, [draftExercises, progressionEvents]);
  const xpAwarded = XP_EVENTS.workoutSessionSaved + progressionEvents.length * XP_EVENTS.progressionEvent;
  const activeDraft = draftExercises[exerciseIndex];
  const activeSetIndex = Math.min(setIndexes[exerciseIndex] ?? 0, activeDraft.sets.length - 1);
  const activeSet = activeDraft.sets[activeSetIndex];

  const updateActiveSet = useCallback(
    (nextSet: Partial<SetEntry>) => {
      setDraftExercises((current) =>
        current.map((draft, draftIndex) => {
          if (draftIndex !== exerciseIndex) {
            return draft;
          }

          return {
            ...draft,
            sets: draft.sets.map((set, setIndex) =>
              setIndex === activeSetIndex ? { ...set, ...nextSet } : set
            )
          };
        })
      );
    },
    [activeSetIndex, exerciseIndex]
  );

  const logActiveSet = useCallback(() => {
    const updatedSets = activeDraft.sets.map((set, setIndex) =>
      setIndex === activeSetIndex ? { ...set, logged: true } : set
    );
    const nextSetIndex = updatedSets.findIndex((set) => !set.logged);

    setDraftExercises((current) =>
      current.map((draft, draftIndex) =>
        draftIndex === exerciseIndex ? { ...draft, sets: updatedSets } : draft
      )
    );
    setRest({ startedAt: Date.now(), durationMs: REST_DURATION_MS });

    if (nextSetIndex >= 0) {
      setSetIndexes((current) =>
        current.map((setIndex, index) => (index === exerciseIndex ? nextSetIndex : setIndex))
      );
      return;
    }

    if (exerciseIndex < draftExercises.length - 1) {
      setExerciseIndex((current) => current + 1);
    }
  }, [activeDraft.sets, activeSetIndex, draftExercises.length, exerciseIndex]);

  const confirmDiscard = useCallback(() => {
    // A save in flight is already committing; don't offer to walk away from it.
    if (savingRef.current) {
      return;
    }

    show({
      eyebrow: "workout logger",
      title: "Discard this draft?",
      body: "Saved sessions are written only after the summary.",
      buttons: [
        { label: "Keep lifting", variant: "secondary" },
        { label: "Discard", variant: "danger", onPress: onClose }
      ]
    });
  }, [onClose, show]);

  const saveSession = useCallback(async () => {
    // Synchronous guard: `mode` updates async, so a double-tap could otherwise insert twice.
    if (loggedSetCount === 0 || savingRef.current) {
      return;
    }

    savingRef.current = true;
    const finishedAt = Date.now();
    const session: WorkoutSession = {
      date: localDateString(new Date(loggerState.startedAt)),
      workout: loggerState.workout,
      entries: loggedEntries,
      startedAt: loggerState.startedAt,
      finishedAt,
      xp: xpAwarded,
      progressionEvents
    };

    setMode("saving");

    try {
      await onSave(session);
    } catch (error: unknown) {
      console.error("Failed to save workout session", error);
      show({
        eyebrow: "workout logger",
        title: "Session could not be saved.",
        body: "Give it another go.",
        buttons: [{ label: "OK", variant: "primary" }]
      });
      savingRef.current = false;
      setMode("summary");
    }
  }, [
    loggedEntries,
    loggedSetCount,
    loggerState.startedAt,
    loggerState.workout,
    onSave,
    progressionEvents,
    show,
    xpAwarded
  ]);

  return (
    <Modal animationType="slide" onRequestClose={confirmDiscard} presentationStyle="fullScreen" visible>
      <View className="flex-1 bg-bg">
        <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1 }}>
          <StatusBar style="light" />
          <View className="border-b border-line px-5 pb-3 pt-3">
            <View className="flex-row items-center justify-between gap-3">
              <View className="flex-1">
                <Text
                  className="font-mono-medium text-[11px] uppercase text-text-dim"
                  style={labelTracking}
                >
                  workout logger
                </Text>
                <Text className="mt-1 font-barlow-bold text-[24px] uppercase leading-[28px] text-text">
                  Workout {loggerState.workout}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: mode === "saving" }}
                className={`min-h-[56px] justify-center rounded-lg border border-line bg-panel-2 px-4 ${
                  mode === "saving" ? "opacity-50" : ""
                }`}
                disabled={mode === "saving"}
                onPress={confirmDiscard}
              >
                <Text className="font-barlow-semibold text-[16px] text-danger">Discard</Text>
              </Pressable>
            </View>
          </View>

          {mode === "summary" || mode === "saving" ? (
            <WorkoutSummary
              loggedEntries={loggedEntries}
              loggedSetCount={loggedSetCount}
              mode={mode}
              onBack={() => setMode("logging")}
              onSave={saveSession}
              progressionEvents={progressionSummaryEvents}
              xpAwarded={xpAwarded}
            />
          ) : (
            <>
              <ScrollView className="flex-1" contentContainerClassName="gap-4 p-5 pb-6">
                <WarmupChecklist warmupExercises={warmupExercises} />

                <ExerciseOverview
                  draftExercises={draftExercises}
                  exerciseIndex={exerciseIndex}
                  onSelect={setExerciseIndex}
                />

                <Panel eyebrow="active exercise">
                  <View className="flex-row items-start justify-between gap-4">
                    <View className="flex-1">
                      <Text className="font-barlow-bold text-[32px] leading-[36px] text-text">
                        {activeDraft.exercise.name}
                      </Text>
                      <View className="mt-2 flex-row items-center">
                        <Text className="font-barlow text-[16px] text-text-dim">Set </Text>
                        <Num className="text-[16px] text-text-dim">{activeSetIndex + 1}</Num>
                        <Text className="font-barlow text-[16px] text-text-dim"> of </Text>
                        <Num className="text-[16px] text-text-dim">{activeDraft.exercise.sets}</Num>
                      </View>
                    </View>
                    <View className="min-h-[56px] min-w-[56px] items-center justify-center rounded-lg border border-line bg-panel-2">
                      <Num weight="medium" className="text-[18px] text-mint">
                        {exerciseIndex + 1}/{draftExercises.length}
                      </Num>
                    </View>
                  </View>

                  <View className="mt-4 rounded-lg border border-line bg-panel-2 p-4">
                    <Text
                      className="font-mono-medium text-[11px] uppercase text-text-dim"
                      style={labelTracking}
                    >
                      autopilot
                    </Text>
                    <InstructionLine
                      className="mt-1 text-[16px] leading-[22px] text-text"
                      instruction={activeDraft.instruction}
                      numberClassName="text-[16px] text-text"
                    />
                  </View>

                  {activeDraft.exercise.cues.length > 0 ? (
                    <FormCuesPanel
                      cues={activeDraft.exercise.cues}
                      onToggle={() =>
                        setFormOpen((current) =>
                          current.map((value, index) => (index === exerciseIndex ? !value : value))
                        )
                      }
                      open={formOpen[exerciseIndex] ?? false}
                    />
                  ) : null}

                  <SetRows
                    activeSetIndex={activeSetIndex}
                    draftExercise={activeDraft}
                    onSelectSet={(setIndex) =>
                      setSetIndexes((current) =>
                        current.map((value, index) => (index === exerciseIndex ? setIndex : value))
                      )
                    }
                  />

                  <View className="mt-5 gap-4">
                    <Stepper
                      formatValue={formatWeight}
                      label={activeDraft.exercise.loadType === "assist" ? "Assist level" : "Weight"}
                      min={0}
                      onChange={(weight) => updateActiveSet({ weight })}
                      step={activeDraft.exercise.loadType === "assist" ? 1 : activeDraft.exercise.incrementKg}
                      unit={activeDraft.exercise.loadType === "assist" ? "band" : "kg"}
                      value={activeSet.weight}
                    />
                    <Stepper
                      formatValue={(value) => String(value)}
                      label="Reps"
                      min={0}
                      onChange={(reps) => updateActiveSet({ reps })}
                      step={1}
                      value={activeSet.reps}
                    />
                  </View>

                  <Pressable
                    accessibilityRole="button"
                    className="mt-5 min-h-[56px] items-center justify-center rounded-lg bg-mint px-5"
                    onPress={logActiveSet}
                  >
                    <Text className="font-barlow-bold text-[18px] uppercase text-bg">Log set</Text>
                  </Pressable>
                </Panel>

                {rest ? <RestTimer rest={rest} onDismiss={() => setRest(null)} /> : null}
              </ScrollView>

              <View className="border-t border-line p-5">
                <View className="flex-row gap-3">
                  <Pressable
                    accessibilityRole="button"
                    className="min-h-[56px] flex-1 items-center justify-center rounded-lg border border-line bg-panel-2 px-4"
                    onPress={() => setExerciseIndex((current) => Math.max(0, current - 1))}
                  >
                    <Text className="font-barlow-semibold text-[16px] uppercase text-text">Back</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    className="min-h-[56px] flex-1 items-center justify-center rounded-lg border border-line bg-panel-2 px-4"
                    onPress={() =>
                      setExerciseIndex((current) => Math.min(draftExercises.length - 1, current + 1))
                    }
                  >
                    <Text className="font-barlow-semibold text-[16px] uppercase text-text">Next</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ disabled: loggedSetCount === 0 }}
                    className={`min-h-[56px] flex-1 items-center justify-center rounded-lg bg-mint px-4 ${
                      loggedSetCount === 0 ? "opacity-50" : ""
                    }`}
                    disabled={loggedSetCount === 0}
                    onPress={() => setMode("summary")}
                  >
                    <Text className="font-barlow-bold text-[16px] uppercase text-bg">Finish</Text>
                  </Pressable>
                </View>
              </View>
            </>
          )}
        </SafeAreaView>
        {dialog}
      </View>
    </Modal>
  );
}

function WarmupChecklist({ warmupExercises }: { warmupExercises: ExerciseDef[] }) {
  const items = useMemo(
    () => ["4 min easy row", ...warmupExercises.map((exercise) => `Light set · ${exercise.name}`)],
    [warmupExercises]
  );
  const [checked, setChecked] = useState<boolean[]>(() => items.map(() => false));

  return (
    <Panel eyebrow="warm up">
      <Text className="font-barlow text-[16px] leading-[22px] text-text-dim">
        Optional. Tap what you have done.
      </Text>
      <View className="mt-4 gap-2">
        {items.map((item, index) => {
          const isChecked = checked[index] ?? false;

          return (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isChecked }}
              className="min-h-[56px] flex-row items-center gap-3 rounded-lg border border-line bg-panel-2 px-4"
              key={item}
              onPress={() =>
                setChecked((current) =>
                  current.map((value, valueIndex) => (valueIndex === index ? !value : value))
                )
              }
            >
              <View
                className={`h-7 w-7 items-center justify-center rounded border ${
                  isChecked ? "border-mint bg-mint" : "border-line bg-bg"
                }`}
              >
                {isChecked ? <Text className="font-barlow-bold text-[16px] text-bg">✓</Text> : null}
              </View>
              <Text
                className={`flex-1 font-barlow-semibold text-[16px] leading-[22px] ${
                  isChecked ? "text-mint" : "text-text"
                }`}
              >
                {item}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Panel>
  );
}

function FormCuesPanel({
  cues,
  onToggle,
  open
}: {
  cues: string[];
  onToggle: () => void;
  open: boolean;
}) {
  return (
    <View className="mt-4 rounded-lg border border-line bg-panel-2">
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        className="min-h-[56px] flex-row items-center justify-between px-4"
        onPress={onToggle}
      >
        <Text className="font-mono-medium text-[11px] uppercase text-text-dim" style={labelTracking}>
          form
        </Text>
        <Text className="font-mono-medium text-[16px] text-mint">{open ? "–" : "+"}</Text>
      </Pressable>
      {open ? (
        <View className="gap-2 px-4 pb-4">
          {cues.map((cue) => (
            <View className="flex-row gap-2" key={cue}>
              <Text className="font-barlow-semibold text-[16px] leading-[22px] text-mint">·</Text>
              <Text className="flex-1 font-barlow text-[16px] leading-[22px] text-text">{cue}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function ExerciseOverview({
  draftExercises,
  exerciseIndex,
  onSelect
}: {
  draftExercises: DraftExercise[];
  exerciseIndex: number;
  onSelect: (index: number) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View className="flex-row gap-2">
        {draftExercises.map((draft, index) => {
          const isActive = index === exerciseIndex;
          const loggedCount = draft.sets.filter((set) => set.logged).length;
          const isComplete = loggedCount === draft.sets.length && draft.sets.length > 0;
          const nameClass = isActive ? "text-mint" : "text-text-dim";
          const progressClass = isActive || isComplete ? "text-mint" : "text-text-dim";

          return (
            <Pressable
              accessibilityRole="button"
              className={`min-h-[56px] min-w-[64px] items-center justify-center rounded-lg border px-3 ${
                isActive ? "border-mint bg-petrol" : "border-line bg-panel-2"
              }`}
              key={draft.exercise.id}
              onPress={() => onSelect(index)}
            >
              <Text
                className={`font-mono-medium text-[11px] uppercase ${nameClass}`}
                style={labelTracking}
              >
                {abbreviateExerciseName(draft.exercise.name)}
              </Text>
              <View className="mt-1 flex-row items-center gap-1">
                <Num weight="medium" className={`text-[13px] ${progressClass}`}>
                  {loggedCount}/{draft.sets.length}
                </Num>
                {isComplete ? (
                  <Text className="font-barlow-semibold text-[13px] text-mint">✓</Text>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

function SetRows({
  activeSetIndex,
  draftExercise,
  onSelectSet
}: {
  activeSetIndex: number;
  draftExercise: DraftExercise;
  onSelectSet: (setIndex: number) => void;
}) {
  return (
    <View className="mt-5 gap-2">
      {draftExercise.sets.map((set, index) => {
        const isActive = index === activeSetIndex;

        return (
          <Pressable
            accessibilityRole="button"
            className={`min-h-[56px] flex-row items-center justify-between rounded-lg border px-4 ${
              isActive ? "border-mint bg-petrol" : "border-line bg-panel-2"
            }`}
            key={`${draftExercise.exercise.id}-${index}`}
            onPress={() => onSelectSet(index)}
          >
            <View className="flex-row items-center">
              <Text className="font-barlow-semibold text-[16px] text-text">Set </Text>
              <Num className="text-[16px] text-text">{index + 1}</Num>
            </View>
            <View className="flex-row items-center gap-2">
              <Num weight="medium" className="text-[16px] text-mint">
                {formatWeight(set.weight)}
              </Num>
              <Text className="font-barlow text-[16px] text-text-dim">
                {draftExercise.exercise.loadType === "assist" ? "band" : "kg"}
              </Text>
              <Num weight="medium" className="text-[16px] text-mint">
                {set.reps}
              </Num>
              <Text className="font-barlow text-[16px] text-text-dim">reps</Text>
              <Text className={`font-barlow-semibold text-[13px] ${set.logged ? "text-mint" : "text-text-dim"}`}>
                {set.logged ? "logged" : "ready"}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function WorkoutSummary({
  loggedEntries,
  loggedSetCount,
  mode,
  onBack,
  onSave,
  progressionEvents,
  xpAwarded
}: {
  loggedEntries: ExerciseLog[];
  loggedSetCount: number;
  mode: "summary" | "saving";
  onBack: () => void;
  onSave: () => void;
  progressionEvents: ProgressionSummaryEvent[];
  xpAwarded: number;
}) {
  const volume = calculateSessionVolume(loggedEntries);

  return (
    <ScrollView className="flex-1" contentContainerClassName="gap-4 p-5">
      <Panel eyebrow="summary">
        <Text className="font-barlow-bold text-[32px] leading-[36px] text-text">Session ready</Text>
        <View className="mt-5 gap-3">
          <SummaryMetric label="sets logged" value={String(loggedSetCount)} />
          <SummaryMetric label="volume" unit="kg" value={formatVolume(volume)} />
          <SummaryMetric label="xp awarded" value={`+${xpAwarded} XP`} />
        </View>
        {progressionEvents.length > 0 ? <ProgressionMoment events={progressionEvents} /> : null}
      </Panel>

      <View className="flex-row gap-3">
        <Pressable
          accessibilityRole="button"
          className="min-h-[56px] flex-1 items-center justify-center rounded-lg border border-line bg-panel-2 px-4"
          disabled={mode === "saving"}
          onPress={onBack}
        >
          <Text className="font-barlow-semibold text-[16px] uppercase text-text">Back</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          className={`min-h-[56px] flex-1 items-center justify-center rounded-lg bg-mint px-4 ${
            mode === "saving" ? "opacity-50" : ""
          }`}
          disabled={mode === "saving"}
          onPress={onSave}
        >
          <Text className="font-barlow-bold text-[16px] uppercase text-bg">
            {mode === "saving" ? "Saving" : "Save session"}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function ProgressionMoment({ events }: { events: ProgressionSummaryEvent[] }) {
  const primaryEvent = events[0];
  const countedValue = useProgressionCountUp(primaryEvent.target.targetLoad);
  const displayValue =
    primaryEvent.target.loadType === "assist"
      ? String(Math.round(countedValue))
      : formatWeight(countedValue);
  const unit = primaryEvent.target.loadType === "assist" ? "assist" : "kg";
  const otherEventNames = events
    .slice(1)
    .map((event) => event.exerciseName)
    .join(", ");

  return (
    <View className="mt-5 rounded-lg border border-line bg-panel-2 p-4">
      <Text className="font-mono-medium text-[11px] uppercase text-text-dim" style={labelTracking}>
        progression
      </Text>
      <View className="mt-1 flex-row items-baseline">
        <Num weight="medium" className="text-[40px] leading-[48px] text-amber">
          {displayValue}
        </Num>
        <Text className="ml-2 font-barlow text-[16px] text-text-dim">{unit}</Text>
      </View>
      <Text className="mt-2 font-barlow-semibold text-[18px] leading-[22px] text-text">
        {primaryEvent.exerciseName}
      </Text>
      {otherEventNames ? (
        <Text className="mt-1 font-barlow text-[16px] leading-[22px] text-text-dim">
          Also: {otherEventNames}
        </Text>
      ) : null}
    </View>
  );
}

function useProgressionCountUp(targetValue: number): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let frame = 0;
    const startedAt = Date.now();

    function tick() {
      const elapsed = Date.now() - startedAt;
      const progress = Math.min(1, elapsed / PROGRESSION_MOMENT_MS);

      setValue(targetValue * progress);

      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      }
    }

    setValue(0);
    frame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frame);
  }, [targetValue]);

  return value;
}

function SummaryMetric({ label, unit, value }: { label: string; unit?: string; value: string }) {
  return (
    <View className="rounded-lg border border-line bg-panel-2 p-4">
      <Text className="font-mono-medium text-[11px] uppercase text-text-dim" style={labelTracking}>
        {label}
      </Text>
      <View className="mt-1 flex-row items-baseline">
        <Num weight="medium" className="text-[32px] leading-[38px] text-mint">
          {value}
        </Num>
        {unit ? <Text className="ml-2 font-barlow text-[16px] text-text-dim">{unit}</Text> : null}
      </View>
    </View>
  );
}
