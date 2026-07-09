import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { formatRestTime, labelTracking } from "../lib/format";
import type { RestState } from "../lib/session";
import { Num } from "./Num";

export function RestTimer({ onDismiss, rest }: { onDismiss: () => void; rest: RestState }) {
  const [now, setNow] = useState(Date.now());
  const doneRef = useRef<number | null>(null);
  const remainingMs = Math.max(0, rest.durationMs - (now - rest.startedAt));
  const progress = remainingMs / rest.durationMs;
  const done = remainingMs <= 0;
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(1);
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  useEffect(() => {
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 250);

    return () => clearInterval(interval);
  }, [rest.startedAt]);

  useEffect(() => {
    // Fire the rest-complete cues exactly once per rest: a haptic (for a phone
    // in hand) and a one-shot pulse plus the static "GO" state (for a phone at
    // arm's length, where the haptic is missed).
    if (!done || doneRef.current === rest.startedAt) {
      return;
    }

    doneRef.current = rest.startedAt;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch((error: unknown) => {
      console.error("Rest haptic failed", error);
    });

    if (!reduceMotion) {
      pulse.value = withSequence(
        withTiming(1.04, { duration: 140, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 280, easing: Easing.out(Easing.quad) })
      );
    }
  }, [done, pulse, reduceMotion, rest.startedAt]);

  return (
    <Animated.View style={pulseStyle}>
      <Pressable
        accessibilityHint="Tap to clear the rest timer"
        accessibilityLabel={done ? "Rest complete" : undefined}
        accessibilityRole="button"
        className={`min-h-[64px] justify-center rounded-lg border px-4 py-2 ${
          done ? "border-mint bg-petrol" : "border-line bg-panel"
        }`}
        onPress={onDismiss}
      >
        <View className="flex-row items-center gap-4">
          <View>
            <Text
              className={`font-mono-medium text-[11px] uppercase ${done ? "text-mint" : "text-text-dim"}`}
              style={labelTracking}
            >
              rest
            </Text>
            <Text className={`font-barlow text-[11px] ${done ? "text-mint" : "text-text-dim"}`}>
              {done ? "done — tap to clear" : "tap to clear"}
            </Text>
          </View>
          {done ? (
            <Text className="font-barlow-bold text-[40px] uppercase leading-[48px] text-mint">GO</Text>
          ) : (
            <Num weight="medium" className="text-[40px] leading-[48px] text-mint">
              {formatRestTime(remainingMs)}
            </Num>
          )}
          <View className="h-1 flex-1 overflow-hidden rounded-full bg-panel-2">
            <View
              className="ml-auto h-full bg-mint"
              style={{ width: `${(done ? 1 : progress) * 100}%` }}
            />
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}
