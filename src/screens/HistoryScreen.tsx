import { useMemo } from "react";
import { ScrollView, Text, View } from "react-native";

import { Num } from "../components/Num";
import { Panel } from "../components/Panel";
import { dateParts, formatVolume, formatWeight, labelTracking } from "../lib/format";
import { countLoggedSets, groupHistoryByWeek, type HistoryEntry } from "../lib/session";
import { calculateSessionVolume } from "../logic/workouts";
import type { RowSession, WeighIn, WorkoutSession } from "../types";

export function HistoryScreen({
  rowSessions,
  sessions,
  weighIns
}: {
  rowSessions: RowSession[];
  sessions: WorkoutSession[];
  weighIns: WeighIn[];
}) {
  const groups = useMemo(
    () => groupHistoryByWeek({ rowSessions, sessions, weighIns }),
    [rowSessions, sessions, weighIns]
  );

  if (sessions.length === 0 && rowSessions.length === 0 && weighIns.length === 0) {
    return (
      <Panel eyebrow="history log" className="min-h-[180px]">
        <Text className="font-barlow-semibold text-[24px] leading-[29px] text-text">
          Workouts, rows, and weigh-ins appear here by week.
        </Text>
        <Text className="mt-2 font-barlow text-[16px] leading-[22px] text-text-dim">
          Each row will show the date and the main numbers from that entry.
        </Text>
      </Panel>
    );
  }

  return (
    <ScrollView className="flex-1" contentContainerClassName="gap-4 pb-4">
      {groups.map((group) => {
        const weekParts = dateParts(group.weekStart);

        return (
          <View className="gap-3" key={group.weekStart}>
            <View className="flex-row items-center">
              <Text className="font-mono-medium text-[11px] uppercase text-text-dim" style={labelTracking}>
                week of {weekParts.month}{" "}
              </Text>
              <Num className="text-[11px] uppercase text-text-dim">{weekParts.day}</Num>
              <Text className="font-mono-medium text-[11px] uppercase text-text-dim" style={labelTracking}>
                {", "}
              </Text>
              <Num className="text-[11px] uppercase text-text-dim">{weekParts.year}</Num>
            </View>
            {group.entries.map((entry) => (
              <HistoryEntryCard entry={entry} key={`${entry.kind}-${entry.sortValue}`} />
            ))}
          </View>
        );
      })}
    </ScrollView>
  );
}

function HistoryEntryCard({ entry }: { entry: HistoryEntry }) {
  if (entry.kind === "rower") {
    return <HistoryRowerCard rowSession={entry.item} />;
  }

  if (entry.kind === "weigh-in") {
    return <HistoryWeighInCard weighIn={entry.item} />;
  }

  return <HistorySessionCard session={entry.item} />;
}

function HistorySessionCard({ session }: { session: WorkoutSession }) {
  const parts = dateParts(session.date);
  const volume = calculateSessionVolume(session.entries);
  const setCount = countLoggedSets(session.entries);

  return (
    <View className="rounded-xl border border-line bg-panel p-5">
      <View className="flex-row items-center justify-between gap-4">
        <View className="min-h-[56px] min-w-[56px] items-center justify-center rounded-lg bg-petrol">
          <Text className="font-barlow-bold text-[24px] text-mint">{session.workout}</Text>
        </View>
        <View className="flex-1">
          <View className="flex-row items-center">
            <Text className="font-barlow-semibold text-[18px] text-text">
              {parts.weekday}, {parts.month}{" "}
            </Text>
            <Num weight="medium" className="text-[18px] text-text">
              {parts.day}
            </Num>
            <Text className="font-barlow-semibold text-[18px] text-text">{", "}</Text>
            <Num weight="medium" className="text-[18px] text-text">
              {parts.year}
            </Num>
          </View>
          <View className="mt-2 flex-row flex-wrap items-center gap-3">
            <View className="flex-row items-center">
              <Num weight="medium" className="text-[16px] text-mint">
                {formatVolume(volume)}
              </Num>
              <Text className="font-barlow text-[16px] text-text-dim"> kg</Text>
            </View>
            <View className="flex-row items-center">
              <Num weight="medium" className="text-[16px] text-mint">
                {setCount}
              </Num>
              <Text className="font-barlow text-[16px] text-text-dim"> sets</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

function HistoryRowerCard({ rowSession }: { rowSession: RowSession }) {
  const parts = dateParts(rowSession.date);

  return (
    <View className="rounded-xl border border-line bg-panel p-5">
      <View className="flex-row items-center justify-between gap-4">
        <View className="min-h-[56px] min-w-[56px] items-center justify-center rounded-lg bg-panel-2">
          <Text className="font-barlow-bold text-[18px] uppercase text-mint">row</Text>
        </View>
        <View className="flex-1">
          <View className="flex-row items-center">
            <Text className="font-barlow-semibold text-[18px] text-text">
              {parts.weekday}, {parts.month}{" "}
            </Text>
            <Num weight="medium" className="text-[18px] text-text">
              {parts.day}
            </Num>
            <Text className="font-barlow-semibold text-[18px] text-text">{", "}</Text>
            <Num weight="medium" className="text-[18px] text-text">
              {parts.year}
            </Num>
          </View>
          <View className="mt-2 flex-row flex-wrap items-center gap-3">
            <View className="flex-row items-center">
              <Num weight="medium" className="text-[16px] text-mint">
                {formatVolume(rowSession.minutes)}
              </Num>
              <Text className="font-barlow text-[16px] text-text-dim"> min</Text>
            </View>
            {typeof rowSession.meters === "number" ? (
              <View className="flex-row items-center">
                <Num weight="medium" className="text-[16px] text-mint">
                  {rowSession.meters}
                </Num>
                <Text className="font-barlow text-[16px] text-text-dim"> m</Text>
              </View>
            ) : null}
            <View className="flex-row items-center">
              <Num weight="medium" className="text-[16px] text-mint">
                +{rowSession.xp}
              </Num>
              <Text className="font-barlow text-[16px] text-text-dim"> XP</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

function HistoryWeighInCard({ weighIn }: { weighIn: WeighIn }) {
  const parts = dateParts(weighIn.date);

  return (
    <View className="rounded-xl border border-line bg-panel p-5">
      <View className="flex-row items-center justify-between gap-4">
        <View className="min-h-[56px] min-w-[56px] items-center justify-center rounded-lg bg-panel-2">
          <Text className="font-barlow-bold text-[18px] uppercase text-mint">kg</Text>
        </View>
        <View className="flex-1">
          <View className="flex-row items-center">
            <Text className="font-barlow-semibold text-[18px] text-text">
              {parts.weekday}, {parts.month}{" "}
            </Text>
            <Num weight="medium" className="text-[18px] text-text">
              {parts.day}
            </Num>
            <Text className="font-barlow-semibold text-[18px] text-text">{", "}</Text>
            <Num weight="medium" className="text-[18px] text-text">
              {parts.year}
            </Num>
          </View>
          <View className="mt-2 flex-row flex-wrap items-center gap-3">
            <View className="flex-row items-center">
              <Num weight="medium" className="text-[16px] text-mint">
                {formatWeight(weighIn.kg)}
              </Num>
              <Text className="font-barlow text-[16px] text-text-dim"> kg</Text>
            </View>
            {weighIn.xp > 0 ? (
              <View className="flex-row items-center">
                <Num weight="medium" className="text-[16px] text-mint">
                  +{weighIn.xp}
                </Num>
                <Text className="font-barlow text-[16px] text-text-dim"> XP</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}
