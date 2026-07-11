import { parseVoiceIntent } from "../voice";

describe("parseVoiceIntent", () => {
  test("maps digit transcripts to reps", () => {
    expect(parseVoiceIntent("12")).toEqual({ type: "reps", value: 12 });
    expect(parseVoiceIntent("8")).toEqual({ type: "reps", value: 8 });
  });

  test("maps number words one through thirty", () => {
    expect(parseVoiceIntent("eight")).toEqual({ type: "reps", value: 8 });
    expect(parseVoiceIntent("nineteen")).toEqual({ type: "reps", value: 19 });
    expect(parseVoiceIntent("twenty")).toEqual({ type: "reps", value: 20 });
    expect(parseVoiceIntent("twenty one")).toEqual({ type: "reps", value: 21 });
    expect(parseVoiceIntent("twenty-five")).toEqual({ type: "reps", value: 25 });
    expect(parseVoiceIntent("thirty")).toEqual({ type: "reps", value: 30 });
  });

  test("maps common recognizer homophones", () => {
    expect(parseVoiceIntent("for")).toEqual({ type: "reps", value: 4 });
    expect(parseVoiceIntent("too")).toEqual({ type: "reps", value: 2 });
    expect(parseVoiceIntent("ate")).toEqual({ type: "reps", value: 8 });
  });

  test("maps hold and undo commands", () => {
    expect(parseVoiceIntent("start")).toEqual({ type: "start" });
    expect(parseVoiceIntent("stop")).toEqual({ type: "stop" });
    expect(parseVoiceIntent("undo")).toEqual({ type: "undo" });
    expect(parseVoiceIntent("Stop.")).toEqual({ type: "stop" });
  });

  test("rejects out-of-range and zero counts", () => {
    expect(parseVoiceIntent("zero")).toBeNull();
    expect(parseVoiceIntent("0")).toBeNull();
    expect(parseVoiceIntent("31")).toBeNull();
    expect(parseVoiceIntent("thirty one")).toBeNull();
    expect(parseVoiceIntent("99")).toBeNull();
  });

  test("rejects chatter and empty transcripts", () => {
    expect(parseVoiceIntent("")).toBeNull();
    expect(parseVoiceIntent("that was a hard set")).toBeNull();
    expect(parseVoiceIntent("start the timer please")).toBeNull();
    expect(parseVoiceIntent("okay eight")).toBeNull();
  });

  test("is case and punctuation insensitive", () => {
    expect(parseVoiceIntent("  EIGHT ")).toEqual({ type: "reps", value: 8 });
    expect(parseVoiceIntent("Twenty two!")).toEqual({ type: "reps", value: 22 });
  });
});
