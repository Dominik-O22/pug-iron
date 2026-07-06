import { Pressable, ScrollView, Text, View } from "react-native";

import { InstructionLine } from "../components/InstructionLine";
import { Num } from "../components/Num";
import { Panel } from "../components/Panel";
import { labelTracking } from "../lib/format";
import { deriveProgressionTarget, type ProgressionTarget } from "../logic/progression";
import { nextWorkout } from "../logic/workouts";
import type { ExerciseDef, ExerciseLog, WorkoutSession } from "../types";

type TodayData = {
  exercises: ExerciseDef[];
  latestLogs: Record<string, ExerciseLog>;
  lastSession: WorkoutSession | null;
  todaySessions: WorkoutSession[];
};

export function TodayScreen({
  appData,
  onStartWorkout
}: {
  appData: TodayData;
  onStartWorkout: (workout: WorkoutSession["workout"]) => void;
}) {
  const workout = nextWorkout(appData.lastSession);
  const exercises = appData.exercises.filter((exercise) => exercise.workout === workout);
  const hasLoggedToday = appData.todaySessions.length > 0;

  return (
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
          <View className="mt-2 flex-row flex-wrap items-center">
            <Num className="text-[16px] text-text">4</Num>
            <Text className="font-barlow text-[16px] leading-[22px] text-text"> min easy row, then </Text>
            <Num className="text-[16px] text-text">1</Num>
            <Text className="font-barlow text-[16px] leading-[22px] text-text">
              {" "}
              light set for the first two moves.
            </Text>
          </View>
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
    </ScrollView>
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
        <InstructionLine
          className="mt-1 text-[15px] leading-[20px] text-text"
          instruction={target.instruction}
          numberClassName="text-[15px] text-text"
        />
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
        <Text className="font-barlow text-[13px] text-text-dim">
          {exercise.loadType === "assist" ? "assist" : "kg"}
        </Text>
      </View>
    </View>
  );
}
