import { useCallback, useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { Num } from "./components/Num";
import { Panel } from "./components/Panel";
import { TabBar, type Screen } from "./components/TabBar";
import {
  getLastWorkoutSession,
  getLatestExerciseLogs,
  getLifetimeTotals,
  getTodayWorkoutSessions,
  getWeightSettings,
  getXpTotal,
  insertRowSessionWithXp,
  insertWeighInWithXp,
  insertWorkoutSessionWithXp,
  listExerciseDefs,
  listRowSessions,
  listWeighIns,
  listWorkoutSessions,
  openPugIronDb,
  type PugIronDb
} from "./db";
import { labelTracking, localDateString } from "./lib/format";
import { HistoryScreen } from "./screens/HistoryScreen";
import { ProgressScreen } from "./screens/ProgressScreen";
import { TodayScreen } from "./screens/TodayScreen";
import { WorkoutLoggerModal, type LoggerState } from "./screens/WorkoutLogger";
import { rankForXp } from "./logic/xp";
import type {
  ExerciseDef,
  ExerciseLog,
  LifetimeTotals,
  RowSession,
  WeighIn,
  WeightSettings,
  WorkoutSession
} from "./types";

type AppData = {
  exercises: ExerciseDef[];
  lifetimeTotals: LifetimeTotals;
  latestLogs: Record<string, ExerciseLog>;
  lastSession: WorkoutSession | null;
  rowSessions: RowSession[];
  sessions: WorkoutSession[];
  todaySessions: WorkoutSession[];
  weighIns: WeighIn[];
  weightSettings: WeightSettings;
  xpTotal: number;
};

function PugIronApp() {
  const [screen, setScreen] = useState<Screen>("today");
  const [db, setDb] = useState<PugIronDb | null>(null);
  const [appData, setAppData] = useState<AppData | null>(null);
  const [loggerState, setLoggerState] = useState<LoggerState | null>(null);
  const [fontsLoaded] = useFonts({
    "BarlowSemiCondensed-Regular": require("./fonts/BarlowSemiCondensed-Regular.ttf"),
    "BarlowSemiCondensed-SemiBold": require("./fonts/BarlowSemiCondensed-SemiBold.ttf"),
    "BarlowSemiCondensed-Bold": require("./fonts/BarlowSemiCondensed-Bold.ttf"),
    "IBMPlexMono-Regular": require("./fonts/IBMPlexMono-Regular.ttf"),
    "IBMPlexMono-Medium": require("./fonts/IBMPlexMono-Medium.ttf")
  });

  const loadAppData = useCallback(async (database: PugIronDb) => {
    const today = localDateString(new Date());
    const [
      exercises,
      sessions,
      lastSession,
      todaySessions,
      xpTotal,
      rowSessions,
      weighIns,
      weightSettings,
      lifetimeTotals
    ] = await Promise.all([
      listExerciseDefs(database),
      listWorkoutSessions(database),
      getLastWorkoutSession(database),
      getTodayWorkoutSessions(database, today),
      getXpTotal(database),
      listRowSessions(database),
      listWeighIns(database),
      getWeightSettings(database),
      getLifetimeTotals(database)
    ]);
    const latestLogs = await getLatestExerciseLogs(
      database,
      exercises.map((exercise) => exercise.id)
    );

    setAppData({
      exercises,
      lifetimeTotals,
      latestLogs,
      lastSession,
      rowSessions,
      sessions,
      todaySessions,
      weighIns,
      weightSettings,
      xpTotal
    });
  }, []);

  useEffect(() => {
    if (!fontsLoaded) {
      return;
    }

    let mounted = true;

    openPugIronDb()
      .then(async (database) => {
        if (!mounted) {
          return;
        }

        setDb(database);
        await loadAppData(database);
      })
      .catch((error: unknown) => {
        console.error("Failed to open Pug Iron database", error);
      });

    return () => {
      mounted = false;
    };
  }, [fontsLoaded, loadAppData]);

  const handleSaveSession = useCallback(
    async (session: WorkoutSession) => {
      if (!db) {
        return;
      }

      await insertWorkoutSessionWithXp(db, session);
      await loadAppData(db);
      setLoggerState(null);
    },
    [db, loadAppData]
  );

  const handleLogRowSession = useCallback(
    async (rowSession: Omit<RowSession, "id" | "xp">) => {
      if (!db) {
        return;
      }

      await insertRowSessionWithXp(db, rowSession);
      await loadAppData(db);
    },
    [db, loadAppData]
  );

  const handleLogWeighIn = useCallback(
    async (weighIn: Omit<WeighIn, "id" | "xp">) => {
      if (!db) {
        return;
      }

      await insertWeighInWithXp(db, weighIn);
      await loadAppData(db);
    },
    [db, loadAppData]
  );

  if (!fontsLoaded || !appData) {
    return (
      <View className="flex-1 bg-bg">
        <StatusBar style="light" />
      </View>
    );
  }

  const rankState = rankForXp(appData.xpTotal);

  return (
    <View className="flex-1 bg-bg">
      <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
        <StatusBar style="light" />
        <View className="px-5 pt-3">
          <Text
            className="font-mono-medium text-[13px] uppercase text-text-dim"
            style={labelTracking}
          >
            PUG IRON
          </Text>
          <View className="mt-2.5 flex-row items-center justify-between gap-4">
            <Text className="flex-1 font-barlow-bold text-[24px] uppercase leading-[28px] text-text">
              {rankState.current.name}
            </Text>
            <Num weight="medium" className="text-[13px] text-mint">
              {appData.xpTotal} XP
            </Num>
          </View>
          <View className="mt-2 h-1.5 overflow-hidden rounded-full bg-panel-2">
            <View className="h-full bg-mint" style={{ width: `${rankState.progress * 100}%` }} />
          </View>
        </View>
        <View className="flex-1 p-5">
          {renderScreen({
            appData,
            onLogRowSession: handleLogRowSession,
            onLogWeighIn: handleLogWeighIn,
            onStartWorkout: (workout) => setLoggerState({ workout, startedAt: Date.now() }),
            screen
          })}
        </View>
        <TabBar activeScreen={screen} onChange={setScreen} />
      </SafeAreaView>

      {loggerState ? (
        <WorkoutLoggerModal
          exercises={appData.exercises.filter((exercise) => exercise.workout === loggerState.workout)}
          latestLogs={appData.latestLogs}
          loggerState={loggerState}
          onClose={() => setLoggerState(null)}
          onSave={handleSaveSession}
        />
      ) : null}
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <PugIronApp />
    </SafeAreaProvider>
  );
}

function renderScreen({
  appData,
  onLogRowSession,
  onLogWeighIn,
  onStartWorkout,
  screen
}: {
  appData: AppData;
  onLogRowSession: (rowSession: Omit<RowSession, "id" | "xp">) => Promise<void>;
  onLogWeighIn: (weighIn: Omit<WeighIn, "id" | "xp">) => Promise<void>;
  onStartWorkout: (workout: WorkoutSession["workout"]) => void;
  screen: Screen;
}) {
  if (screen === "today") {
    return (
      <TodayScreen
        appData={appData}
        onLogRowSession={onLogRowSession}
        onLogWeighIn={onLogWeighIn}
        onStartWorkout={onStartWorkout}
      />
    );
  }

  if (screen === "history") {
    return (
      <HistoryScreen
        rowSessions={appData.rowSessions}
        sessions={appData.sessions}
        weighIns={appData.weighIns}
      />
    );
  }

  if (screen === "progress") {
    return <ProgressScreen appData={appData} />;
  }

  return (
    <Panel eyebrow="settings bay" className="min-h-[180px]">
      <Text className="font-barlow-semibold text-[24px] leading-[29px] text-text">
        Offline controls
      </Text>
      <Text className="mt-2 font-barlow text-[16px] leading-[22px] text-text-dim">
        Backup, import, and exercise editing controls live here.
      </Text>
    </Panel>
  );
}
