import { colors } from "../../tokens";

export const tokens = {
  colors: {
    bg: colors.bg,
    panel: colors.panel,
    panel2: colors["panel-2"],
    line: colors.line,
    text: colors.text,
    textDim: colors["text-dim"],
    mint: colors.mint,
    petrol: colors.petrol,
    amber: colors.amber,
    danger: colors.danger
  }
} as const;

export type ColorToken = keyof typeof tokens.colors;
