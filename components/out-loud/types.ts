export type VoiceReply = {
  id: string;
  memoId: string;
  name: string | null;
  durationMs: number;
  blobUrl: string;
  blobPathname: string;
  createdAt: string;
};

export type VoiceMemo = {
  id: string;
  slug: string;
  kind: "person" | "thought";
  title: string;
  recordedAt: string;
  durationMs: number;
  blobUrl: string;
  replyCount: number;
};
