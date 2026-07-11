import { useCallback, useEffect, useState } from "react";
import { AppState, Text, View } from "react-native";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { RankProgressLine } from "./components/RankProgressLine";
import { RankUpModal } from "./components/RankUpModal";
import { TabBar, type Screen } from "./components/TabBar";
import {
  deleteRowSessionKeepingXp,
  deleteWeighInKeepingXp,
  deleteWorkoutSessionKeepingXp,
  getLatestExerciseLogs,
  getLifetimeTotals,
  getPullupStage,
  getReminderSettings,
  getTodayWorkoutSessions,
  getVoiceAnnouncements,
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
  setReminderSettings,
  updateWorkoutSessionKeepingXp,
  type PugIronDb
} from "./db";
import { labelTracking, localDateString } from "./lib/format";
import { HistoryScreen } from "./screens/HistoryScreen";
import { ProgressScreen } from "./screens/ProgressScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { TodayScreen } from "./screens/TodayScreen";
import { WorkoutLoggerModal, type LoggerState } from "./screens/WorkoutLogger";
import { syncReminders } from "./lib/notifications";
import type { PullupStage } from "./logic/progression";
import { isPrePullupStage, workoutExercisesForStage } from "./logic/pullup";
import type { ReminderSettings } from "./logic/reminders";
import { nextWorkout } from "./logic/workouts";
import { highestRankGainedBetween, type Rank } from "./logic/xp";
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
  pullupStage: PullupStage;
  reminderSettings: ReminderSettings;
  rowSessions: RowSession[];
  sessions: WorkoutSession[];
  todaySessions: WorkoutSession[];
  weighIns: WeighIn[];
  voiceAnnouncements: boolean;
  weightSettings: WeightSettings;
  xpTotal: number;
};

function PugIronApp() {
  const [screen, setScreen] = useState<Screen>("today");
  const [db, setDb] = useState<PugIronDb | null>(null);
  const [appData, setAppData] = useState<AppData | null>(null);
  const [loggerState, setLoggerState] = useState<LoggerState | null>(null);
  const [rankUpRank, setRankUpRank] = useState<Rank | null>(null);
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
      todaySessions,
      xpTotal,
      rowSessions,
      weighIns,
      weightSettings,
      lifetimeTotals,
      pullupStage,
      reminderSettings,
      voiceAnnouncements
    ] = await Promise.all([
      listExerciseDefs(database),
      listWorkoutSessions(database),
      getTodayWorkoutSessions(database, today),
      getXpTotal(database),
      listRowSessions(database),
      listWeighIns(database),
      getWeightSettings(database),
      getLifetimeTotals(database),
      getPullupStage(database),
      getReminderSettings(database),
      getVoiceAnnouncements(database)
    ]);
    const latestLogs = await getLatestExerciseLogs(
      database,
      exercises.map((exercise) => exercise.id)
    );

    setAppData({
      exercises,
      lifetimeTotals,
      latestLogs,
      pullupStage,
      reminderSettings,
      rowSessions,
      sessions,
      todaySessions,
      voiceAnnouncements,
      weighIns,
      weightSettings,
      xpTotal
    });
  }, []);

  // Re-synced on foreground too: permission may have been granted or revoked in
  // Android settings while backgrounded, and syncReminders is the only place the
  // scheduled state gets reconciled with it.
  useEffect(() => {
    if (!appData) {
      return;
    }

    const sync = () =>
      void syncReminders({
        settings: appData.reminderSettings,
        next: isPrePullupStage(appData.pullupStage) ? "P" : nextWorkout(appData.sessions),
        trainedToday: appData.todaySessions.length > 0
      });

    sync();

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        sync();
      }
    });

    return () => subscription.remove();
  }, [appData]);

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

      const result = await insertWorkoutSessionWithXp(db, session);
      await loadAppData(db);
      setLoggerState(null);
      setRankUpRank(
        highestRankGainedBetween(result.previousXpTotal, result.nextXpTotal)
      );
    },
    [db, loadAppData]
  );

  const handleLogRowSession = useCallback(
    async (rowSession: Omit<RowSession, "id" | "xp">) => {
      if (!db) {
        return;
      }

      const result = await insertRowSessionWithXp(db, rowSession);
      await loadAppData(db);
      setRankUpRank(
        highestRankGainedBetween(result.previousXpTotal, result.nextXpTotal)
      );
    },
    [db, loadAppData]
  );

  const handleLogWeighIn = useCallback(
    async (weighIn: Omit<WeighIn, "id" | "xp">) => {
      if (!db) {
        return;
      }

      const result = await insertWeighInWithXp(db, weighIn);
      await loadAppData(db);
      setRankUpRank(
        highestRankGainedBetween(result.previousXpTotal, result.nextXpTotal)
      );
    },
    [db, loadAppData]
  );

  const handleUpdateSession = useCallback(
    async (session: WorkoutSession & { id: number }) => {
      if (!db) {
        return;
      }

      await updateWorkoutSessionKeepingXp(db, session);
      await loadAppData(db);
    },
    [db, loadAppData]
  );

  const handleDeleteWorkoutSession = useCallback(
    async (sessionId: number) => {
      if (!db) {
        return;
      }

      await deleteWorkoutSessionKeepingXp(db, sessionId);
      await loadAppData(db);
    },
    [db, loadAppData]
  );

  const handleDeleteRowSession = useCallback(
    async (rowSessionId: number) => {
      if (!db) {
        return;
      }

      await deleteRowSessionKeepingXp(db, rowSessionId);
      await loadAppData(db);
    },
    [db, loadAppData]
  );

  const handleDeleteWeighIn = useCallback(
    async (weighInId: number) => {
      if (!db) {
        return;
      }

      await deleteWeighInKeepingXp(db, weighInId);
      await loadAppData(db);
    },
    [db, loadAppData]
  );

  const handleUpdateReminderSettings = useCallback(
    async (next: ReminderSettings) => {
      if (!db) {
        return;
      }

      await setReminderSettings(db, next);
      await loadAppData(db);
    },
    [db, loadAppData]
  );

  if (!fontsLoaded || !appData || !db) {
    return (
      <View className="flex-1 bg-bg">
        <StatusBar style="light" />
      </View>
    );
  }

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
          <RankProgressLine className="mt-2.5" xpTotal={appData.xpTotal} />
        </View>
        <View className="flex-1 p-5">
          {renderScreen({
            appData,
            db,
            onDataChanged: () => loadAppData(db),
            onDeleteRowSession: handleDeleteRowSession,
            onDeleteWeighIn: handleDeleteWeighIn,
            onDeleteWorkoutSession: handleDeleteWorkoutSession,
            onLogRowSession: handleLogRowSession,
            onLogWeighIn: handleLogWeighIn,
            onStartWorkout: (workout) => setLoggerState({ workout, startedAt: Date.now() }),
            onUpdateReminderSettings: handleUpdateReminderSettings,
            onUpdateSession: handleUpdateSession,
            screen
          })}
        </View>
        <TabBar activeScreen={screen} onChange={setScreen} />
      </SafeAreaView>

      {loggerState ? (
        <WorkoutLoggerModal
          exercises={workoutExercisesForStage(
            appData.exercises,
            loggerState.workout,
            appData.pullupStage
          )}
          latestLogs={appData.latestLogs}
          loggerState={loggerState}
          pullupStage={appData.pullupStage}
          onClose={() => setLoggerState(null)}
          onSave={handleSaveSession}
          voiceAnnouncements={appData.voiceAnnouncements}
        />
      ) : null}
      <RankUpModal onDismiss={() => setRankUpRank(null)} rank={rankUpRank} />
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
  db,
  onDataChanged,
  onDeleteRowSession,
  onDeleteWeighIn,
  onDeleteWorkoutSession,
  onLogRowSession,
  onLogWeighIn,
  onStartWorkout,
  onUpdateReminderSettings,
  onUpdateSession,
  screen
}: {
  appData: AppData;
  db: PugIronDb;
  onDataChanged: () => Promise<void>;
  onDeleteRowSession: (rowSessionId: number) => Promise<void>;
  onDeleteWeighIn: (weighInId: number) => Promise<void>;
  onDeleteWorkoutSession: (sessionId: number) => Promise<void>;
  onLogRowSession: (rowSession: Omit<RowSession, "id" | "xp">) => Promise<void>;
  onLogWeighIn: (weighIn: Omit<WeighIn, "id" | "xp">) => Promise<void>;
  onStartWorkout: (workout: WorkoutSession["workout"]) => void;
  onUpdateReminderSettings: (settings: ReminderSettings) => Promise<void>;
  onUpdateSession: (session: WorkoutSession & { id: number }) => Promise<void>;
  screen: Screen;
}) {
  if (screen === "today") {
    return (
      <TodayScreen
        appData={appData}
        onLogRowSession={onLogRowSession}
        onLogWeighIn={onLogWeighIn}
        onStartWorkout={onStartWorkout}
        pullupStage={appData.pullupStage}
      />
    );
  }

  if (screen === "history") {
    return (
      <HistoryScreen
        exercises={appData.exercises}
        onDeleteRowSession={onDeleteRowSession}
        onDeleteWeighIn={onDeleteWeighIn}
        onDeleteWorkoutSession={onDeleteWorkoutSession}
        onUpdateSession={onUpdateSession}
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
    <SettingsScreen
      db={db}
      exercises={appData.exercises}
      onDataChanged={onDataChanged}
      onUpdateReminderSettings={onUpdateReminderSettings}
      reminderSettings={appData.reminderSettings}
      voiceAnnouncements={appData.voiceAnnouncements}
    />
  );
}
