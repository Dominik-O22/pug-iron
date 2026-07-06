import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import * as Haptics from "expo-haptics";

import { formatRestTime, labelTracking } from "../lib/format";
import type { RestState } from "../lib/session";
import { Num } from "./Num";

export function RestTimer({ onDismiss, rest }: { onDismiss: () => void; rest: RestState }) {
  const [now, setNow] = useState(Date.now());
  const hapticRestRef = useRef<number | null>(null);
  const remainingMs = Math.max(0, rest.durationMs - (now - rest.startedAt));
  const progress = remainingMs / rest.durationMs;

  useEffect(() => {
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 250);

    return () => clearInterval(interval);
  }, [rest.startedAt]);

  useEffect(() => {
    if (remainingMs > 0 || hapticRestRef.current === rest.startedAt) {
      return;
    }

    hapticRestRef.current = rest.startedAt;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch((error: unknown) => {
      console.error("Rest haptic failed", error);
    });
  }, [remainingMs, rest.startedAt]);

  return (
    <Pressable
      accessibilityHint="Tap to clear the rest timer"
      accessibilityRole="button"
      className="min-h-[64px] justify-center rounded-lg border border-line bg-panel px-4 py-2"
      onPress={onDismiss}
    >
      <View className="flex-row items-center gap-4">
        <View>
          <Text className="font-mono-medium text-[11px] uppercase text-text-dim" style={labelTracking}>
            rest
          </Text>
          <Text className="font-barlow text-[11px] text-text-dim">tap to clear</Text>
        </View>
        <Num weight="medium" className="text-[40px] leading-[48px] text-mint">
          {formatRestTime(remainingMs)}
        </Num>
        <View className="h-1 flex-1 overflow-hidden rounded-full bg-panel-2">
          <View className="ml-auto h-full bg-mint" style={{ width: `${progress * 100}%` }} />
        </View>
      </View>
    </Pressable>
  );
}
