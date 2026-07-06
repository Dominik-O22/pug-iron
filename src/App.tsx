import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { Num } from "./components/Num";
import { Panel } from "./components/Panel";
import { openPugIronDb } from "./db";

type Screen = "today" | "history" | "progress" | "settings";

type Tab = {
  key: Screen;
  label: string;
};

// letterSpacing has no NativeWind utility; the mono eyebrow tracking lives here.
const labelTracking = { letterSpacing: 1.5 } as const;

const tabs: Tab[] = [
  { key: "today", label: "Today" },
  { key: "history", label: "History" },
  { key: "progress", label: "Progress" },
  { key: "settings", label: "Settings" }
];

const screenCopy: Record<Screen, { eyebrow: string; title: string; body: string }> = {
  today: {
    eyebrow: "today deck",
    title: "Ready for the next lift",
    body: "Workout A and B are seeded. Logging comes next."
  },
  history: {
    eyebrow: "history log",
    title: "Training records",
    body: "Saved sessions, rower entries, and weigh-ins will land here."
  },
  progress: {
    eyebrow: "progress scope",
    title: "Long view",
    body: "Charts and lifetime readouts will use the same local database."
  },
  settings: {
    eyebrow: "settings bay",
    title: "Offline controls",
    body: "Backup, import, and exercise editing controls will live here."
  }
};

function PugIronApp() {
  const [screen, setScreen] = useState<Screen>("today");
  const [dbReady, setDbReady] = useState(false);
  const [fontsLoaded] = useFonts({
    "BarlowSemiCondensed-Regular": require("./fonts/BarlowSemiCondensed-Regular.ttf"),
    "BarlowSemiCondensed-SemiBold": require("./fonts/BarlowSemiCondensed-SemiBold.ttf"),
    "BarlowSemiCondensed-Bold": require("./fonts/BarlowSemiCondensed-Bold.ttf"),
    "IBMPlexMono-Regular": require("./fonts/IBMPlexMono-Regular.ttf"),
    "IBMPlexMono-Medium": require("./fonts/IBMPlexMono-Medium.ttf")
  });

  useEffect(() => {
    if (!fontsLoaded) {
      return;
    }

    let mounted = true;

    openPugIronDb()
      .catch((error: unknown) => {
        console.error("Failed to open Pug Iron database", error);
      })
      .finally(() => {
        if (mounted) {
          setDbReady(true);
        }
      });

    return () => {
      mounted = false;
    };
  }, [fontsLoaded]);

  if (!fontsLoaded || !dbReady) {
    return (
      <View className="flex-1 bg-bg">
        <StatusBar style="light" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-bg">
      <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1 }}>
        <StatusBar style="light" />
        <View className="px-5 pt-3">
          <Text
            className="font-mono-medium text-[13px] uppercase text-text-dim"
            style={labelTracking}
          >
            PUG IRON
          </Text>
          <View className="mt-2.5 flex-row items-center justify-between">
            <Text className="font-barlow-bold text-[24px] uppercase text-text">SLEEPY PUG</Text>
            <Num weight="medium" className="text-[13px] text-mint">
              0 XP
            </Num>
          </View>
        </View>
        <View className="flex-1 p-5">{renderScreen(screen)}</View>
        <TabBar activeScreen={screen} onChange={setScreen} />
      </SafeAreaView>
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

function renderScreen(screen: Screen) {
  const copy = screenCopy[screen];

  return (
    <Panel eyebrow={copy.eyebrow} className="min-h-[180px]">
      <Text className="font-barlow-semibold text-[24px] leading-[29px] text-text">{copy.title}</Text>
      <Text className="mt-2 font-barlow text-[16px] leading-[22px] text-text-dim">{copy.body}</Text>
    </Panel>
  );
}

function TabBar({
  activeScreen,
  onChange
}: {
  activeScreen: Screen;
  onChange: (screen: Screen) => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="flex-row border-t border-line bg-panel px-2"
      style={{ paddingBottom: Math.max(insets.bottom, 12) }}
    >
      {tabs.map((tab) => {
        const active = tab.key === activeScreen;

        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            key={tab.key}
            onPress={() => onChange(tab.key)}
            className="min-h-[56px] flex-1 items-center pt-3"
          >
            <View
              className={`absolute left-3 right-3 top-0 h-0.5 ${active ? "bg-mint" : "bg-transparent"}`}
            />
            <Text
              className={`font-mono-medium text-[11px] uppercase ${active ? "text-mint" : "text-text-dim"}`}
              style={labelTracking}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
