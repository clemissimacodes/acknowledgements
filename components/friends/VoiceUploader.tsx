"use client";

import { upload } from "@vercel/blob/client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { attachFriendVoice, clearFriendVoiceForm } from "@/app/(shop)/actions";
import {
  FRIEND_VOICE_MAX_BYTES,
  normalizeVoiceContentType,
} from "@/lib/friend-types";
import { voiceNoteScript, voiceNoteScriptHint } from "@/lib/voice-note-script";
import {
  extensionForAudio,
  fileFromRecording,
  measureAudioDuration,
  pickRecorderMime,
} from "@/components/voice-memos/record";

type Props = {
  id: string;
  nickname: string;
  currentUrl: string | null;
  currentDurationMs: number | null;
};

type Draft = {
  file: File;
  url: string;
  durationMs: number | null;
};

function formatDuration(ms: number | null) {
  if (!ms || ms <= 0) return "";
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function prepareVoiceFile(file: File) {
  const type = normalizeVoiceContentType(file);
  if (!type) return null;
  if (file.size > FRIEND_VOICE_MAX_BYTES) return "too-large" as const;
  const ext = extensionForAudio(type, file.name);
  const base = file.name.replace(/\.[^.]+$/, "") || "voice";
  // Always rebuild so codec suffixes like `;codecs=opus` never reach Blob.
  return new File([file], `${base}.${ext}`, { type });
}

/* Record on the spot — script beside the mic, uploads as soon as you stop. */
export function VoiceUploader({ id, nickname, currentUrl, currentDurationMs }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const draftUrlRef = useRef<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const script = voiceNoteScript(nickname);
  const hint = voiceNoteScriptHint(nickname);

  useEffect(() => {
    if (!recording) return;
    const started = Date.now();
    const tick = window.setInterval(() => setElapsedMs(Date.now() - started), 200);
    return () => window.clearInterval(tick);
  }, [recording]);

  useEffect(() => {
    return () => {
      stopStream();
      if (draftUrlRef.current) URL.revokeObjectURL(draftUrlRef.current);
    };
  }, []);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    mediaRef.current = null;
  };

  const clearDraft = () => {
    if (draftUrlRef.current) {
      URL.revokeObjectURL(draftUrlRef.current);
      draftUrlRef.current = null;
    }
    setDraft(null);
  };

  const holdDraft = async (file: File) => {
    const prepared = prepareVoiceFile(file);
    if (prepared === null) {
      setError("Use an audio file (m4a, mp3, wav, webm…).");
      return null;
    }
    if (prepared === "too-large") {
      setError("That recording is over 20 MB.");
      return null;
    }
    const durationMs = await measureAudioDuration(prepared).catch(() => null);
    if (draftUrlRef.current) URL.revokeObjectURL(draftUrlRef.current);
    const url = URL.createObjectURL(prepared);
    draftUrlRef.current = url;
    const next = { file: prepared, url, durationMs };
    setDraft(next);
    return next;
  };

  const publish = async (incoming: File | Draft) => {
    const held =
      "file" in incoming && "url" in incoming
        ? incoming
        : await holdDraft(incoming);
    if (!held) return;

    setBusy(true);
    setError("");
    try {
      const ext = extensionForAudio(held.file.type, held.file.name);
      const type = normalizeVoiceContentType(held.file) || held.file.type;
      const blob = await upload(`friends-and-family/${id}/voice.${ext}`, held.file, {
        access: "public",
        handleUploadUrl: "/api/friends/upload",
        contentType: type,
      });
      await attachFriendVoice({
        id,
        url: blob.url,
        pathname: blob.pathname,
        durationMs: held.durationMs,
      });
      clearDraft();
      router.refresh();
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : "Upload failed — tap retry, your take is still here.";
      setError(message);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const startRecording = async () => {
    setError("");
    clearDraft();
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("This browser can’t record audio — upload a file instead.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = pickRecorderMime();
      const recorder = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const type = recorder.mimeType || mime || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        stopStream();
        setRecording(false);
        void publish(fileFromRecording(blob, `voice-${id}`));
      };
      mediaRef.current = recorder;
      recorder.start(250);
      setElapsedMs(0);
      setRecording(true);
    } catch {
      stopStream();
      setError("Microphone permission denied — upload a file instead.");
    }
  };

  const stopRecording = () => {
    const recorder = mediaRef.current;
    if (!recorder || recorder.state === "inactive") {
      stopStream();
      setRecording(false);
      return;
    }
    recorder.stop();
  };

  const copyScript = async () => {
    try {
      await navigator.clipboard.writeText(script);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setError("Couldn’t copy — read it from the card.");
    }
  };

  return (
    <div className="admin-drop-wrap admin-voice-wrap">
      <div className="admin-voice-script">
        <div className="admin-voice-script-head">
          <strong>Light script</strong>
          <button type="button" onClick={() => void copyScript()}>
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <p className="admin-voice-script-hint">{hint}</p>
        <pre className="admin-voice-script-body">{script}</pre>
      </div>

      {draft && !recording ? (
        <div className={`admin-drop admin-voice-drop${busy ? " is-busy" : ""}`}>
          <span className="admin-drop-label">
            <strong>{busy ? "Saving…" : "Take ready"}</strong>
            <small>
              {busy
                ? "Uploading — they’ll unwrap it like a present…"
                : `Held here${draft.durationMs ? ` · ${formatDuration(draft.durationMs)}` : ""}. Retry if upload fails — you won’t lose it.`}
            </small>
          </span>
          <audio controls src={draft.url} preload="metadata" />
          <div className="admin-voice-actions">
            <button
              type="button"
              className="admin-voice-confirm"
              disabled={busy}
              onClick={() => void publish(draft)}
            >
              {busy ? "Saving…" : error ? "Retry upload" : "Save to their page"}
            </button>
            <button type="button" disabled={busy} onClick={clearDraft}>
              Discard
            </button>
          </div>
        </div>
      ) : (
        <div className={`admin-drop admin-voice-drop${busy || recording ? " is-busy" : ""}`}>
          <span className="admin-drop-label">
            <strong>
              {recording
                ? `Recording… ${formatDuration(elapsedMs)}`
                : busy
                  ? "Saving…"
                  : currentUrl
                    ? `Voice note for ${nickname}`
                    : `Record for ${nickname}`}
            </strong>
            <small>
              {recording
                ? "Tap stop when you’re done — it uploads right away."
                : busy
                  ? "Uploading to their product page…"
                  : currentUrl
                    ? `Live as a gift on their page${currentDurationMs ? ` · ${formatDuration(currentDurationMs)}` : ""}. Record again to replace.`
                    : "One tap to record. Stop when you’re done — saves and goes live."}
            </small>
          </span>
          {currentUrl && !recording && !busy ? (
            <audio controls src={currentUrl} preload="metadata" />
          ) : null}
          <div className="admin-voice-actions">
            {recording ? (
              <button type="button" className="admin-voice-confirm admin-voice-record" onClick={stopRecording}>
                Stop &amp; save
              </button>
            ) : (
              <button
                type="button"
                className="admin-voice-confirm admin-voice-record"
                disabled={busy}
                onClick={() => void startRecording()}
              >
                {currentUrl ? "Record again" : "Record now"}
              </button>
            )}
            <button
              type="button"
              disabled={busy || recording}
              onClick={() => inputRef.current?.click()}
            >
              Upload file
            </button>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="audio/*,.m4a,.mp3,.wav,.aac,.ogg,.webm"
            disabled={busy || recording}
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void publish(file);
            }}
          />
        </div>
      )}
      {error ? <em className="admin-drop-error">{error}</em> : null}
      {currentUrl && !busy && !recording && !draft ? (
        <form action={clearFriendVoiceForm} className="admin-drop-remove">
          <input type="hidden" name="id" value={id} />
          <button type="submit">Remove</button>
        </form>
      ) : null}
    </div>
  );
}
