import { useCallback, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";

import { labelTracking } from "../lib/format";

export type DialogButtonVariant = "primary" | "secondary" | "danger";

export type DialogButton = {
  label: string;
  onPress?: () => void;
  variant?: DialogButtonVariant;
};

export type DialogOptions = {
  eyebrow?: string;
  title: string;
  body?: string;
  buttons: DialogButton[];
};

export function useDialog() {
  const [options, setOptions] = useState<DialogOptions | null>(null);
  const show = useCallback((next: DialogOptions) => setOptions(next), []);
  const dismiss = useCallback(() => setOptions(null), []);
  const dialog = <ConfirmDialog onDismiss={dismiss} options={options} />;

  return { dialog, dismiss, show };
}

function ConfirmDialog({
  onDismiss,
  options
}: {
  onDismiss: () => void;
  options: DialogOptions | null;
}) {
  return (
    <Modal animationType="fade" onRequestClose={onDismiss} transparent visible={options !== null}>
      <View className="flex-1 justify-center bg-bg/80 px-5">
        {options ? (
          <View className="rounded-xl border border-line bg-panel p-5">
            {options.eyebrow ? (
              <Text
                className="mb-3 font-mono-medium text-[11px] uppercase text-text-dim"
                style={labelTracking}
              >
                {options.eyebrow}
              </Text>
            ) : null}
            <Text className="font-barlow-bold text-[24px] leading-[29px] text-text">{options.title}</Text>
            {options.body ? (
              <Text className="mt-2 font-barlow text-[16px] leading-[22px] text-text-dim">
                {options.body}
              </Text>
            ) : null}
            <View className="mt-5 flex-row gap-3">
              {options.buttons.map((button, index) => (
                <DialogButtonView
                  button={button}
                  key={`${button.label}-${index}`}
                  onDismiss={onDismiss}
                />
              ))}
            </View>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

function DialogButtonView({
  button,
  onDismiss
}: {
  button: DialogButton;
  onDismiss: () => void;
}) {
  const variant = button.variant ?? "secondary";
  const buttonClass =
    variant === "primary"
      ? "bg-mint"
      : variant === "danger"
        ? "border border-danger bg-panel-2"
        : "border border-line bg-panel-2";
  const textClass =
    variant === "primary" ? "text-bg" : variant === "danger" ? "text-danger" : "text-text";

  return (
    <Pressable
      accessibilityRole="button"
      className={`min-h-[56px] flex-1 items-center justify-center rounded-lg px-4 ${buttonClass}`}
      onPress={() => {
        // Dismiss first so a button can chain into a follow-up dialog (double-confirm flows).
        onDismiss();
        button.onPress?.();
      }}
    >
      <Text className={`font-barlow-bold text-[16px] uppercase ${textClass}`}>{button.label}</Text>
    </Pressable>
  );
}
