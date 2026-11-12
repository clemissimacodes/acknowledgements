export const RECORDING_FOLDERS = ["notes", "singing", "stories", "dreams"] as const;
export type RecordingFolder = (typeof RECORDING_FOLDERS)[number];

export const FOLDER_LABELS: Record<RecordingFolder, string> = {
  notes: "Need to Remember This Stuff",
  singing: "Part Clemi, Part Hummingbird",
  stories: "I’m So Rich",
  dreams: "My Dreams",
};

export type RecordingView = "all" | "favorites" | RecordingFolder;

export const VIEW_LABELS: Record<RecordingView, string> = {
  all: "All Recordings",
  favorites: "Favorites",
  notes: FOLDER_LABELS.notes,
  singing: FOLDER_LABELS.singing,
  stories: FOLDER_LABELS.stories,
  dreams: FOLDER_LABELS.dreams,
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

/** Notes are typed responses, replies are voice responses. Either can answer
    the recording itself or another response. */
export type ResponseKind = "note" | "reply";

export function isResponseKind(value: unknown): value is ResponseKind {
  return value === "note" || value === "reply";
}

export function responseKey(kind: ResponseKind, id: string) {
  return `${kind}:${id}`;
}

type ResponseFields = {
  id: string;
  recordingId: string;
  name: string | null;
  createdAt: string;
  parentKind: ResponseKind | null;
  parentId: string | null;
  byOwner: boolean;
  hearts: number;
  ownerHearted: boolean;
};

export type RecordingNote = ResponseFields & {
  body: string;
};

export type RecordingReply = ResponseFields & {
  durationMs: number;
  url: string;
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
