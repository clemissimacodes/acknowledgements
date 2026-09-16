export const VISITOR_MAX_MS = 60_000;
export const MEMO_MAX_MS = 10 * 60_000;

const RECORDER_TYPES = [
  "audio/mp4",
  "audio/webm;codecs=opus",
  "audio/webm",
];

export function pickRecorderMime() {
  if (typeof MediaRecorder === "undefined") return "";
  return RECORDER_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

export function extensionForAudio(mime: string, filename = "") {
  const type = mime.toLowerCase();
  if (type.includes("mp4") || type.includes("m4a") || type.includes("aac")) {
    return "m4a";
  }
  if (type.includes("mpeg") || type.includes("mp3")) return "mp3";
  if (type.includes("wav")) return "wav";
  if (type.includes("ogg")) return "ogg";
  const fromName = filename.split(".").pop()?.toLowerCase() ?? "";
  if (/^[a-z0-9]{2,4}$/.test(fromName) && fromName !== filename.toLowerCase()) {
    return fromName;
  }
  return "webm";
}

export function fileFromRecording(blob: Blob, basename: string) {
  const type = blob.type || "audio/webm";
  return new File([blob], `${basename}.${extensionForAudio(type)}`, { type });
}

export function measureAudioDuration(file: File) {
  return new Promise<number>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    const finish = (ms: number | null, error?: Error) => {
      URL.revokeObjectURL(url);
      if (error || ms === null) {
        reject(error ?? new Error("Could not read that recording."));
        return;
      }
      resolve(ms);
    };
    audio.preload = "metadata";
    audio.addEventListener("loadedmetadata", () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        finish(Math.round(audio.duration * 1000));
      } else {
        finish(null, new Error("Could not read that recording."));
      }
    });
    audio.addEventListener("error", () => {
      finish(null, new Error("Could not read that recording."));
    });
    audio.src = url;
  });
}
