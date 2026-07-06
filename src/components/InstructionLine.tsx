import { Text, type TextProps } from "react-native";

import { Num } from "./Num";

const numericPartPattern = /^(\d+(?:\.\d+)?)$/;

type InstructionLineProps = TextProps & {
  instruction: string;
  numberClassName?: string;
};

export function InstructionLine({
  className,
  instruction,
  numberClassName,
  ...props
}: InstructionLineProps) {
  const parts = instruction.split(/(\d+(?:\.\d+)?)/g).filter(Boolean);

  return (
    <Text {...props} className={`font-barlow ${className ?? ""}`}>
      {parts.map((part, index) => {
        if (!numericPartPattern.test(part)) {
          return part;
        }

        return (
          <Num className={numberClassName} key={`${part}-${index}`}>
            {part}
          </Num>
        );
      })}
    </Text>
  );
}
