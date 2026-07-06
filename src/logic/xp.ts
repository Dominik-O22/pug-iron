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
  let current = RANKS[0];

  for (const rank of RANKS) {
    if (normalizedXp >= rank.xp) {
      current = rank;
    }
  }

  const next = RANKS.find((rank) => rank.xp > normalizedXp) ?? null;
  const progress = next ? (normalizedXp - current.xp) / (next.xp - current.xp) : 1;

  return {
    current,
    next,
    progress,
    xpToNext: next ? next.xp - normalizedXp : 0
  };
}
