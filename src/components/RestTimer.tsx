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
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import * as Haptics from "expo-haptics";
import * as Speech from "expo-speech";

import { formatRestTime, labelTracking } from "../lib/format";
import type { RestState } from "../lib/session";
import { Num } from "./Num";

export function RestTimer({
  announcement,
  onDismiss,
  rest
}: {
  announcement: string | null;
  onDismiss: () => void;
  rest: RestState;
}) {
  const [now, setNow] = useState(Date.now());
  const doneRef = useRef<number | null>(null);
  const pendingAnnouncementRef = useRef<string | null>(null);
  const player = useAudioPlayer(require("../../assets/rest-done.wav"));
  const playerStatus = useAudioPlayerStatus(player);
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

  // Dismissing rest mid-chime unmounts before didJustFinish fires; without
  // this the global audio mode would stay stuck on duckOthers.
  useEffect(() => {
    return () => {
      if (pendingAnnouncementRef.current !== null || doneRef.current !== null) {
        void restoreMixingMode();
      }
    };
  }, []);

  useEffect(() => {
    if (!done || doneRef.current === rest.startedAt) {
      return;
    }

    doneRef.current = rest.startedAt;
    pendingAnnouncementRef.current = announcement;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch((error: unknown) => {
      console.error("Rest haptic failed", error);
    });
    setAudioModeAsync({ interruptionMode: "duckOthers" })
      .then(() => player.seekTo(0))
      .then(() => player.play())
      .catch((error: unknown) => {
        pendingAnnouncementRef.current = null;
        console.error("Rest chime failed", error);
        void restoreMixingMode();

        if (announcement) {
          void speakAnnouncement(announcement);
        }
      });

    if (!reduceMotion) {
      pulse.value = withSequence(
        withTiming(1.04, { duration: 140, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 280, easing: Easing.out(Easing.quad) })
      );
    }
  }, [announcement, done, player, pulse, reduceMotion, rest.startedAt]);

  useEffect(() => {
    if (!playerStatus.didJustFinish) {
      return;
    }

    const pendingAnnouncement = pendingAnnouncementRef.current;
    pendingAnnouncementRef.current = null;
    void restoreMixingMode();

    if (pendingAnnouncement) {
      void speakAnnouncement(pendingAnnouncement);
    }
  }, [playerStatus.didJustFinish]);

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

async function restoreMixingMode(): Promise<void> {
  try {
    await setAudioModeAsync({ interruptionMode: "mixWithOthers" });
  } catch (error: unknown) {
    console.error("Restoring audio mode failed", error);
  }
}

async function speakAnnouncement(announcement: string): Promise<void> {
  try {
    await Speech.stop();
    Speech.speak(announcement, {
      language: "en-US",
      onError: (error) => console.error("Rest announcement failed", error)
    });
  } catch (error: unknown) {
    console.error("Rest announcement failed", error);
  }
}
