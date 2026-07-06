export const XP_EVENTS = {
  workoutSessionSaved: 100,
  rowerSession: 40,
  weighIn: 10,
  progressionEvent: 25
} as const;

export type Rank = {
  level: number;
  name: string;
  xp: number;
};

export const RANKS: Rank[] = [
  { level: 1, name: "Sleepy Pug", xp: 0 },
  { level: 2, name: "Snack-Motivated Pug", xp: 300 },
  { level: 3, name: "Trotting Pug", xp: 800 },
  { level: 4, name: "Zoomies Pug", xp: 1500 },
  { level: 5, name: "Working Pug", xp: 2400 },
  { level: 6, name: "Gym Pug", xp: 3600 },
  { level: 7, name: "Chiseled Pug", xp: 5000 },
  { level: 8, name: "Diesel Pug", xp: 6800 },
  { level: 9, name: "Alpha Pug", xp: 9000 },
  { level: 10, name: "Mythic Pug", xp: 12000 }
];

export function rankForXp(xpTotal: number) {
  const normalizedXp = Math.max(0, xpTotal);
  const current = currentRankForXp(normalizedXp);
  const next = nextRankForXp(normalizedXp);
  const xpIntoLevel = xpIntoCurrentRank(normalizedXp);
  const xpForLevel = next ? next.xp - current.xp : 0;
  const progress = next ? xpIntoLevel / xpForLevel : 1;

  return {
    current,
    next,
    progress,
    xpForLevel,
    xpIntoLevel,
    xpToNext: xpToNextRank(normalizedXp)
  };
}

export function currentRankForXp(xpTotal: number): Rank {
  const normalizedXp = Math.max(0, xpTotal);
  let current = RANKS[0];

  for (const rank of RANKS) {
    if (normalizedXp >= rank.xp) {
      current = rank;
    }
  }

  return current;
}

export function nextRankForXp(xpTotal: number): Rank | null {
  const normalizedXp = Math.max(0, xpTotal);

  return RANKS.find((rank) => rank.xp > normalizedXp) ?? null;
}

export function xpIntoCurrentRank(xpTotal: number): number {
  const normalizedXp = Math.max(0, xpTotal);
  const current = currentRankForXp(normalizedXp);

  return normalizedXp - current.xp;
}

export function xpToNextRank(xpTotal: number): number {
  const normalizedXp = Math.max(0, xpTotal);
  const next = nextRankForXp(normalizedXp);

  return next ? next.xp - normalizedXp : 0;
}

export function ranksGainedBetween(previousXpTotal: number, nextXpTotal: number): Rank[] {
  const previous = Math.max(0, previousXpTotal);
  const next = Math.max(0, nextXpTotal);

  if (next <= previous) {
    return [];
  }

  return RANKS.filter((rank) => rank.xp > previous && rank.xp <= next);
}

export function highestRankGainedBetween(
  previousXpTotal: number,
  nextXpTotal: number
): Rank | null {
  const gained = ranksGainedBetween(previousXpTotal, nextXpTotal);

  return gained[gained.length - 1] ?? null;
}
