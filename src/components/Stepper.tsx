import { useCallback, useEffect, useRef } from "react";
import { Pressable, Text, View } from "react-native";

import { labelTracking, roundStepperValue } from "../lib/format";
import { Num } from "./Num";

export function Stepper({
  formatValue,
  label,
  min,
  onChange,
  step,
  unit,
  value
}: {
  formatValue: (value: number) => string;
  label: string;
  min: number;
  onChange: (value: number) => void;
  step: number;
  unit?: string;
  value: number;
}) {
  const valueRef = useRef(value);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const changeBy = useCallback(
    (delta: number) => {
      const nextValue = roundStepperValue(Math.max(min, valueRef.current + delta), step);

      valueRef.current = nextValue;
      onChange(nextValue);
    },
    [min, onChange, step]
  );
  const decrement = useCallback(() => changeBy(-step), [changeBy, step]);
  const increment = useCallback(() => changeBy(step), [changeBy, step]);

  return (
    <View>
      <Text className="mb-2 font-mono-medium text-[11px] uppercase text-text-dim" style={labelTracking}>
        {label}
      </Text>
      <View className="flex-row items-center gap-3">
        <RepeatButton accessibilityLabel={`Decrease ${label}`} label="-" onPress={decrement} />
        <View className="min-h-[64px] flex-1 items-center justify-center rounded-lg border border-line bg-panel-2 px-4">
          <View className="flex-row items-baseline">
            <Num weight="medium" className="text-[40px] leading-[48px] text-mint">
              {formatValue(value)}
            </Num>
            {unit ? <Text className="ml-2 font-barlow text-[16px] text-text-dim">{unit}</Text> : null}
          </View>
        </View>
        <RepeatButton accessibilityLabel={`Increase ${label}`} label="+" onPress={increment} />
      </View>
    </View>
  );
}

function RepeatButton({
  accessibilityLabel,
  label,
  onPress
}: {
  accessibilityLabel: string;
  label: string;
  onPress: () => void;
}) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const longPressingRef = useRef(false);

  const stopRepeating = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => stopRepeating, [stopRepeating]);

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      className="h-[64px] w-[64px] items-center justify-center rounded-lg bg-mint"
      delayLongPress={250}
      onLongPress={() => {
        longPressingRef.current = true;
        onPress();
        stopRepeating();
        intervalRef.current = setInterval(onPress, 120);
      }}
      onPress={() => {
        if (!longPressingRef.current) {
          onPress();
        }
      }}
      onPressOut={() => {
        stopRepeating();
        setTimeout(() => {
          longPressingRef.current = false;
        }, 0);
      }}
    >
      <Text className="font-barlow-bold text-[32px] leading-[36px] text-bg">{label}</Text>
    </Pressable>
  );
}
