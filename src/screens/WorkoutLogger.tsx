import { useCallback, useMemo, useRef, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useKeepAwake } from "expo-keep-awake";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";

import { Num } from "../components/Num";
import { Panel } from "../components/Panel";
import { RestTimer } from "../components/RestTimer";
import { Stepper } from "../components/Stepper";
import { formatVolume, formatWeight, labelTracking, localDateString } from "../lib/format";
import {
  buildLoggedEntries,
  countLoggedSets,
  type DraftExercise,
  type RestState
} from "../lib/session";
import { calculateSessionVolume, deriveSetPrefill } from "../logic/workouts";
import { XP_EVENTS } from "../logic/xp";
import type { ExerciseDef, ExerciseLog, SetEntry, WorkoutSession } from "../types";

export type LoggerState = {
  startedAt: number;
  workout: WorkoutSession["workout"];
};

const REST_DURATION_MS = 90000;

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
      const prefill = deriveSetPrefill(exercise, latestLogs[exercise.id]);

      return {
        exercise,
        hasHistory: prefill.hasHistory,
        sets: prefill.sets.map((set) => ({ ...set, logged: false }))
      };
    })
  );
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [setIndexes, setSetIndexes] = useState(() => exercises.map(() => 0));
  const [mode, setMode] = useState<"logging" | "summary" | "saving">("logging");
  const [rest, setRest] = useState<RestState | null>(null);
  const savingRef = useRef(false);
  const loggedEntries = useMemo(() => buildLoggedEntries(draftExercises), [draftExercises]);
  const loggedSetCount = useMemo(() => countLoggedSets(loggedEntries), [loggedEntries]);
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

    Alert.alert("Discard this draft?", "Saved sessions are written only after the summary.", [
      { text: "Keep lifting", style: "cancel" },
      { text: "Discard", style: "destructive", onPress: onClose }
    ]);
  }, [onClose]);

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
      xp: XP_EVENTS.workoutSessionSaved,
      progressionEvents: []
    };

    setMode("saving");

    try {
      await onSave(session);
    } catch (error: unknown) {
      console.error("Failed to save workout session", error);
      Alert.alert("Session could not be saved.", "Try again.");
      savingRef.current = false;
      setMode("summary");
    }
  }, [loggedEntries, loggedSetCount, loggerState.startedAt, loggerState.workout, onSave]);

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
            />
          ) : (
            <>
              <ScrollView className="flex-1" contentContainerClassName="gap-4 p-5 pb-6">
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

                  <Text className="mt-4 font-barlow text-[16px] leading-[22px] text-text-dim">
                    {activeDraft.hasHistory
                      ? "Loaded from the last time you logged this move."
                      : "Start with a steady first weight."}
                  </Text>

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
                      step={0.5}
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
      </View>
    </Modal>
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
          const isComplete = draft.sets.every((set) => set.logged);

          return (
            <Pressable
              accessibilityRole="button"
              className={`min-h-[56px] min-w-[56px] items-center justify-center rounded-lg border px-3 ${
                isActive ? "border-mint bg-petrol" : "border-line bg-panel-2"
              }`}
              key={draft.exercise.id}
              onPress={() => onSelect(index)}
            >
              <Text className={`font-barlow-bold text-[18px] ${isActive ? "text-mint" : "text-text"}`}>
                {draft.exercise.workout}
              </Text>
              <Num className={`text-[13px] ${isComplete ? "text-mint" : "text-text-dim"}`}>
                {index + 1}
              </Num>
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
  onSave
}: {
  loggedEntries: ExerciseLog[];
  loggedSetCount: number;
  mode: "summary" | "saving";
  onBack: () => void;
  onSave: () => void;
}) {
  const volume = calculateSessionVolume(loggedEntries);

  return (
    <ScrollView className="flex-1" contentContainerClassName="gap-4 p-5">
      <Panel eyebrow="summary">
        <Text className="font-barlow-bold text-[32px] leading-[36px] text-text">Session ready</Text>
        <View className="mt-5 gap-3">
          <SummaryMetric label="sets logged" value={String(loggedSetCount)} />
          <SummaryMetric label="volume" unit="kg" value={formatVolume(volume)} />
          <SummaryMetric label="xp awarded" value={`+${XP_EVENTS.workoutSessionSaved} XP`} />
        </View>
        <Text className="mt-5 font-barlow text-[16px] leading-[22px] text-text-dim">
          Progression checks arrive in the next milestone.
        </Text>
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
