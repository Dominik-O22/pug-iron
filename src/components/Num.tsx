import { Text, type TextProps, type TextStyle } from "react-native";

type NumProps = TextProps & {
  weight?: "regular" | "medium";
};

// fontVariant has no NativeWind utility; keep it here so every number stays tabular.
const tabularNums: TextStyle["fontVariant"] = ["tabular-nums"];

export function Num({ className, style, weight = "regular", ...props }: NumProps) {
  const fontClass = weight === "medium" ? "font-mono-medium" : "font-mono";

  return (
    <Text
      {...props}
      className={`${fontClass} ${className ?? ""}`}
      style={[{ fontVariant: tabularNums }, style]}
    />
  );
}
