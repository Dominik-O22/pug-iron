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
  getTodayWorkoutSessions,
  getXpTotal,
  insertWorkoutSessionWithXp,
  listExerciseDefs,
  listWorkoutSessions,
  openPugIronDb,
  type PugIronDb
} from "./db";
import { labelTracking, localDateString } from "./lib/format";
import { HistoryScreen } from "./screens/HistoryScreen";
import { TodayScreen } from "./screens/TodayScreen";
import { WorkoutLoggerModal, type LoggerState } from "./screens/WorkoutLogger";
import { rankForXp } from "./logic/xp";
import type { ExerciseDef, ExerciseLog, WorkoutSession } from "./types";

type AppData = {
  exercises: ExerciseDef[];
  latestLogs: Record<string, ExerciseLog>;
  lastSession: WorkoutSession | null;
  sessions: WorkoutSession[];
  todaySessions: WorkoutSession[];
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
    const [exercises, sessions, lastSession, todaySessions, xpTotal] = await Promise.all([
      listExerciseDefs(database),
      listWorkoutSessions(database),
      getLastWorkoutSession(database),
      getTodayWorkoutSessions(database, today),
      getXpTotal(database)
    ]);
    const latestLogs = await getLatestExerciseLogs(
      database,
      exercises.map((exercise) => exercise.id)
    );

    setAppData({
      exercises,
      latestLogs,
      lastSession,
      sessions,
      todaySessions,
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
  onStartWorkout,
  screen
}: {
  appData: AppData;
  onStartWorkout: (workout: WorkoutSession["workout"]) => void;
  screen: Screen;
}) {
  if (screen === "today") {
    return <TodayScreen appData={appData} onStartWorkout={onStartWorkout} />;
  }

  if (screen === "history") {
    return <HistoryScreen sessions={appData.sessions} />;
  }

  if (screen === "progress") {
    return (
      <Panel eyebrow="progress scope" className="min-h-[180px]">
        <Text className="font-barlow-semibold text-[24px] leading-[29px] text-text">Long view</Text>
        <Text className="mt-2 font-barlow text-[16px] leading-[22px] text-text-dim">
          Charts and lifetime readouts use the local database.
        </Text>
      </Panel>
    );
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
