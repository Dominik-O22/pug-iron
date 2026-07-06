import { Text, View, type ViewProps } from "react-native";

import { rankForXp } from "../logic/xp";
import { Num } from "./Num";

type RankProgressLineProps = ViewProps & {
  xpTotal: number;
};

export function RankProgressLine({ className, xpTotal, ...props }: RankProgressLineProps) {
  const rankState = rankForXp(xpTotal);
  const progressPercent = `${Math.max(0, Math.min(1, rankState.progress)) * 100}%` as `${number}%`;

  return (
    <View {...props} className={className}>
      <View className="flex-row items-baseline justify-between gap-4">
        <Text className="flex-1 font-barlow-bold text-[18px] uppercase leading-[22px] text-text">
          {rankState.current.name}
        </Text>
        {rankState.next ? (
          <View className="flex-row items-baseline">
            <Num weight="medium" className="text-[13px] text-mint">
              {rankState.xpToNext}
            </Num>
            <Text className="font-barlow text-[13px] text-text-dim"> XP to next</Text>
          </View>
        ) : (
          <Text className="font-barlow text-[13px] text-text-dim">Top rank</Text>
        )}
      </View>
      <View className="mt-2 h-1.5 overflow-hidden rounded-full bg-panel-2">
        <View className="h-full bg-mint" style={{ width: progressPercent }} />
      </View>
    </View>
  );
}
