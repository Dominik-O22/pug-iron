import { stepStepperValue } from "../stepper";

describe("stepStepperValue", () => {
  const minuteBounds = { min: 0, max: 55, step: 5 };

  it("steps by the step size", () => {
    expect(stepStepperValue(10, 5, minuteBounds)).toBe(15);
    expect(stepStepperValue(10, -5, minuteBounds)).toBe(5);
  });

  it("clamps at max so repeated increments cannot build a hidden buffer", () => {
    let value = 50;
    for (let i = 0; i < 5; i++) {
      value = stepStepperValue(value, 5, minuteBounds);
    }
    expect(value).toBe(55);
    // One decrement from the max must step down immediately.
    expect(stepStepperValue(value, -5, minuteBounds)).toBe(50);
  });

  it("clamps at min", () => {
    expect(stepStepperValue(0, -5, minuteBounds)).toBe(0);
    expect(stepStepperValue(0, 5, minuteBounds)).toBe(5);
  });

  it("is unbounded above when max is omitted", () => {
    expect(stepStepperValue(100, 2, { min: 0, step: 2 })).toBe(102);
  });

  it("rounds to step multiples at 0.1 precision", () => {
    expect(stepStepperValue(80.2, 0.1, { min: 0, step: 0.1 })).toBe(80.3);
    // Off-grid values snap to the nearest step multiple (parity with roundStepperValue).
    expect(stepStepperValue(7, 2, { min: 0, step: 2 })).toBe(10);
  });

  it("clamps hour steppers at 23", () => {
    expect(stepStepperValue(23, 1, { min: 0, max: 23, step: 1 })).toBe(23);
    expect(stepStepperValue(23, -1, { min: 0, max: 23, step: 1 })).toBe(22);
  });
});
