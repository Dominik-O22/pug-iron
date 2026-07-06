import type { PropsWithChildren } from "react";
import { Text, View, type ViewProps } from "react-native";

type PanelProps = PropsWithChildren<
  ViewProps & {
    eyebrow: string;
  }
>;

export function Panel({ children, className, eyebrow, ...props }: PanelProps) {
  return (
    <View {...props} className={`rounded-xl border border-line bg-panel p-5 ${className ?? ""}`}>
      <Text
        className="mb-3 font-mono-medium text-[11px] uppercase text-text-dim"
        style={{ letterSpacing: 1.5 }}
      >
        {eyebrow}
      </Text>
      {children}
    </View>
  );
}
