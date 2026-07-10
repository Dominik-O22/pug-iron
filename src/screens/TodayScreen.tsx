import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { useDialog } from "../components/ConfirmDialog";
import { InstructionLine } from "../components/InstructionLine";
import { Num } from "../components/Num";
import { Panel } from "../components/Panel";
import { Stepper } from "../components/Stepper";
import { formatVolume, formatWeight, labelTracking, localDateString } from "../lib/format";
import {
  deriveProgressionTarget,
  type ProgressionTarget,
  type PullupStage
} from "../logic/progression";
import {
  PULLUP_LADDER_RUNGS,
  isLadderComplete,
  ladderExerciseForStage,
  ladderRungNumber,
  workoutExercisesForStage
} from "../logic/pullup";
import { nextWorkout } from "../logic/workouts";
import type { ExerciseDef, ExerciseLog, RowSession, WeighIn, WorkoutSession } from "../types";

type TodayData = {
  exercises: ExerciseDef[];
  latestLogs: Record<string, ExerciseLog>;
  sessions: WorkoutSession[];
  todaySessions: WorkoutSession[];
  weighIns: WeighIn[];
};

type QuickAction = "rower" | "weigh-in" | null;

export function TodayScreen({
  appData,
  pullupStage,
  onLogRowSession,
  onLogWeighIn,
  onStartWorkout
}: {
  appData: TodayData;
  pullupStage: PullupStage;
  onLogRowSession: (rowSession: Omit<RowSession, "id" | "xp">) => Promise<void>;
  onLogWeighIn: (weighIn: Omit<WeighIn, "id" | "xp">) => Promise<void>;
  onStartWorkout: (workout: WorkoutSession["workout"]) => void;
}) {
  const workout = nextWorkout(appData.sessions);
  const exercises = workoutExercisesForStage(appData.exercises, workout, pullupStage);
  const ladderExercise = ladderExerciseForStage(appData.exercises, pullupStage);
  const ladderLog = ladderExercise ? appData.latestLogs[ladderExercise.id] : undefined;
  const hasLoggedToday = appData.todaySessions.length > 0;
  const latestWeighIn = appData.weighIns[appData.weighIns.length - 1];
  const [quickAction, setQuickAction] = useState<QuickAction>(null);
  const [rowMinutes, setRowMinutes] = useState(10);
  const [rowMeters, setRowMeters] = useState(0);
  const [weightKg, setWeightKg] = useState(latestWeighIn?.kg ?? 90);
  const [savingQuickAction, setSavingQuickAction] = useState<QuickAction>(null);
  const { dialog, show } = useDialog();

  useEffect(() => {
    if (!quickAction && latestWeighIn) {
      setWeightKg(latestWeighIn.kg);
    }
  }, [latestWeighIn, quickAction]);

  async function saveRowSession() {
    if (rowMinutes <= 0 || savingQuickAction) {
      return;
    }

    setSavingQuickAction("rower");

    try {
      await onLogRowSession({
        date: localDateString(new Date()),
        meters: rowMeters > 0 ? Math.round(rowMeters) : undefined,
        minutes: rowMinutes
      });
      setQuickAction(null);
      setRowMinutes(10);
      setRowMeters(0);
    } catch (error: unknown) {
      console.error("Failed to save rower session", error);
      show({
        eyebrow: "quick log",
        title: "Rower session could not be saved.",
        body: "Give it another go.",
        buttons: [{ label: "OK", variant: "primary" }]
      });
    } finally {
      setSavingQuickAction(null);
    }
  }

  async function saveWeighIn() {
    if (weightKg <= 0 || savingQuickAction) {
      return;
    }

    setSavingQuickAction("weigh-in");

    try {
      await onLogWeighIn({
        date: localDateString(new Date()),
        kg: weightKg
      });
      setQuickAction(null);
    } catch (error: unknown) {
      console.error("Failed to save weigh-in", error);
      show({
        eyebrow: "quick log",
        title: "Weigh-in could not be saved.",
        body: "Give it another go.",
        buttons: [{ label: "OK", variant: "primary" }]
      });
    } finally {
      setSavingQuickAction(null);
    }
  }

  return (
    <>
      <ScrollView className="flex-1" contentContainerClassName="gap-4 pb-4">
      {hasLoggedToday ? (
        <Panel eyebrow="today saved">
          <Text className="font-barlow-semibold text-[24px] leading-[29px] text-text">
            Lift saved today. Nice work.
          </Text>
          <Text className="mt-2 font-barlow text-[16px] leading-[22px] text-text-dim">
            The next slot is ready when you want it.
          </Text>
        </Panel>
      ) : null}

      <Panel eyebrow="next workout">
        <View className="flex-row items-start justify-between gap-4">
          <View className="flex-1">
            <Text className="font-barlow-bold text-[40px] uppercase leading-[44px] text-text">
              Workout {workout}
            </Text>
            <Text className="mt-2 font-barlow text-[16px] leading-[22px] text-text-dim">
              Full body lift. Warm up first.
            </Text>
          </View>
          <View className="min-h-[56px] min-w-[56px] items-center justify-center rounded-lg border border-line bg-panel-2">
            <Text className="font-barlow-bold text-[24px] text-mint">{workout}</Text>
          </View>
        </View>

        <View className="mt-5 gap-3">
          {exercises.map((exercise) => {
            const target = deriveProgressionTarget(exercise, appData.latestLogs[exercise.id]);

            return <ExerciseSchemeRow exercise={exercise} key={exercise.id} target={target} />;
          })}
        </View>

        <View className="mt-5 rounded-lg border border-line bg-panel-2 p-4">
          <Text className="font-mono-medium text-[11px] uppercase text-text-dim" style={labelTracking}>
            warm up
          </Text>
          {/* Nested Text keeps the sentence flowing as one paragraph — sibling
              flex items used to wrap mid-sentence. */}
          <Text className="mt-2 font-barlow text-[16px] leading-[22px] text-text">
            <Num className="text-[16px] text-text">4</Num> min easy row, then{" "}
            <Num className="text-[16px] text-text">1</Num> light set for the first two moves.
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          className="mt-5 min-h-[56px] items-center justify-center rounded-lg bg-mint px-5"
          onPress={() => onStartWorkout(workout)}
        >
          <Text className="font-barlow-bold text-[18px] uppercase text-bg">
            {hasLoggedToday ? "Start another" : "Start workout"}
          </Text>
        </Pressable>
      </Panel>

      <PullupLadderCard
        exercise={ladderExercise}
        latestLog={ladderLog}
        onStart={() => onStartWorkout("P")}
        stage={pullupStage}
      />

      <Panel eyebrow="quick log">
        <View className="gap-3">
          <QuickActionButton
            active={quickAction === "rower"}
            label="Log rower session"
            onPress={() => setQuickAction((current) => (current === "rower" ? null : "rower"))}
          />
          {quickAction === "rower" ? (
            <RowerQuickForm
              meters={rowMeters}
              minutes={rowMinutes}
              onChangeMeters={setRowMeters}
              onChangeMinutes={setRowMinutes}
              onSave={saveRowSession}
              saving={savingQuickAction === "rower"}
            />
          ) : null}

          <QuickActionButton
            active={quickAction === "weigh-in"}
            label="Log weigh-in"
            onPress={() => setQuickAction((current) => (current === "weigh-in" ? null : "weigh-in"))}
          />
          {quickAction === "weigh-in" ? (
            <WeighInQuickForm
              kg={weightKg}
              onChangeKg={setWeightKg}
              onSave={saveWeighIn}
              saving={savingQuickAction === "weigh-in"}
            />
          ) : null}
        </View>
      </Panel>
      </ScrollView>
      {dialog}
    </>
  );
}

function QuickActionButton({
  active,
  label,
  onPress
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      className={`min-h-[56px] justify-center rounded-lg border px-4 ${
        active ? "border-mint bg-petrol" : "border-line bg-panel-2"
      }`}
      onPress={onPress}
    >
      <Text className={`font-barlow-bold text-[18px] uppercase ${active ? "text-mint" : "text-text"}`}>
        {label}
      </Text>
    </Pressable>
  );
}

function RowerQuickForm({
  meters,
  minutes,
  onChangeMeters,
  onChangeMinutes,
  onSave,
  saving
}: {
  meters: number;
  minutes: number;
  onChangeMeters: (value: number) => void;
  onChangeMinutes: (value: number) => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <View className="gap-4 rounded-lg border border-line bg-panel-2 p-4">
      <Stepper
        formatValue={formatVolume}
        label="Minutes"
        min={1}
        onChange={onChangeMinutes}
        step={1}
        unit="min"
        value={minutes}
      />
      <Stepper
        formatValue={(value) => String(Math.round(value))}
        label="Meters"
        min={0}
        onChange={onChangeMeters}
        step={100}
        unit="m"
        value={meters}
      />
      <Text className="font-barlow text-[16px] leading-[22px] text-text-dim">
        Meters are optional.
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: saving }}
        className={`min-h-[56px] items-center justify-center rounded-lg bg-mint px-5 ${
          saving ? "opacity-50" : ""
        }`}
        disabled={saving}
        onPress={onSave}
      >
        <Text className="font-barlow-bold text-[18px] uppercase text-bg">
          {saving ? "Saving" : "Save row"}
        </Text>
      </Pressable>
    </View>
  );
}

function WeighInQuickForm({
  kg,
  onChangeKg,
  onSave,
  saving
}: {
  kg: number;
  onChangeKg: (value: number) => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <View className="gap-4 rounded-lg border border-line bg-panel-2 p-4">
      <Stepper
        formatValue={formatWeight}
        label="Body weight"
        min={0}
        onChange={onChangeKg}
        step={0.1}
        unit="kg"
        value={kg}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: saving || kg <= 0 }}
        className={`min-h-[56px] items-center justify-center rounded-lg bg-mint px-5 ${
          saving || kg <= 0 ? "opacity-50" : ""
        }`}
        disabled={saving || kg <= 0}
        onPress={onSave}
      >
        <Text className="font-barlow-bold text-[18px] uppercase text-bg">
          {saving ? "Saving" : "Save weigh-in"}
        </Text>
      </Pressable>
    </View>
  );
}

function ExerciseSchemeRow({
  exercise,
  target
}: {
  exercise: ExerciseDef;
  target: ProgressionTarget;
}) {
  return (
    <View className="flex-row items-center justify-between gap-3 rounded-lg border border-line bg-panel-2 p-4">
      <View className="flex-1">
        <Text className="font-barlow-semibold text-[18px] leading-[22px] text-text">{exercise.name}</Text>
        {target.rule === "first-time" ? (
          // The full pick-a-weight hint lives in the logger's autopilot panel;
          // repeating it on every card drowned the overview.
          <Text className="mt-1 font-barlow text-[15px] leading-[20px] text-text">
            first time — pick your weight
          </Text>
        ) : (
          <InstructionLine
            className="mt-1 text-[15px] leading-[20px] text-text"
            instruction={target.instruction}
            numberClassName="text-[15px] text-text"
          />
        )}
        {exercise.note ? (
          <Text className="mt-1 font-barlow text-[13px] leading-[18px] text-text-dim">
            {exercise.note}
          </Text>
        ) : null}
      </View>
      <View className="items-end">
        <View className="flex-row items-center">
          <Num weight="medium" className="text-[18px] text-mint">
            {exercise.sets}
          </Num>
          <Text className="font-barlow-semibold text-[18px] text-mint"> x </Text>
          <Num weight="medium" className="text-[18px] text-mint">
            {exercise.repLow}
          </Num>
          <Text className="font-barlow-semibold text-[18px] text-mint">-</Text>
          <Num weight="medium" className="text-[18px] text-mint">
            {exercise.repHigh}
          </Num>
        </View>
        {exercise.loadType === "assist" ? (
          <Text className="font-barlow text-[13px] text-text-dim">assist</Text>
        ) : exercise.measure === "seconds" ? (
          <Text className="font-barlow text-[13px] text-text-dim">seconds</Text>
        ) : null}
      </View>
    </View>
  );
}

function PullupLadderCard({
  exercise,
  latestLog,
  onStart,
  stage
}: {
  exercise?: ExerciseDef;
  latestLog?: ExerciseLog;
  onStart: () => void;
  stage: PullupStage;
}) {
  // Once the ladder graduates, band pull-ups belong to Workout B and the standalone
  // card has nothing left to start — the completion moment already showed in the
  // logger summary and stays in History.
  if (!exercise || isLadderComplete(stage)) {
    return null;
  }

  const rung = ladderRungNumber(stage);
  const target = deriveProgressionTarget(exercise, latestLog);
  const isHold = exercise.measure === "seconds";
  const holdTarget = target.sets[0]?.seconds ?? exercise.repLow;
  const scheme = isHold
    ? `${exercise.sets} × ${holdTarget}s`
    : `${exercise.sets} × ${exercise.repLow}-${exercise.repHigh}`;

  return (
    <Panel eyebrow="pull-up ladder">
      <View className="flex-row items-start justify-between gap-4">
        <View className="flex-1">
          <Text className="font-barlow-bold text-[28px] leading-[32px] text-text">
            {exercise.name}
          </Text>
          <View className="mt-1 flex-row items-center">
            <Text
              className="font-mono-medium text-[11px] uppercase text-text-dim"
              style={labelTracking}
            >
              stage{" "}
            </Text>
            <Num weight="medium" className="text-[11px] text-mint">
              {rung}
            </Num>
            <Text
              className="font-mono-medium text-[11px] uppercase text-text-dim"
              style={labelTracking}
            >
              {" / "}
            </Text>
            <Num weight="medium" className="text-[11px] text-text-dim">
              {PULLUP_LADDER_RUNGS}
            </Num>
          </View>
        </View>
        <View className="items-end">
          <Num weight="medium" className="text-[24px] text-mint">
            {scheme}
          </Num>
          <Text className="font-barlow text-[13px] text-text-dim">{isHold ? "hold" : "reps"}</Text>
        </View>
      </View>

      {exercise.note ? (
        <Text className="mt-3 font-barlow text-[15px] leading-[20px] text-text-dim">
          {exercise.note}
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        className="mt-4 min-h-[56px] items-center justify-center rounded-lg bg-mint px-5"
        onPress={onStart}
      >
        <Text className="font-barlow-bold text-[18px] uppercase text-bg">Start ladder set</Text>
      </Pressable>
    </Panel>
  );
}
