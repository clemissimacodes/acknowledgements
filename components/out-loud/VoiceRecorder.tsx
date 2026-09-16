"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  fileFromRecording,
  pickRecorderMime,
  VISITOR_MAX_MS,
} from "./record";
import { uploadVoiceFile } from "./upload";
import type { VoiceReply } from "./types";

const NAME_KEY = "clemissima-out-loud-name";

type VoiceRecorderProps = {
  memoSlug: string;
  memoId: string;
  onCreated: (reply: VoiceReply) => void;
};

export function VoiceRecorder({
  memoSlug,
  memoId,
  onCreated,
}: VoiceRecorderProps) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [holding, setHolding] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const maxTimerRef = useRef<number>(0);
  const tickRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const abortRef = useRef(false);
  const honeyRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(window.localStorage.getItem(NAME_KEY)?.trim() ?? "");
    return () => stopStream();
  }, []);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const finish = useCallback(
    async (blob: Blob, durationMs: number) => {
      if (durationMs < 800) {
        setError("Hold a little longer.");
        return;
      }
      setBusy(true);
      setError("");
      try {
        const file = fileFromRecording(blob, "reply");
        const uploaded = await uploadVoiceFile(file, {
          role: "reply",
          memoId,
        });
        const response = await fetch("/api/out-loud/replies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            memo: memoSlug,
            name,
            durationMs,
            url: uploaded.url,
            pathname: uploaded.pathname,
            website: honeyRef.current?.value ?? "",
          }),
        });
        const data = (await response.json()) as {
          reply?: VoiceReply;
          error?: string;
        };
        if (!response.ok || !data.reply) {
          setError(data.error ?? "The reply could not be kept.");
          return;
        }
        if (name.trim()) {
          window.localStorage.setItem(NAME_KEY, name.trim());
        } else {
          window.localStorage.removeItem(NAME_KEY);
        }
        onCreated(data.reply);
      } catch {
        setError("The reply could not be kept.");
      } finally {
        setBusy(false);
      }
    },
    [memoId, memoSlug, name, onCreated],
  );

  const stopRecording = useCallback(() => {
    abortRef.current = true;
    window.clearInterval(tickRef.current);
    window.clearTimeout(maxTimerRef.current);
    setHolding(false);
    const recorder = mediaRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    } else {
      stopStream();
    }
  }, [stopStream]);

  const startRecording = useCallback(async () => {
    if (busy || holding) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser will not record.");
      return;
    }
    setError("");
    abortRef.current = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (abortRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      const mime = pickRecorderMime();
      const recorder = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      });
      recorder.addEventListener("stop", () => {
        const durationMs = Date.now() - startedAtRef.current;
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        mediaRef.current = null;
        stopStream();
        void finish(blob, durationMs);
      });
      mediaRef.current = recorder;
      startedAtRef.current = Date.now();
      setElapsed(0);
      setHolding(true);
      recorder.start(250);
      tickRef.current = window.setInterval(() => {
        setElapsed(Date.now() - startedAtRef.current);
      }, 200);
      maxTimerRef.current = window.setTimeout(() => {
        stopRecording();
      }, VISITOR_MAX_MS);
    } catch {
      stopStream();
      setError("Microphone permission is needed to reply.");
    }
  }, [busy, finish, holding, stopRecording, stopStream]);

  function onPointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    void startRecording();
  }

  function onPointerUp() {
    stopRecording();
  }

  return (
    <div className="out-loud-recorder">
      <p className="out-loud-recorder-copy">
        Hold to speak back. Your voice is public.
      </p>
      <input
        value={name}
        maxLength={60}
        autoComplete="nickname"
        placeholder="your earthly name or alter ego"
        aria-label="Name, optional"
        onChange={(event) => setName(event.target.value)}
      />
      <input
        className="out-loud-honeypot"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        ref={honeyRef}
      />
      <button
        className={`out-loud-hold${holding ? " is-holding" : ""}`}
        type="button"
        disabled={busy}
        aria-pressed={holding}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onContextMenu={(event) => event.preventDefault()}
      >
        {busy
          ? "Keeping…"
          : holding
            ? `Release · ${Math.max(0, Math.ceil((VISITOR_MAX_MS - elapsed) / 1000))}s`
            : "Hold to reply"}
      </button>
      {error ? (
        <p className="out-loud-error" role="status">
          {error}
        </p>
      ) : null}
    </div>
  );
}
