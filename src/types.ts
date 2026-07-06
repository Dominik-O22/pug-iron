export interface SetEntry {
  weight: number;
  reps: number;
}

export interface ExerciseLog {
  exerciseId: string;
  sets: SetEntry[];
}

export interface WorkoutSession {
  id?: number;
  date: string;
  workout: "A" | "B";
  entries: ExerciseLog[];
  startedAt: number;
  finishedAt?: number;
  xp: number;
  progressionEvents: string[];
}

export interface RowSession {
  id?: number;
  date: string;
  minutes: number;
  meters?: number;
  xp: number;
}

export interface WeighIn {
  id?: number;
  date: string;
  kg: number;
  xp: number;
}

export interface ExerciseDef {
  id: string;
  name: string;
  workout: "A" | "B";
  order: number;
  sets: number;
  repLow: number;
  repHigh: number;
  loadType: "weight" | "assist";
  incrementKg: number;
  note: string;
  cues: string[];
}

export interface Setting {
  key: string;
  value: unknown;
}

export interface WeightSettings {
  targetWeightKg: number;
  startWeightKg: number | null;
}

export interface LifetimeTotals {
  sessions: number;
  sets: number;
  kgLifted: number;
  metersRowed: number;
}
