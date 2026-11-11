export const RECORDING_FOLDERS = ["notes", "singing"] as const;
export type RecordingFolder = (typeof RECORDING_FOLDERS)[number];

export const FOLDER_LABELS: Record<RecordingFolder, string> = {
  notes: "Notes to Self",
  singing: "Singing",
};

export type RecordingView = "all" | "favorites" | RecordingFolder;

export const VIEW_LABELS: Record<RecordingView, string> = {
  all: "All Recordings",
  favorites: "Favorites",
  notes: FOLDER_LABELS.notes,
  singing: FOLDER_LABELS.singing,
};

export const RECORDING_MAX_MS = 2 * 60 * 60_000;
export const RECORDING_MAX_BYTES = 200 * 1024 * 1024;
export const REPLY_MAX_MS = 60_000;
export const REPLY_MAX_BYTES = 3 * 1024 * 1024;
export const NOTE_MAX_LENGTH = 500;
export const PEAK_COUNT = 1200;

export type Recording = {
  id: string;
  slug: string;
  title: string;
  folder: RecordingFolder;
  recordedAt: string;
  durationMs: number;
  url: string;
  peaks: number[] | null;
  favorite: boolean;
  hearts: number;
  noteCount: number;
  replyCount: number;
  deletedAt: string | null;
};

export type RecordingNote = {
  id: string;
  recordingId: string;
  name: string | null;
  body: string;
  createdAt: string;
};

export type RecordingReply = {
  id: string;
  recordingId: string;
  name: string | null;
  durationMs: number;
  url: string;
  createdAt: string;
};

export function isRecordingFolder(value: unknown): value is RecordingFolder {
  return RECORDING_FOLDERS.includes(value as RecordingFolder);
}

/** 19:38 or 1:02:08, like the list column in Voice Memos. */
export function formatClock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/** 00:00.00 — the big playhead readout. */
export function formatPlayhead(seconds: number) {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const rest = safe - minutes * 60;
  const whole = Math.floor(rest);
  const hundredths = Math.floor((rest - whole) * 100);
  return `${String(minutes).padStart(2, "0")}:${String(whole).padStart(2, "0")}.${String(hundredths).padStart(2, "0")}`;
}

export function formatRecordingDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Los_Angeles",
  }).format(new Date(value));
}

export function formatRecordingTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Los_Angeles",
  }).format(new Date(value));
}
