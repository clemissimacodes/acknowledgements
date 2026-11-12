"use client";

import { useMemo, useRef, useState } from "react";
import {
  formatClock,
  formatRecordingDate,
  responseKey,
  type RecordingNote,
  type RecordingReply,
  type ResponseKind,
} from "@/lib/recording-types";
import { CloseIcon, HeartIcon, PauseIcon, PlayIcon } from "./Icons";
import { ReplyRecorder } from "./ReplyRecorder";
import styles from "./VoiceMemos.module.css";

type Item =
  | { kind: "note"; data: RecordingNote }
  | { kind: "reply"; data: RecordingReply };

export type HeartResult = { hearted: boolean; hearts: number; ownerHearted: boolean };

type Props = {
  recordingId: string;
  notes: RecordingNote[];
  replies: RecordingReply[];
  isOwner: boolean;
  heartedKeys: Set<string>;
  name: string;
  onNameChange: (name: string) => void;
  onNoteCreated: (note: RecordingNote) => void;
  onReplyCreated: (reply: RecordingReply) => void;
  onHeart: (kind: ResponseKind, id: string) => void;
  onDelete: (kind: ResponseKind, id: string) => void;
};

/* Past this depth replies stop stepping right, so deep threads still fit a phone. */
const MAX_INDENT = 4;

export function ResponseThread(props: Props) {
  const { notes, replies } = props;
  const children = useMemo(() => {
    const map = new Map<string, Item[]>();
    const items: Item[] = [
      ...notes.map((data) => ({ kind: "note" as const, data })),
      ...replies.map((data) => ({ kind: "reply" as const, data })),
    ].sort((a, b) => a.data.createdAt.localeCompare(b.data.createdAt));
    const known = new Set(items.map((item) => responseKey(item.kind, item.data.id)));
    for (const item of items) {
      const { parentKind, parentId } = item.data;
      const parent =
        parentKind && parentId && known.has(responseKey(parentKind, parentId))
          ? responseKey(parentKind, parentId)
          : "root";
      map.set(parent, [...(map.get(parent) ?? []), item]);
    }
    return map;
  }, [notes, replies]);

  const roots = children.get("root") ?? [];
  if (!roots.length) {
    return <p className={styles.panelEmpty}>be the first to reply!</p>;
  }
  return (
    <ul className={styles.thread}>
      {roots.map((item) => (
        <ResponseItem
          key={responseKey(item.kind, item.data.id)}
          item={item}
          depth={0}
          childrenOf={children}
          {...props}
        />
      ))}
    </ul>
  );
}

function ResponseItem({
  item,
  depth,
  childrenOf,
  ...props
}: Props & { item: Item; depth: number; childrenOf: Map<string, Item[]> }) {
  const { isOwner, heartedKeys, onHeart, onDelete } = props;
  const [replying, setReplying] = useState(false);
  const key = responseKey(item.kind, item.data.id);
  const kids = childrenOf.get(key) ?? [];
  const mine = isOwner ? item.data.ownerHearted : heartedKeys.has(key);

  return (
    <li className={styles.threadItem}>
      <p className={styles.noteMeta}>
        {item.data.byOwner ? (
          <span className={styles.clemTag}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/clemi/mini.png" alt="" width={18} height={18} />
            <strong>clemi</strong>
          </span>
        ) : (
          <strong>{item.data.name ?? "someone"}</strong>
        )}
        <span>{formatRecordingDate(item.data.createdAt)}</span>
        {isOwner ? (
          <button
            type="button"
            className={styles.remove}
            aria-label={kids.length ? "Delete this and its replies" : "Delete"}
            onClick={() => onDelete(item.kind, item.data.id)}
          >
            <CloseIcon size={11} />
          </button>
        ) : null}
      </p>

      {item.kind === "note" ? (
        <p className={styles.noteBody}>{item.data.body}</p>
      ) : (
        <ReplyRow reply={item.data} />
      )}

      <div className={styles.threadActions}>
        <button
          type="button"
          className={`${styles.threadHeart}${isOwner ? ` ${styles.threadHeartOwner}` : ""}`}
          aria-pressed={mine}
          aria-label={mine ? "Remove heart" : "Heart"}
          onClick={() => onHeart(item.kind, item.data.id)}
        >
          <HeartIcon size={13} filled={mine} />
          {item.data.hearts ? <span>{item.data.hearts}</span> : null}
        </button>
        {item.data.ownerHearted && !isOwner ? (
          <span className={styles.clemHeart} title="clemi loved this">
            <HeartIcon size={12} filled />
          </span>
        ) : null}
        <button
          type="button"
          className={styles.threadReply}
          aria-expanded={replying}
          onClick={() => setReplying((value) => !value)}
        >
          {replying ? "cancel" : "reply"}
        </button>
      </div>

      {replying ? (
        <InlineReply
          {...props}
          parent={{ kind: item.kind, id: item.data.id }}
          to={item.data.byOwner ? "clemi" : item.data.name ?? "someone"}
          onDone={() => setReplying(false)}
        />
      ) : null}

      {kids.length ? (
        <ul className={`${styles.thread} ${depth < MAX_INDENT ? styles.threadNested : styles.threadFlat}`}>
          {kids.map((child) => (
            <ResponseItem
              key={responseKey(child.kind, child.data.id)}
              item={child}
              depth={depth + 1}
              childrenOf={childrenOf}
              {...props}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function InlineReply({
  recordingId,
  isOwner,
  name,
  onNameChange,
  onNoteCreated,
  onReplyCreated,
  parent,
  to,
  onDone,
}: Props & { parent: { kind: ResponseKind; id: string }; to: string; onDone: () => void }) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const honeyRef = useRef<HTMLInputElement>(null);

  async function post(event: React.FormEvent) {
    event.preventDefault();
    if (busy || body.trim().length < 2) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/voice-memos/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: recordingId,
          name,
          body,
          website: honeyRef.current?.value ?? "",
          parentKind: parent.kind,
          parentId: parent.id,
        }),
      });
      const data = (await response.json()) as { note?: RecordingNote | null; error?: string };
      if (!response.ok) {
        setError(data.error ?? "Try again.");
        return;
      }
      if (data.note) onNoteCreated(data.note);
      if (name.trim()) window.localStorage.setItem("clemissima-note-name", name.trim());
      setBody("");
      onDone();
    } catch {
      setError("Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.inlineReply}>
      <form className={styles.inlineReplyForm} onSubmit={(event) => void post(event)}>
        {isOwner ? null : (
          <input
            value={name}
            maxLength={60}
            autoComplete="nickname"
            placeholder="name"
            aria-label="Name, optional"
            className={styles.inlineReplyName}
            onChange={(event) => onNameChange(event.target.value)}
          />
        )}
        <input
          value={body}
          maxLength={500}
          autoFocus
          placeholder={`reply to ${to}`}
          aria-label={`Reply to ${to}`}
          className={styles.inlineReplyBody}
          onChange={(event) => setBody(event.target.value)}
        />
        <input
          ref={honeyRef}
          className={styles.honeypot}
          name="website"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
        />
        <button type="submit" disabled={busy || body.trim().length < 2}>
          {busy ? "…" : "post"}
        </button>
      </form>
      <ReplyRecorder
        recordingId={recordingId}
        name={name}
        onNameChange={onNameChange}
        onCreated={(reply) => {
          onReplyCreated(reply);
          onDone();
        }}
        parent={parent}
        showName={false}
      />
      {error ? (
        <p className={styles.formError} role="status">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function ReplyRow({ reply }: { reply: RecordingReply }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) void audio.play().catch(() => undefined);
    else audio.pause();
  }

  return (
    <div className={styles.reply}>
      <audio
        ref={audioRef}
        src={reply.url}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setProgress(0);
        }}
        onTimeUpdate={(event) => {
          const audio = event.currentTarget;
          setProgress(audio.duration ? audio.currentTime / audio.duration : 0);
        }}
      />
      <button
        type="button"
        className={styles.replyPlay}
        aria-label={playing ? "Pause reply" : "Play reply"}
        onClick={toggle}
      >
        {playing ? <PauseIcon size={16} /> : <PlayIcon size={16} />}
      </button>
      <span className={styles.replyBar} aria-hidden="true">
        <span style={{ width: `${progress * 100}%` }} />
      </span>
      <span className={styles.replyMeta}>
        <span>{formatClock(reply.durationMs)}</span>
      </span>
    </div>
  );
}
