import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { labelTracking } from "../lib/format";

export type Screen = "today" | "history" | "progress" | "settings";

type Tab = {
  key: Screen;
  label: string;
};

const tabs: Tab[] = [
  { key: "today", label: "Today" },
  { key: "history", label: "History" },
  { key: "progress", label: "Progress" },
  { key: "settings", label: "Settings" }
];

export function TabBar({
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
            className="min-h-[56px] flex-1 items-center pt-3"
            key={tab.key}
            onPress={() => onChange(tab.key)}
          >
            <View className={`absolute left-3 right-3 top-0 h-0.5 ${active ? "bg-mint" : "bg-panel"}`} />
            <Text
              className={`font-mono-medium text-[11px] uppercase ${
                active ? "text-mint" : "text-text-dim"
              }`}
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
