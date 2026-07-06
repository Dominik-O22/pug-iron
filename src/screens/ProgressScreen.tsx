import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { LineChart, type ChartPoint } from "../components/Chart";
import { Num } from "../components/Num";
import { Panel } from "../components/Panel";
import { dateParts, formatVolume, formatWeight, labelTracking } from "../lib/format";
import {
  ASSIST_LEVEL_MAX,
  buildDailyWeightPoints,
  buildExerciseProgressSeries,
  buildRollingAverageSeries,
  buildWeightGuidelineSeries,
  dateToDayNumber,
  type DatedValue,
  type ExerciseProgressMode,
  type ExerciseProgressPoint
} from "../logic/charts";
import { rankForXp } from "../logic/xp";
import type {
  ExerciseDef,
  LifetimeTotals,
  WeighIn,
  WeightSettings,
  WorkoutSession
} from "../types";

type ProgressData = {
  exercises: ExerciseDef[];
  lifetimeTotals: LifetimeTotals;
  sessions: WorkoutSession[];
  weighIns: WeighIn[];
  weightSettings: WeightSettings;
  xpTotal: number;
};

export function ProgressScreen({ appData }: { appData: ProgressData }) {
  const [selectedExerciseId, setSelectedExerciseId] = useState(appData.exercises[0]?.id ?? "");
  const [exerciseMode, setExerciseMode] = useState<ExerciseProgressMode>("top-set");
  const selectedExercise =
    appData.exercises.find((exercise) => exercise.id === selectedExerciseId) ?? appData.exercises[0];

  return (
    <ScrollView className="flex-1" contentContainerClassName="gap-4 pb-4">
      <BodyWeightPanel
        targetWeightKg={appData.weightSettings.targetWeightKg}
        startWeightKg={appData.weightSettings.startWeightKg}
        weighIns={appData.weighIns}
      />

      {selectedExercise ? (
        <ExerciseProgressPanel
          exerciseMode={exerciseMode}
          exercises={appData.exercises}
          onChangeExerciseMode={setExerciseMode}
          onSelectExercise={setSelectedExerciseId}
          selectedExercise={selectedExercise}
          sessions={appData.sessions}
        />
      ) : (
        <Panel eyebrow="exercise chart" className="min-h-[180px]">
          <Text className="font-barlow-semibold text-[24px] leading-[29px] text-text">
            Exercise trends appear after the plan is loaded.
          </Text>
        </Panel>
      )}

      <RankTotalsPanel
        lifetimeTotals={appData.lifetimeTotals}
        xpTotal={appData.xpTotal}
      />
    </ScrollView>
  );
}

function BodyWeightPanel({
  startWeightKg,
  targetWeightKg,
  weighIns
}: {
  startWeightKg: number | null;
  targetWeightKg: number;
  weighIns: WeighIn[];
}) {
  const { averagePoints, dailyPoints, guidelinePoints } = useMemo(() => {
    const daily = buildDailyWeightPoints(weighIns);
    const average = buildRollingAverageSeries(daily);
    const guideline = buildWeightGuidelineSeries({
      dates: daily.map((point) => point.date),
      startDate: daily[0]?.date ?? null,
      startWeightKg
    });

    return {
      averagePoints: toChartPoints(average),
      dailyPoints: toChartPoints(daily),
      guidelinePoints: toChartPoints(guideline)
    };
  }, [startWeightKg, weighIns]);
  const hasWeights = dailyPoints.length > 0;

  return (
    <Panel eyebrow="body weight">
      <Text className="font-barlow-bold text-[32px] leading-[36px] text-text">
        Weekly average
      </Text>
      <Text className="mt-2 font-barlow text-[16px] leading-[22px] text-text-dim">
        Judge the weekly average only. Daily points move around; the line is the signal.
      </Text>
      <View className="mt-5">
        <LineChart
          emptyMessage="Weigh-ins will draw daily points, the weekly average, and the target line."
          formatValue={formatWeight}
          horizontalLines={
            hasWeights
              ? [
                  {
                    color: "textDim",
                    dashed: true,
                    label: "target",
                    opacity: 0.85,
                    value: targetWeightKg
                  }
                ]
              : []
          }
          lines={[
            {
              color: "textDim",
              dashed: true,
              id: "guideline",
              opacity: 0.4,
              points: guidelinePoints,
              strokeWidth: 1
            },
            {
              color: "mint",
              id: "average",
              points: averagePoints,
              strokeWidth: 1.5
            }
          ]}
          markers={[
            {
              color: "textDim",
              id: "daily-weight",
              opacity: 0.45,
              points: dailyPoints,
              radius: 2.5
            },
            {
              color: "mint",
              id: "latest-average",
              latestOnly: true,
              points: averagePoints,
              radius: 4
            }
          ]}
        />
      </View>
    </Panel>
  );
}

function ExerciseProgressPanel({
  exerciseMode,
  exercises,
  onChangeExerciseMode,
  onSelectExercise,
  selectedExercise,
  sessions
}: {
  exerciseMode: ExerciseProgressMode;
  exercises: ExerciseDef[];
  onChangeExerciseMode: (mode: ExerciseProgressMode) => void;
  onSelectExercise: (exerciseId: string) => void;
  selectedExercise: ExerciseDef;
  sessions: WorkoutSession[];
}) {
  const exercisePoints = useMemo(
    () => buildExerciseProgressSeries(sessions, selectedExercise, exerciseMode),
    [exerciseMode, selectedExercise, sessions]
  );
  const chartPoints = useMemo(() => toChartPoints(exercisePoints), [exercisePoints]);
  const latestPoint = exercisePoints[exercisePoints.length - 1] ?? null;
  const valueFormatter = buildExerciseValueFormatter(selectedExercise, exerciseMode);
  const volumeLabel = selectedExercise.loadType === "assist" ? "Total reps" : "Volume";

  return (
    <Panel eyebrow="exercise chart">
      <Text className="font-barlow-bold text-[32px] leading-[36px] text-text">
        {selectedExercise.name}
      </Text>

      <ScrollView className="mt-4" horizontal showsHorizontalScrollIndicator={false}>
        <View className="flex-row gap-2">
          {exercises.map((exercise) => {
            const active = exercise.id === selectedExercise.id;

            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                className={`min-h-[56px] justify-center rounded-lg border px-4 ${
                  active ? "border-mint bg-petrol" : "border-line bg-panel-2"
                }`}
                key={exercise.id}
                onPress={() => onSelectExercise(exercise.id)}
              >
                <Text
                  className={`font-mono-medium text-[11px] uppercase ${
                    active ? "text-mint" : "text-text-dim"
                  }`}
                  numberOfLines={1}
                  style={labelTracking}
                >
                  {exercise.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View className="mt-4 flex-row gap-3">
        <ModeButton
          active={exerciseMode === "top-set"}
          label="Top set"
          onPress={() => onChangeExerciseMode("top-set")}
        />
        <ModeButton
          active={exerciseMode === "volume"}
          label={volumeLabel}
          onPress={() => onChangeExerciseMode("volume")}
        />
      </View>

      <View className="mt-5">
        <LineChart
          emptyMessage="Logged sets for this exercise will draw its trend here."
          formatValue={valueFormatter}
          lines={[
            {
              color: "mint",
              id: "exercise-trend",
              points: chartPoints,
              strokeWidth: 1.5
            }
          ]}
          markers={[
            {
              color: "mint",
              id: "latest-exercise",
              latestOnly: true,
              points: chartPoints,
              radius: 4
            }
          ]}
        />
      </View>

      <View className="mt-4 flex-row items-baseline">
        <Text className="font-barlow text-[16px] leading-[22px] text-text-dim">Latest </Text>
        {latestPoint ? (
          <>
            <Num weight="medium" className="text-[18px] text-mint">
              {formatExerciseLatestValue(latestPoint, selectedExercise, exerciseMode)}
            </Num>
            <Text className="ml-2 font-barlow text-[16px] leading-[22px] text-text-dim">
              {exerciseUnitLabel(selectedExercise, exerciseMode)}
            </Text>
          </>
        ) : (
          <Text className="font-barlow text-[16px] leading-[22px] text-text-dim">
            appears after logging this movement.
          </Text>
        )}
      </View>
      {selectedExercise.loadType === "assist" && exerciseMode === "top-set" ? (
        <Text className="mt-2 font-barlow text-[16px] leading-[22px] text-text-dim">
          Lower assist plots higher.
        </Text>
      ) : null}
    </Panel>
  );
}

function RankTotalsPanel({
  lifetimeTotals,
  xpTotal
}: {
  lifetimeTotals: LifetimeTotals;
  xpTotal: number;
}) {
  const rankState = rankForXp(xpTotal);

  return (
    <Panel eyebrow="xp and totals">
      <Text className="font-barlow-bold text-[32px] leading-[36px] text-text">
        {rankState.current.name}
      </Text>
      <View className="mt-3 flex-row items-center">
        <Num weight="medium" className="text-[18px] text-mint">
          {xpTotal}
        </Num>
        <Text className="font-barlow text-[16px] text-text-dim"> XP total</Text>
      </View>
      <View className="mt-3 h-1.5 overflow-hidden rounded-full bg-panel-2">
        <View className="h-full bg-mint" style={{ width: `${rankState.progress * 100}%` }} />
      </View>
      <View className="mt-3 flex-row items-center">
        {rankState.next ? (
          <>
            <Num weight="medium" className="text-[16px] text-mint">
              {rankState.xpToNext}
            </Num>
            <Text className="font-barlow text-[16px] text-text-dim"> XP to next rank</Text>
          </>
        ) : (
          <Text className="font-barlow text-[16px] text-text-dim">Top rank reached.</Text>
        )}
      </View>

      <View className="mt-5 gap-3 border-t border-line pt-4">
        <TotalRow label="sessions" value={lifetimeTotals.sessions} />
        <TotalRow label="sets" value={lifetimeTotals.sets} />
        <TotalRow label="kg lifted" value={formatVolume(lifetimeTotals.kgLifted)} />
        <TotalRow label="meters rowed" value={lifetimeTotals.metersRowed} />
      </View>
    </Panel>
  );
}

function ModeButton({
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
      accessibilityState={{ selected: active }}
      className={`min-h-[56px] flex-1 items-center justify-center rounded-lg border px-4 ${
        active ? "border-mint bg-petrol" : "border-line bg-panel-2"
      }`}
      onPress={onPress}
    >
      <Text
        className={`font-mono-medium text-[11px] uppercase ${active ? "text-mint" : "text-text-dim"}`}
        style={labelTracking}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function TotalRow({ label, value }: { label: string; value: number | string }) {
  return (
    <View className="flex-row items-center justify-between gap-4">
      <Text className="font-mono-medium text-[11px] uppercase text-text-dim" style={labelTracking}>
        {label}
      </Text>
      <Num weight="medium" className="text-[18px] text-mint">
        {value}
      </Num>
    </View>
  );
}

function toChartPoints(points: DatedValue[]): ChartPoint[] {
  return points.map((point) => ({
    label: shortDateLabel(point.date),
    x: dateToDayNumber(point.date),
    y: point.value
  }));
}

function shortDateLabel(date: string): string {
  const parts = dateParts(date);

  return `${parts.month} ${parts.day}`;
}

function buildExerciseValueFormatter(
  exercise: ExerciseDef,
  mode: ExerciseProgressMode
): (value: number) => string {
  if (mode === "volume") {
    return (value) => (Number.isInteger(value) ? String(value) : value.toFixed(1));
  }

  if (exercise.loadType === "assist") {
    return (value) => String(Math.max(0, Math.round(ASSIST_LEVEL_MAX - value)));
  }

  return formatWeight;
}

function formatExerciseLatestValue(
  point: ExerciseProgressPoint,
  exercise: ExerciseDef,
  mode: ExerciseProgressMode
): string {
  if (mode === "volume") {
    return Number.isInteger(point.rawValue) ? String(point.rawValue) : formatVolume(point.rawValue);
  }

  return exercise.loadType === "assist" ? String(point.rawValue) : formatWeight(point.rawValue);
}

function exerciseUnitLabel(exercise: ExerciseDef, mode: ExerciseProgressMode): string {
  if (mode === "volume") {
    return exercise.loadType === "assist" ? "reps" : "kg";
  }

  return exercise.loadType === "assist" ? "assist" : "kg";
}
