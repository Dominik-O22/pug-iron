import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Modal, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { Rank } from "../logic/xp";
import { labelTracking } from "../lib/format";
import { Num } from "./Num";

const RANK_UP_TOTAL_MS = 1500;
const TYPE_START_MS = 160;
const TYPE_DURATION_MS = 820;

export function RankUpModal({
  onDismiss,
  rank
}: {
  onDismiss: () => void;
  rank: Rank | null;
}) {
  const reducedMotion = useReducedMotionSetting();
  const opacity = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current;
  const [visibleCharacters, setVisibleCharacters] = useState(0);
  const rankName = rank?.name ?? "";
  const typedName = reducedMotion ? rankName : rankName.slice(0, visibleCharacters);
  const progressWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"]
  });

  useEffect(() => {
    if (!rank) {
      return;
    }

    let typeTimer: ReturnType<typeof setTimeout> | null = null;
    let typeInterval: ReturnType<typeof setInterval> | null = null;

    opacity.setValue(0);
    progress.setValue(reducedMotion ? 1 : 0);
    setVisibleCharacters(reducedMotion ? rank.name.length : 0);

    Animated.timing(opacity, {
      duration: reducedMotion ? 180 : 240,
      easing: Easing.out(Easing.cubic),
      toValue: 1,
      useNativeDriver: true
    }).start();

    if (!reducedMotion) {
      Animated.timing(progress, {
        duration: RANK_UP_TOTAL_MS - 260,
        easing: Easing.out(Easing.cubic),
        toValue: 1,
        useNativeDriver: false
      }).start();

      const characterDelay = Math.max(28, Math.floor(TYPE_DURATION_MS / rank.name.length));

      typeTimer = setTimeout(() => {
        typeInterval = setInterval(() => {
          setVisibleCharacters((current) => {
            if (current >= rank.name.length) {
              if (typeInterval) {
                clearInterval(typeInterval);
              }

              return current;
            }

            return current + 1;
          });
        }, characterDelay);
      }, TYPE_START_MS);
    }

    return () => {
      if (typeTimer) {
        clearTimeout(typeTimer);
      }

      if (typeInterval) {
        clearInterval(typeInterval);
      }
    };
  }, [opacity, progress, rank, reducedMotion]);

  return (
    <Modal animationType="fade" onRequestClose={onDismiss} presentationStyle="fullScreen" visible={!!rank}>
      <Animated.View style={{ flex: 1, opacity }}>
        <Pressable accessibilityRole="button" className="flex-1 bg-bg" onPress={onDismiss}>
          <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1 }}>
            <View className="flex-1 justify-center px-5">
              <View className="border-y border-amber py-8">
                <Text
                  className="font-mono-medium text-[11px] uppercase text-amber"
                  style={labelTracking}
                >
                  rank up
                </Text>
                <View className="mt-5 flex-row items-baseline">
                  <Text className="font-barlow-semibold text-[18px] uppercase text-text-dim">Level </Text>
                  <Num weight="medium" className="text-[18px] text-amber">
                    {rank?.level ?? ""}
                  </Num>
                </View>
                <Text className="mt-2 min-h-[64px] font-mono-medium text-[40px] uppercase leading-[48px] text-text">
                  {typedName}
                </Text>
                <View className="mt-6 h-2 overflow-hidden rounded-full bg-panel-2">
                  <Animated.View style={{ height: "100%", width: progressWidth }}>
                    <View className="h-full bg-amber" />
                  </Animated.View>
                </View>
                <Text className="mt-6 font-barlow text-[16px] leading-[22px] text-text-dim">
                  Tap to continue.
                </Text>
              </View>
            </View>
          </SafeAreaView>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

function useReducedMotionSetting(): boolean {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    let mounted = true;

    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) {
        setReducedMotion(enabled);
      }
    });

    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReducedMotion);

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reducedMotion;
}
