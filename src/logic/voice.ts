export type VoiceIntent =
  | { type: "reps"; value: number }
  | { type: "start" }
  | { type: "stop" }
  | { type: "undo" };

const UNITS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9
};

const TEENS: Record<string, number> = {
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19
};

// Recognizers often emit homophones for bare numbers; map the common ones back.
const HOMOPHONES: Record<string, string> = {
  to: "two",
  too: "two",
  for: "four",
  fore: "four",
  ate: "eight",
  won: "one",
  tree: "three",
  sex: "six"
};

export const MAX_VOICE_REPS = 30;

export function parseVoiceIntent(transcript: string): VoiceIntent | null {
  const words = transcript
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/[\s-]+/)
    .filter(Boolean);

  if (words.length === 0 || words.length > 3) {
    return null;
  }

  if (words.length === 1) {
    if (words[0] === "start") {
      return { type: "start" };
    }

    if (words[0] === "stop") {
      return { type: "stop" };
    }

    if (words[0] === "undo") {
      return { type: "undo" };
    }
  }

  const value = wordsToNumber(words);

  return value !== null && value >= 1 && value <= MAX_VOICE_REPS
    ? { type: "reps", value }
    : null;
}

function wordsToNumber(words: string[]): number | null {
  if (words.length === 1 && /^\d{1,2}$/.test(words[0])) {
    return Number(words[0]);
  }

  const normalized = words.map((word) => HOMOPHONES[word] ?? word);

  if (normalized.length === 1) {
    const word = normalized[0];

    if (word in UNITS) {
      return UNITS[word];
    }

    if (word in TEENS) {
      return TEENS[word];
    }

    if (word === "twenty") {
      return 20;
    }

    if (word === "thirty") {
      return 30;
    }

    return null;
  }

  if (normalized.length === 2 && normalized[0] === "twenty" && normalized[1] in UNITS) {
    return 20 + UNITS[normalized[1]];
  }

  return null;
}
