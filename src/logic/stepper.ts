export type StepBounds = {
  min: number;
  max?: number;
  step: number;
};

export function stepStepperValue(current: number, delta: number, { min, max, step }: StepBounds): number {
  const rounded = Number((Math.round((current + delta) / step) * step).toFixed(1));
  const floored = Math.max(min, rounded);

  return max === undefined ? floored : Math.min(max, floored);
}
