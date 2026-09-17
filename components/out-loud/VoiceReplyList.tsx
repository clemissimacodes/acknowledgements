"use client";

import { formatVoiceDate } from "@/lib/format";
import { ClipPlayer } from "./ClipPlayer";
import type { VoiceReply } from "./types";

export function VoiceReplyList({
  replies,
  admin,
  busyId,
  onDelete,
}: {
  replies: VoiceReply[];
  admin: boolean;
  busyId: string | null;
  onDelete: (reply: VoiceReply) => void;
}) {
  if (!replies.length) {
    return (
      <p className="out-loud-empty-replies">No voices back yet.</p>
    );
  }

  return (
    <ol className="out-loud-replies">
      {replies.map((reply) => (
        <li key={reply.id}>
          <ClipPlayer
            clip={{ id: reply.id, src: reply.blobUrl }}
            durationMs={reply.durationMs}
            label={reply.name || "internet human"}
            extra={
              <p className="out-loud-reply-date">
                {formatVoiceDate(reply.createdAt)}
              </p>
            }
          />
          {admin ? (
            <button
              className="out-loud-delete"
              type="button"
              disabled={busyId === reply.id}
              onClick={() => onDelete(reply)}
            >
              Delete
            </button>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
