import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SAMPLE_RATE = 44_100;
const DURATION_SECONDS = 0.52;
const SAMPLE_COUNT = Math.round(SAMPLE_RATE * DURATION_SECONDS);
const OUTPUT_PATH = resolve(dirname(fileURLToPath(import.meta.url)), "../assets/rest-done.wav");

const tones = [
  { frequency: 523.25, start: 0, gain: 0.72, decay: 8.2 },
  { frequency: 783.99, start: 0.16, gain: 0.68, decay: 8.8 }
];
const samples = new Int16Array(SAMPLE_COUNT);

for (let index = 0; index < SAMPLE_COUNT; index += 1) {
  const time = index / SAMPLE_RATE;
  let value = 0;

  for (const tone of tones) {
    const localTime = time - tone.start;

    if (localTime < 0) {
      continue;
    }

    const attack = Math.min(1, localTime / 0.006);
    const envelope = attack * Math.exp(-tone.decay * localTime);
    const phase = 2 * Math.PI * tone.frequency * localTime;
    const fundamental = Math.sin(phase);
    const woodyHarmonic = 0.22 * Math.sin(phase * 3) * Math.exp(-18 * localTime);
    value += tone.gain * envelope * (fundamental + woodyHarmonic);
  }

  samples[index] = Math.round(Math.max(-1, Math.min(1, value * 0.78)) * 32_767);
}

const dataSize = samples.byteLength;
const wav = Buffer.alloc(44 + dataSize);
wav.write("RIFF", 0);
wav.writeUInt32LE(36 + dataSize, 4);
wav.write("WAVE", 8);
wav.write("fmt ", 12);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(SAMPLE_RATE, 24);
wav.writeUInt32LE(SAMPLE_RATE * 2, 28);
wav.writeUInt16LE(2, 32);
wav.writeUInt16LE(16, 34);
wav.write("data", 36);
wav.writeUInt32LE(dataSize, 40);

for (let index = 0; index < samples.length; index += 1) {
  wav.writeInt16LE(samples[index], 44 + index * 2);
}

mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
writeFileSync(OUTPUT_PATH, wav);
