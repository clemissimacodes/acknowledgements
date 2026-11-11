import { upload } from "@vercel/blob/client";
import { extensionForAudio } from "@/components/out-loud/record";
import { PEAK_COUNT } from "@/lib/recording-types";

export {
  fileFromRecording,
  pickRecorderMime,
  measureAudioDuration,
} from "@/components/out-loud/record";

export type Silence = { start: number; end: number };

type AudioContextCtor = typeof AudioContext;

function audioContext() {
  const Ctor: AudioContextCtor | undefined =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioContextCtor })
      .webkitAudioContext;
  if (!Ctor) throw new Error("Web Audio is unavailable.");
  return new Ctor();
}

export async function decodeAudio(source: ArrayBuffer | Blob) {
  const bytes =
    source instanceof ArrayBuffer ? source : await source.arrayBuffer();
  const context = audioContext();
  try {
    return await context.decodeAudioData(bytes.slice(0));
  } finally {
    void context.close().catch(() => undefined);
  }
}

function mixdown(buffer: AudioBuffer) {
  const channels = buffer.numberOfChannels;
  if (channels === 1) return buffer.getChannelData(0);
  const out = new Float32Array(buffer.length);
  for (let c = 0; c < channels; c += 1) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < data.length; i += 1) out[i] += data[i] / channels;
  }
  return out;
}

/** Peak amplitude per bucket, 0–100, normalized so the loudest bucket is 100. */
export function computePeaks(buffer: AudioBuffer, count = PEAK_COUNT) {
  const samples = mixdown(buffer);
  const size = Math.max(1, Math.floor(samples.length / count));
  const peaks = new Array<number>(count).fill(0);
  let max = 0;
  for (let i = 0; i < count; i += 1) {
    const start = i * size;
    const end = Math.min(samples.length, start + size);
    let peak = 0;
    for (let j = start; j < end; j += 1) {
      const value = Math.abs(samples[j]);
      if (value > peak) peak = value;
    }
    peaks[i] = peak;
    if (peak > max) max = peak;
  }
  const scale = max > 0 ? 100 / max : 0;
  return peaks.map((peak) => Math.round(peak * scale));
}

/** Stretches of near-silence long enough to be worth skipping. */
export function findSilences(buffer: AudioBuffer): Silence[] {
  const samples = mixdown(buffer);
  const rate = buffer.sampleRate;
  const window = Math.floor(rate * 0.02);
  const windows = Math.floor(samples.length / window);
  const rms = new Float32Array(windows);
  for (let w = 0; w < windows; w += 1) {
    let sum = 0;
    const start = w * window;
    for (let i = start; i < start + window; i += 1) sum += samples[i] * samples[i];
    rms[w] = Math.sqrt(sum / window);
  }
  const sorted = Array.from(rms).sort((a, b) => a - b);
  const loud = sorted[Math.floor(sorted.length * 0.9)] ?? 0;
  const threshold = Math.max(0.004, loud * 0.06);
  const minLength = 0.65;
  const pad = 0.12;
  const result: Silence[] = [];
  let runStart = -1;
  for (let w = 0; w <= windows; w += 1) {
    const quiet = w < windows && rms[w] < threshold;
    if (quiet && runStart < 0) runStart = w;
    if (!quiet && runStart >= 0) {
      const start = (runStart * window) / rate;
      const end = (w * window) / rate;
      if (end - start >= minLength) {
        result.push({ start: start + pad, end: end - pad });
      }
      runStart = -1;
    }
  }
  return result;
}

export type UploadRole =
  | { role: "recording" }
  | { role: "reply"; recordingId: string };

export async function uploadRecordingFile(file: File, payload: UploadRole) {
  const type = file.type || `audio/${extensionForAudio("", file.name)}`;
  const normalized =
    file.type === type
      ? file
      : new File([file], file.name || `clip.${extensionForAudio(type)}`, { type });
  const ext = extensionForAudio(normalized.type, normalized.name);
  const pathname =
    payload.role === "recording"
      ? `voice-memos/recordings/${crypto.randomUUID()}.${ext}`
      : `voice-memos/replies/${payload.recordingId}/${crypto.randomUUID()}.${ext}`;
  return upload(pathname, normalized, {
    access: "public",
    handleUploadUrl: "/api/voice-memos/upload",
    clientPayload: JSON.stringify(payload),
  });
}
