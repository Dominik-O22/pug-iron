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
    <Pressable accessibilityRole="button" className="rounded-lg border border-line bg-panel p-5" onPress={onDismiss}>
      <Text className="font-mono-medium text-[11px] uppercase text-text-dim" style={labelTracking}>
        rest
      </Text>
      <Num weight="medium" className="mt-2 text-[48px] leading-[56px] text-mint">
        {formatRestTime(remainingMs)}
      </Num>
      <View className="mt-4 h-1 overflow-hidden rounded-full bg-panel-2">
        <View className="ml-auto h-full bg-mint" style={{ width: `${progress * 100}%` }} />
      </View>
      <Text className="mt-3 font-barlow text-[13px] text-text-dim">Tap to clear.</Text>
    </Pressable>
  );
}
