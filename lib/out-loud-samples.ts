import "server-only";

import type { VoiceMemo, VoiceReply } from "@/lib/voice-memos";

const MEMO_RECORDED_AT = "2026-09-19T18:12:00.000Z";
const REPLY_CREATED_AT = "2026-09-19T19:04:00.000Z";

export const SAMPLE_MEMOS: VoiceMemo[] = [
  {
    id: "sample-for-daniel",
    slug: "for-daniel",
    kind: "person",
    title: "Daniel",
    recordedAt: MEMO_RECORDED_AT,
    durationMs: 12_225,
    blobUrl: "/out-loud/sample-for-daniel.mp3",
    blobPathname: "out-loud/sample-for-daniel.mp3",
    published: true,
    createdAt: MEMO_RECORDED_AT,
    replyCount: 1,
  },
];

const SAMPLE_REPLIES: VoiceReply[] = [
  {
    id: "sample-reply-daniel",
    memoId: "sample-for-daniel",
    name: "internet human",
    durationMs: 4_310,
    blobUrl: "/out-loud/sample-reply.mp3",
    blobPathname: "out-loud/sample-reply.mp3",
    createdAt: REPLY_CREATED_AT,
  },
];

export function isSampleMemoId(id: string) {
  return SAMPLE_MEMOS.some((memo) => memo.id === id);
}

export function sampleMemoBySlug(slug: string) {
  return SAMPLE_MEMOS.find((memo) => memo.slug === slug) ?? null;
}

export function sampleRepliesForMemo(memoId: string) {
  return SAMPLE_REPLIES.filter((reply) => reply.memoId === memoId);
}

export function workshopMemosIfEmpty(memos: VoiceMemo[]) {
  return memos.length ? memos : SAMPLE_MEMOS;
}
