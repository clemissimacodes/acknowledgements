"use client";

import { useEffect, useState } from "react";
import { MemoPlayer } from "./MemoPlayer";
import { PlaybackProvider, usePlayback } from "./Playback";
import type { VoiceMemo, VoiceReply } from "./types";
import { VoiceRecorder } from "./VoiceRecorder";
import { VoiceReplyList } from "./VoiceReplyList";

type MemoListenProps = {
  memo: VoiceMemo;
  initialReplies: VoiceReply[];
  admin: boolean;
};

function MemoListenInner({ memo, initialReplies, admin }: MemoListenProps) {
  const { setQueue, stop, activeId } = usePlayback();
  const [replies, setReplies] = useState(initialReplies);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setQueue([
      { id: memo.id, src: memo.blobUrl },
      ...replies.map((reply) => ({ id: reply.id, src: reply.blobUrl })),
    ]);
  }, [memo.blobUrl, memo.id, replies, setQueue]);

  async function remove(reply: VoiceReply) {
    if (!window.confirm("Permanently delete this voice reply?")) return;
    setBusyId(reply.id);
    setError("");
    try {
      const response = await fetch(`/api/out-loud/replies/${reply.id}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "The reply could not be deleted.");
        return;
      }
      if (activeId === reply.id) stop();
      setReplies((current) => current.filter((item) => item.id !== reply.id));
    } catch {
      setError("The reply could not be deleted.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <MemoPlayer
        id={memo.id}
        src={memo.blobUrl}
        durationMs={memo.durationMs}
        label={memo.kind === "person" && memo.title ? `for ${memo.title}` : memo.title || "thought"}
      />
      <section className="out-loud-thread" aria-labelledby="out-loud-replies-title">
        <h2 id="out-loud-replies-title">Voices back</h2>
        <p className="out-loud-thread-copy">
          Playing one voice stops another. You do not have to wait through the
          whole chain.
        </p>
        {error ? (
          <p className="out-loud-error" role="status">
            {error}
          </p>
        ) : null}
        <VoiceReplyList
          replies={replies}
          admin={admin}
          busyId={busyId}
          onDelete={(reply) => void remove(reply)}
        />
        <VoiceRecorder
          memoId={memo.id}
          memoSlug={memo.slug}
          onCreated={(reply) =>
            setReplies((current) =>
              current.some((item) => item.id === reply.id)
                ? current
                : [...current, reply],
            )
          }
        />
      </section>
    </>
  );
}

export function MemoListen(props: MemoListenProps) {
  return (
    <PlaybackProvider>
      <MemoListenInner {...props} />
    </PlaybackProvider>
  );
}
