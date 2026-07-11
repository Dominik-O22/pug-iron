import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useKeepAwake } from "expo-keep-awake";
import * as Speech from "expo-speech";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";

import { useDialog } from "../components/ConfirmDialog";
import { InstructionLine } from "../components/InstructionLine";
import { Num } from "../components/Num";
import { Panel } from "../components/Panel";
import { RestTimer } from "../components/RestTimer";
import { CompactStepper } from "../components/Stepper";
import {
  abbreviateExerciseName,
  formatVolume,
  formatWeight,
  labelTracking,
  localDateString
} from "../lib/format";
import {
  buildLoggedEntries,
  buildSetProgressSegments,
  countLoggedSets,
  type DraftExercise,
  type RestState
} from "../lib/session";
import {
  advancePullupStage,
  calculateWorkoutXp,
  detectProgressionEvents,
  deriveProgressionTarget,
  type ProgressionEventTarget,
  type PullupStage
} from "../logic/progression";
import { resolveLadderExerciseId } from "../logic/pullup";
import {
  formatExerciseTargetForSpeech,
  formatRestDoneForSpeech,
  numberToSpeech
} from "../logic/speech";
import type { VoiceIntent } from "../logic/voice";
import { useVoiceControl, type VoiceStatus } from "../lib/voiceControl";
import { calculateSessionVolume } from "../logic/workouts";
import type { ExerciseDef, ExerciseLog, SetEntry, WorkoutSession } from "../types";

export type LoggerState = {
  startedAt: number;
  workout: WorkoutSession["workout"];
};

type ProgressionSummaryEvent = {
  exerciseName: string;
  target: ProgressionEventTarget;
};

type LadderMoment = {
  complete: boolean;
  exerciseName: string;
};

const DEFAULT_REST_SEC = 90;
const PROGRESSION_MOMENT_MS = 500;

export function WorkoutLoggerModal({
  exercises,
  latestLogs,
  loggerState,
  pullupStage,
  onClose,
  onSave,
  voiceAnnouncements
}: {
  exercises: ExerciseDef[];
  latestLogs: Record<string, ExerciseLog>;
  loggerState: LoggerState;
  pullupStage: PullupStage;
  onClose: () => void;
  onSave: (session: WorkoutSession) => Promise<void>;
  voiceAnnouncements: boolean;
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
          ...(typeof set.seconds === "number" ? { seconds: set.seconds } : {}),
          logged: false
        }))
      };
    })
  );
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [setIndexes, setSetIndexes] = useState(() => exercises.map(() => 0));
  const [mode, setMode] = useState<"logging" | "summary" | "saving">("logging");
  const [rest, setRest] = useState<RestState | null>(null);
  const [restAnnouncement, setRestAnnouncement] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState<boolean[]>(() => exercises.map(() => false));
  const savingRef = useRef(false);
  const voiceUndoRef = useRef<{
    exerciseIndex: number;
    setIndex: number;
    previousReps: number;
    carriedSetIndexes: number[];
  } | null>(null);
  const holdControlRef = useRef<{ start: () => void; stop: () => void } | null>(null);
  const [voiceFlash, setVoiceFlash] = useState<{
    exerciseIndex: number;
    setIndex: number;
    startedAt: number;
  } | null>(null);

  // Visual confirmation of a voice log: the set segment flashes for a moment
  // (spec: TTS echo + row flash), then clears.
  useEffect(() => {
    if (!voiceFlash) {
      return;
    }

    const id = setTimeout(() => setVoiceFlash(null), 1200);

    return () => clearTimeout(id);
  }, [voiceFlash]);
  const { dialog, show } = useDialog();
  const warmupExercises = useMemo(() => exercises.slice(0, 2), [exercises]);
  const loggedEntries = useMemo(() => buildLoggedEntries(draftExercises), [draftExercises]);
  const loggedSetCount = useMemo(() => countLoggedSets(loggedEntries), [loggedEntries]);
  const standardEvents = useMemo(
    () => detectProgressionEvents(exercises, latestLogs, loggedEntries),
    [exercises, latestLogs, loggedEntries]
  );
  const stageAdvance = useMemo(
    () => advancePullupStage(pullupStage, exercises, loggedEntries),
    [exercises, loggedEntries, pullupStage]
  );
  // A ladder graduation counts as one more progression event: it stacks the same
  // +25 XP and rides the same rank pipeline as a standard load bump.
  const progressionEvents = useMemo(() => {
    const event = stageAdvance.progressionEvent;

    if (!event || standardEvents.includes(event)) {
      return standardEvents;
    }

    return [...standardEvents, event];
  }, [standardEvents, stageAdvance]);
  const ladderMoment = useMemo<LadderMoment | null>(() => {
    if (stageAdvance.progressionEvent === null) {
      return null;
    }

    const advanced = exercises.find((exercise) => exercise.id === resolveLadderExerciseId(pullupStage));

    return {
      complete: stageAdvance.stage === "complete",
      exerciseName: advanced?.name ?? "Pull-up ladder"
    };
  }, [exercises, pullupStage, stageAdvance]);
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
  const xpAwarded = calculateWorkoutXp(loggerState.workout, progressionEvents.length);
  const activeDraft = draftExercises[exerciseIndex];
  const activeSetIndex = Math.min(setIndexes[exerciseIndex] ?? 0, activeDraft.sets.length - 1);
  const activeSet = activeDraft.sets[activeSetIndex];

  const restRef = useRef(rest);
  restRef.current = rest;

  useEffect(() => {
    // A rest at an exercise boundary already announces the next target via
    // the rest-done line; announcing here too would speak it twice.
    if (!voiceAnnouncements || restRef.current) {
      return;
    }

    void speakAnnouncement(formatExerciseTargetForSpeech(activeDraft.exercise, activeSet));
  }, [activeDraft.exercise.id, voiceAnnouncements]);

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

  const logSetAtIndex = useCallback(
    (setIndex: number, repsOverride?: number) => {
      const targetSet = activeDraft.sets[setIndex];

      if (!targetSet || targetSet.logged) {
        return;
      }

      // A touch or voice log supersedes the previous voice log as the undo target.
      voiceUndoRef.current = null;
      const loggedWeight = targetSet.weight;
      const updatedSets = activeDraft.sets.map((set, index) => {
        if (index === setIndex) {
          return {
            ...set,
            ...(repsOverride === undefined ? {} : { reps: repsOverride }),
            logged: true
          };
        }

        // Carry the weight just lifted onto later sets still sitting at the empty
        // default, so a first-time exercise doesn't reset to 0 kg every set. A set
        // the user already dialed to a different weight is left untouched.
        if (index > setIndex && !set.logged && set.weight === 0 && loggedWeight > 0) {
          return { ...set, weight: loggedWeight };
        }

        return set;
      });
      const nextSetIndex = updatedSets.findIndex((set) => !set.logged);

      setDraftExercises((current) =>
        current.map((draft, draftIndex) =>
          draftIndex === exerciseIndex ? { ...draft, sets: updatedSets } : draft
        )
      );
      const nextTarget = findNextTarget(
        draftExercises,
        exerciseIndex,
        nextSetIndex,
        updatedSets
      );
      setRestAnnouncement(
        voiceAnnouncements
          ? formatRestDoneForSpeech(nextTarget?.exercise ?? null, nextTarget?.set ?? null)
          : null
      );
      setRest({
        startedAt: Date.now(),
        durationMs: (activeDraft.exercise.restSec ?? DEFAULT_REST_SEC) * 1000
      });

      if (nextSetIndex >= 0) {
        setSetIndexes((current) =>
          current.map((value, index) => (index === exerciseIndex ? nextSetIndex : value))
        );
        return;
      }

      if (exerciseIndex < draftExercises.length - 1) {
        setExerciseIndex((current) => current + 1);
      }
    },
    [activeDraft.exercise.restSec, activeDraft.sets, draftExercises, exerciseIndex, voiceAnnouncements]
  );

  const logActiveSet = useCallback(
    () => logSetAtIndex(activeSetIndex),
    [activeSetIndex, logSetAtIndex]
  );

  const handleVoiceIntent = useCallback(
    (intent: VoiceIntent) => {
      if (mode !== "logging") {
        return;
      }

      if (intent.type === "start" || intent.type === "stop") {
        if (intent.type === "start") {
          holdControlRef.current?.start();
        } else {
          holdControlRef.current?.stop();
        }
        return;
      }

      if (intent.type === "undo") {
        const last = voiceUndoRef.current;

        if (!last) {
          return;
        }

        voiceUndoRef.current = null;
        setDraftExercises((current) =>
          current.map((draft, draftIndex) =>
            draftIndex === last.exerciseIndex
              ? {
                  ...draft,
                  sets: draft.sets.map((set, setIndex) => {
                    if (setIndex === last.setIndex) {
                      return { ...set, logged: false, reps: last.previousReps };
                    }

                    // Also walk back the weight this voice log carried onto
                    // later still-unlogged sets.
                    if (last.carriedSetIndexes.includes(setIndex) && !set.logged) {
                      return { ...set, weight: 0 };
                    }

                    return set;
                  })
                }
              : draft
          )
        );
        setSetIndexes((current) =>
          current.map((value, index) => (index === last.exerciseIndex ? last.setIndex : value))
        );
        setExerciseIndex(last.exerciseIndex);
        setRest(null);
        void speakAnnouncement("undone");
        return;
      }

      // Number heard: fills the first unlogged set of the active exercise; never
      // overwrites a logged set; all sets logged → ignored, no TTS. Holds count
      // via start/stop, so bare numbers don't apply to seconds exercises.
      if (activeDraft.exercise.measure === "seconds") {
        return;
      }

      const setIndex = activeDraft.sets.findIndex((set) => !set.logged);

      if (setIndex < 0) {
        return;
      }

      const targetSet = activeDraft.sets[setIndex];
      const carriedSetIndexes = activeDraft.sets.flatMap((set, index) =>
        index > setIndex && !set.logged && set.weight === 0 && targetSet.weight > 0 ? [index] : []
      );

      logSetAtIndex(setIndex, intent.value);
      voiceUndoRef.current = {
        exerciseIndex,
        setIndex,
        previousReps: targetSet.reps,
        carriedSetIndexes
      };
      setVoiceFlash({ exerciseIndex, setIndex, startedAt: Date.now() });
      // The echo phrases are deliberately unparseable as commands ("logged
      // eight" is two words, "undone" isn't in the grammar), so the mic
      // hearing its own TTS can't loop.
      void speakAnnouncement(`logged ${numberToSpeech(intent.value)}`);
    },
    [activeDraft.exercise.measure, activeDraft.sets, exerciseIndex, logSetAtIndex, mode]
  );

  const voice = useVoiceControl({ onIntent: handleVoiceIntent });

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
                  {loggerState.workout === "P" ? "Pull-up ladder" : `Workout ${loggerState.workout}`}
                </Text>
              </View>
              <MicToggle onToggle={voice.toggle} status={voice.status} />
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
              ladderMoment={ladderMoment}
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
              <ScrollView className="flex-1" contentContainerClassName="gap-3 p-5 pb-6">
                {loggerState.workout === "P" ? null : (
                  <WarmupStrip
                    hasLoggedAnySet={loggedSetCount > 0}
                    warmupExercises={warmupExercises}
                  />
                )}

                <ExerciseOverview
                  draftExercises={draftExercises}
                  exerciseIndex={exerciseIndex}
                  onSelect={setExerciseIndex}
                />

                <Panel eyebrow="active exercise">
                  <View className="flex-row items-baseline justify-between gap-3">
                    <Text
                      className="flex-1 font-barlow-bold text-[24px] leading-[28px] text-text"
                      numberOfLines={1}
                    >
                      {activeDraft.exercise.name}
                    </Text>
                    <Num weight="medium" className="text-[16px] text-mint">
                      {exerciseIndex + 1}/{draftExercises.length}
                    </Num>
                  </View>
                  <View className="mt-1 flex-row items-center">
                    <Text className="font-barlow text-[13px] text-text-dim">Set </Text>
                    <Num className="text-[13px] text-text-dim">{activeSetIndex + 1}</Num>
                    <Text className="font-barlow text-[13px] text-text-dim"> of </Text>
                    <Num className="text-[13px] text-text-dim">{activeDraft.exercise.sets}</Num>
                  </View>

                  <SetProgressLine
                    activeSetIndex={activeSetIndex}
                    draftExercise={activeDraft}
                    flashSetIndex={
                      voiceFlash?.exerciseIndex === exerciseIndex ? voiceFlash.setIndex : null
                    }
                    onSelectSet={(setIndex) =>
                      setSetIndexes((current) =>
                        current.map((value, index) => (index === exerciseIndex ? setIndex : value))
                      )
                    }
                  />

                  <AutopilotPanel
                    cues={activeDraft.exercise.cues}
                    formOpen={formOpen[exerciseIndex] ?? false}
                    instruction={activeDraft.instruction}
                    onToggleForm={() =>
                      setFormOpen((current) =>
                        current.map((value, index) => (index === exerciseIndex ? !value : value))
                      )
                    }
                  />

                  {/* key remounts the inputs when the active set changes, so a still-running
                      hold timer can't commit the previous set's elapsed time into the new one */}
                  <ActiveSetInputs
                    key={`${exerciseIndex}:${activeSetIndex}`}
                    exercise={activeDraft.exercise}
                    holdControlRef={holdControlRef}
                    onChange={updateActiveSet}
                    set={activeSet}
                  />
                </Panel>
              </ScrollView>

              <View className="border-t border-line">
                <View className="px-5 pt-3">
                  <Pressable
                    accessibilityRole="button"
                    className="min-h-[56px] items-center justify-center rounded-lg bg-mint px-5"
                    onPress={logActiveSet}
                  >
                    <Text className="font-barlow-bold text-[18px] uppercase text-bg">Log set</Text>
                  </Pressable>
                </View>

                {rest ? (
                  <View className="px-5 pt-3">
                    <RestTimer
                      announcement={restAnnouncement}
                      rest={rest}
                      onDismiss={() => setRest(null)}
                    />
                  </View>
                ) : null}

                <View className="p-5 pt-3">
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
              </View>
            </>
          )}
        </SafeAreaView>
        {dialog}
      </View>
    </Modal>
  );
}

function findNextTarget(
  drafts: DraftExercise[],
  exerciseIndex: number,
  nextSetIndex: number,
  updatedSets: DraftExercise["sets"]
): { exercise: ExerciseDef; set: SetEntry } | null {
  if (nextSetIndex >= 0) {
    return { exercise: drafts[exerciseIndex].exercise, set: updatedSets[nextSetIndex] };
  }

  for (let index = exerciseIndex + 1; index < drafts.length; index += 1) {
    const nextSet = drafts[index].sets.find((set) => !set.logged);

    if (nextSet) {
      return { exercise: drafts[index].exercise, set: nextSet };
    }
  }

  return null;
}

// Header mic state: listening (live), muted (killed by the user, tap to rejoin),
// or quietly explaining why voice is off. Only listening/muted respond to taps.
function MicToggle({ onToggle, status }: { onToggle: () => void; status: VoiceStatus }) {
  const label =
    status === "listening"
      ? "mic on"
      : status === "muted"
        ? "mic off"
        : status === "denied"
          ? "mic off — allow in Android settings"
          : status === "no-model"
            ? "mic off — offline speech model not installed"
            : "mic off";
  const interactive = status === "listening" || status === "muted";

  return (
    <Pressable
      accessibilityHint={interactive ? "Toggles voice logging" : undefined}
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled: !interactive }}
      className={`min-h-[56px] justify-center rounded-lg border px-4 ${
        status === "listening" ? "border-mint bg-petrol" : "border-line bg-panel-2"
      } ${interactive ? "" : "opacity-50"}`}
      disabled={!interactive}
      onPress={onToggle}
    >
      <Text
        className={`font-mono-medium text-[11px] uppercase ${
          status === "listening" ? "text-mint" : "text-text-dim"
        }`}
        style={labelTracking}
      >
        {status === "listening" ? "mic" : "mic off"}
      </Text>
    </Pressable>
  );
}

async function speakAnnouncement(announcement: string): Promise<void> {
  try {
    await Speech.stop();
    Speech.speak(announcement, {
      language: "en-US",
      onError: (error) => console.error("Exercise announcement failed", error)
    });
  } catch (error: unknown) {
    console.error("Exercise announcement failed", error);
  }
}

function ActiveSetInputs({
  exercise,
  holdControlRef,
  onChange,
  set
}: {
  exercise: ExerciseDef;
  holdControlRef: React.MutableRefObject<{ start: () => void; stop: () => void } | null>;
  onChange: (next: Partial<SetEntry>) => void;
  set: SetEntry;
}) {
  if (exercise.measure === "seconds") {
    return (
      <View className="mt-4 gap-3">
        <HoldTimerButton
          controlRef={holdControlRef}
          onCommit={(seconds) => onChange({ seconds })}
          seconds={set.seconds ?? 0}
        />
        <CompactStepper
          formatValue={(value) => String(value)}
          label="Hold"
          min={0}
          onChange={(seconds) => onChange({ seconds })}
          step={5}
          unit="s"
          value={set.seconds ?? 0}
        />
      </View>
    );
  }

  if (exercise.loadType === "body") {
    return (
      <View className="mt-4">
        <CompactStepper
          formatValue={(value) => String(value)}
          label="Reps"
          min={0}
          onChange={(reps) => onChange({ reps })}
          step={1}
          value={set.reps}
        />
      </View>
    );
  }

  return (
    <View className="mt-4 flex-row gap-3">
      <View className="flex-1">
        <CompactStepper
          formatValue={formatWeight}
          label={exercise.loadType === "assist" ? "Assist" : "Weight"}
          min={0}
          onChange={(weight) => onChange({ weight })}
          step={exercise.loadType === "assist" ? 1 : exercise.incrementKg}
          unit={exercise.loadType === "assist" ? "band" : "kg"}
          value={set.weight}
        />
      </View>
      <View className="flex-1">
        <CompactStepper
          formatValue={(value) => String(value)}
          label="Reps"
          min={0}
          onChange={(reps) => onChange({ reps })}
          step={1}
          value={set.reps}
        />
      </View>
    </View>
  );
}

// Tap to start, tap to stop — or "start"/"stop" by voice via controlRef. The live
// count writes straight into the active set on stop; the stepper below fine-tunes
// it. The logger already holds a keep-awake lock. Unmounting mid-hold (screen
// closed, set switched) discards the hold — nothing is committed.
function HoldTimerButton({
  controlRef,
  onCommit,
  seconds
}: {
  controlRef?: React.MutableRefObject<{ start: () => void; stop: () => void } | null>;
  onCommit: (seconds: number) => void;
  seconds: number;
}) {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startedAtRef = useRef(0);
  const runningRef = useRef(false);

  useEffect(() => {
    if (!running) {
      return;
    }

    const id = setInterval(() => {
      setElapsed(Math.max(0, Math.round((Date.now() - startedAtRef.current) / 1000)));
    }, 200);

    return () => clearInterval(id);
  }, [running]);

  const start = useCallback(() => {
    if (runningRef.current) {
      return;
    }

    runningRef.current = true;
    startedAtRef.current = Date.now();
    setElapsed(0);
    setRunning(true);
  }, []);

  const stop = useCallback(() => {
    if (!runningRef.current) {
      return;
    }

    runningRef.current = false;
    setRunning(false);
    onCommit(Math.max(0, Math.round((Date.now() - startedAtRef.current) / 1000)));
  }, [onCommit]);

  useEffect(() => {
    if (!controlRef) {
      return;
    }

    controlRef.current = { start, stop };

    return () => {
      controlRef.current = null;
    };
  }, [controlRef, start, stop]);

  function toggle() {
    if (runningRef.current) {
      stop();
      return;
    }

    start();
  }

  const display = running ? elapsed : seconds;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: running }}
      className={`min-h-[116px] items-center justify-center rounded-lg border ${
        running ? "border-amber bg-petrol" : "border-line bg-panel-2"
      }`}
      onPress={toggle}
    >
      <Text
        className={`font-mono-medium text-[11px] uppercase ${running ? "text-amber" : "text-text-dim"}`}
        style={labelTracking}
      >
        {running ? "holding — tap to stop" : "tap to start hold"}
      </Text>
      <View className="mt-1 flex-row items-baseline">
        <Num weight="medium" className={`text-[56px] leading-[60px] ${running ? "text-amber" : "text-mint"}`}>
          {display}
        </Num>
        <Text className="ml-1 font-barlow text-[18px] text-text-dim">s</Text>
      </View>
    </Pressable>
  );
}

function LadderMomentPanel({ moment }: { moment: LadderMoment }) {
  return (
    <View className="mt-5 rounded-lg border border-line bg-panel-2 p-4">
      <Text className="font-mono-medium text-[11px] uppercase text-text-dim" style={labelTracking}>
        ladder
      </Text>
      <Text className="mt-1 font-barlow-bold text-[28px] leading-[32px] text-amber">
        {moment.complete ? "Ladder complete" : "Ladder up"}
      </Text>
      <Text className="mt-2 font-barlow-semibold text-[18px] leading-[22px] text-text">
        {moment.complete
          ? "Band pull-ups are yours — they carry on in Workout B."
          : `${moment.exerciseName} cleared. Next rung is ready.`}
      </Text>
    </View>
  );
}

function WarmupStrip({
  hasLoggedAnySet,
  warmupExercises
}: {
  hasLoggedAnySet: boolean;
  warmupExercises: ExerciseDef[];
}) {
  const items = useMemo(
    () => [
      "ROW 4 MIN",
      ...warmupExercises.map((exercise) => abbreviateExerciseName(exercise.name))
    ],
    [warmupExercises]
  );
  const [checked, setChecked] = useState<boolean[]>(() => items.map(() => false));
  const [collapsed, setCollapsed] = useState(false);
  const autoCollapsedRef = useRef(false);
  const checkedCount = checked.filter(Boolean).length;
  const allChecked = checkedCount === items.length;
  const shouldAutoCollapse = allChecked || hasLoggedAnySet;

  // Collapse itself once warm-up is done or lifting has started — but only once,
  // so a deliberate re-expand is respected.
  useEffect(() => {
    if (shouldAutoCollapse && !autoCollapsedRef.current) {
      autoCollapsedRef.current = true;
      setCollapsed(true);
    }
  }, [shouldAutoCollapse]);

  if (collapsed) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: false }}
        className="min-h-[44px] flex-row items-center justify-between rounded-xl border border-line bg-panel px-4"
        onPress={() => setCollapsed(false)}
      >
        <Text className="font-mono-medium text-[11px] uppercase text-text-dim" style={labelTracking}>
          warm up
        </Text>
        <View className="flex-row items-center gap-1">
          <Num weight="medium" className={`text-[13px] ${allChecked ? "text-mint" : "text-text-dim"}`}>
            {checkedCount}/{items.length}
          </Num>
          {allChecked ? <Text className="font-barlow-semibold text-[13px] text-mint">✓</Text> : null}
        </View>
      </Pressable>
    );
  }

  return (
    <View className="rounded-xl border border-line bg-panel px-3 py-2">
      <View className="flex-row items-center gap-2">
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: true }}
          className="min-h-[56px] justify-center pr-1"
          onPress={() => setCollapsed(true)}
        >
          <Text className="font-mono-medium text-[11px] uppercase text-text-dim" style={labelTracking}>
            warm up
          </Text>
        </Pressable>
        {items.map((item, index) => {
          const isChecked = checked[index] ?? false;

          return (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isChecked }}
              className={`min-h-[56px] flex-1 items-center justify-center rounded-lg border px-1 ${
                isChecked ? "border-mint bg-mint" : "border-line bg-panel-2"
              }`}
              key={item}
              onPress={() =>
                setChecked((current) =>
                  current.map((value, valueIndex) => (valueIndex === index ? !value : value))
                )
              }
            >
              <Num
                weight="medium"
                className={`text-[11px] uppercase ${isChecked ? "text-bg" : "text-text-dim"}`}
              >
                {item}
              </Num>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function SetProgressLine({
  activeSetIndex,
  draftExercise,
  flashSetIndex = null,
  onSelectSet
}: {
  activeSetIndex: number;
  draftExercise: DraftExercise;
  flashSetIndex?: number | null;
  onSelectSet: (setIndex: number) => void;
}) {
  const segments = buildSetProgressSegments(draftExercise.sets, activeSetIndex);

  return (
    <View className="mt-3 flex-row flex-wrap items-center rounded-lg border border-line bg-panel-2 px-2">
      {segments.map((segment, index) => {
        const flashing = index === flashSetIndex;
        const textClass = flashing
          ? "text-bg"
          : segment.state === "active"
            ? "text-mint"
            : segment.state === "logged"
              ? "text-text"
              : "text-text-dim";

        return (
          <View className="flex-row items-center" key={`${draftExercise.exercise.id}-${index}`}>
            {index > 0 ? <Text className="font-mono text-[13px] text-text-dim"> · </Text> : null}
            <Pressable
              accessibilityRole="button"
              className={`min-h-[44px] justify-center px-2 ${
                flashing ? "rounded bg-mint" : segment.state === "active" ? "rounded bg-petrol" : ""
              }`}
              onPress={() => onSelectSet(index)}
            >
              <Num weight="medium" className={`text-[13px] ${textClass}`}>
                {segment.label}
              </Num>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

function AutopilotPanel({
  cues,
  formOpen,
  instruction,
  onToggleForm
}: {
  cues: string[];
  formOpen: boolean;
  instruction: string;
  onToggleForm: () => void;
}) {
  return (
    <View className="mt-3 rounded-lg border border-line bg-panel-2 px-4 pb-3">
      <View className="flex-row items-center justify-between">
        <Text
          className="pt-3 font-mono-medium text-[11px] uppercase text-text-dim"
          style={labelTracking}
        >
          autopilot
        </Text>
        {cues.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: formOpen }}
            className="min-h-[44px] flex-row items-center gap-2 pl-4"
            onPress={onToggleForm}
          >
            <Text
              className="font-mono-medium text-[11px] uppercase text-text-dim"
              style={labelTracking}
            >
              form
            </Text>
            <Text className="font-mono-medium text-[16px] text-mint">{formOpen ? "–" : "+"}</Text>
          </Pressable>
        ) : null}
      </View>
      <InstructionLine
        className="mt-1 text-[16px] leading-[22px] text-text"
        instruction={instruction}
        numberClassName="text-[16px] text-text"
      />
      {formOpen ? (
        <View className="mt-2 gap-1">
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

function WorkoutSummary({
  ladderMoment,
  loggedEntries,
  loggedSetCount,
  mode,
  onBack,
  onSave,
  progressionEvents,
  xpAwarded
}: {
  ladderMoment: LadderMoment | null;
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
          {volume > 0 ? <SummaryMetric label="volume" unit="kg" value={formatVolume(volume)} /> : null}
          <SummaryMetric label="xp awarded" value={`+${xpAwarded} XP`} />
        </View>
        {ladderMoment ? <LadderMomentPanel moment={ladderMoment} /> : null}
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
