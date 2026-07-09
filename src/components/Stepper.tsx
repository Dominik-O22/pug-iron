import { useCallback, useEffect, useRef } from "react";
import { Pressable, Text, View } from "react-native";

import { labelTracking, roundStepperValue } from "../lib/format";
import { Num } from "./Num";

type StepperProps = {
  formatValue: (value: number) => string;
  label: string;
  min: number;
  onChange: (value: number) => void;
  step: number;
  unit?: string;
  value: number;
};

export function Stepper({ formatValue, label, min, onChange, step, unit, value }: StepperProps) {
  const { decrement, increment } = useStepping({ min, onChange, step, value });

  return (
    <View>
      <Text className="mb-2 font-mono-medium text-[11px] uppercase text-text-dim" style={labelTracking}>
        {label}
      </Text>
      <View className="flex-row items-center gap-3">
        <RepeatButton
          accessibilityLabel={`Decrease ${label}`}
          className="h-[64px] w-[64px]"
          label="-"
          onPress={decrement}
        />
        <View className="min-h-[64px] flex-1 items-center justify-center rounded-lg border border-line bg-panel-2 px-4">
          <View className="flex-row items-baseline">
            <Num weight="medium" className="text-[40px] leading-[48px] text-mint">
              {formatValue(value)}
            </Num>
            {unit ? <Text className="ml-2 font-barlow text-[16px] text-text-dim">{unit}</Text> : null}
          </View>
        </View>
        <RepeatButton
          accessibilityLabel={`Increase ${label}`}
          className="h-[64px] w-[64px]"
          label="+"
          onPress={increment}
        />
      </View>
    </View>
  );
}

// Two-column logger layout: label, big value, then a -/+ row underneath.
// Same repeat-on-hold behavior; buttons stay >=56px for a tired thumb.
export function CompactStepper({ formatValue, label, min, onChange, step, unit, value }: StepperProps) {
  const { decrement, increment } = useStepping({ min, onChange, step, value });

  return (
    <View>
      <Text className="mb-1 font-mono-medium text-[11px] uppercase text-text-dim" style={labelTracking}>
        {label}
      </Text>
      <View className="min-h-[52px] items-center justify-center rounded-lg border border-line bg-panel-2 px-2">
        <View className="flex-row items-baseline">
          <Num weight="medium" className="text-[36px] leading-[44px] text-mint">
            {formatValue(value)}
          </Num>
          {unit ? <Text className="ml-1 font-barlow text-[13px] text-text-dim">{unit}</Text> : null}
        </View>
      </View>
      <View className="mt-2 flex-row gap-2">
        <RepeatButton
          accessibilityLabel={`Decrease ${label}`}
          className="h-[56px] flex-1"
          label="-"
          onPress={decrement}
        />
        <RepeatButton
          accessibilityLabel={`Increase ${label}`}
          className="h-[56px] flex-1"
          label="+"
          onPress={increment}
        />
      </View>
    </View>
  );
}

function useStepping({
  min,
  onChange,
  step,
  value
}: Pick<StepperProps, "min" | "onChange" | "step" | "value">) {
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

  return { decrement, increment };
}

function RepeatButton({
  accessibilityLabel,
  className,
  label,
  onPress
}: {
  accessibilityLabel: string;
  className: string;
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
      className={`items-center justify-center rounded-lg bg-mint ${className}`}
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
