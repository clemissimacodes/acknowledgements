"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { REPLY_MAX_MS, type RecordingReply } from "@/lib/recording-types";
import { fileFromRecording, pickRecorderMime, uploadRecordingFile } from "./audio";
import styles from "./VoiceMemos.module.css";

type Props = {
  recordingId: string;
  name: string;
  onNameChange: (name: string) => void;
  onCreated: (reply: RecordingReply) => void;
};

export function ReplyRecorder({ recordingId, name, onNameChange, onCreated }: Props) {
  const [busy, setBusy] = useState(false);
  const [holding, setHolding] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const tickRef = useRef(0);
  const maxTimerRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);
  const abortRef = useRef(false);
  const honeyRef = useRef<HTMLInputElement>(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => () => stopStream(), [stopStream]);

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
        const uploaded = await uploadRecordingFile(file, { role: "reply", recordingId });
        const response = await fetch("/api/voice-memos/replies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: recordingId,
            name,
            durationMs,
            url: uploaded.url,
            pathname: uploaded.pathname,
            website: honeyRef.current?.value ?? "",
          }),
        });
        const data = (await response.json()) as {
          reply?: RecordingReply | null;
          error?: string;
        };
        if (!response.ok) {
          setError(data.error ?? "The reply could not be kept.");
          return;
        }
        if (data.reply) onCreated(data.reply);
        if (name.trim()) {
          window.localStorage.setItem("clemissima-note-name", name.trim());
        }
      } catch {
        setError("The reply could not be kept.");
      } finally {
        setBusy(false);
      }
    },
    [recordingId, name, onCreated],
  );

  const stopRecording = useCallback(() => {
    abortRef.current = true;
    window.clearInterval(tickRef.current);
    window.clearTimeout(maxTimerRef.current);
    setHolding(false);
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    else stopStream();
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
        recorderRef.current = null;
        stopStream();
        void finish(blob, durationMs);
      });
      recorderRef.current = recorder;
      startedAtRef.current = Date.now();
      setElapsed(0);
      setHolding(true);
      recorder.start(250);
      tickRef.current = window.setInterval(() => {
        setElapsed(Date.now() - startedAtRef.current);
      }, 200);
      maxTimerRef.current = window.setTimeout(stopRecording, REPLY_MAX_MS);
    } catch {
      stopStream();
      setError("Microphone permission is needed to reply.");
    }
  }, [busy, finish, holding, stopRecording, stopStream]);

  const remaining = Math.max(0, Math.ceil((REPLY_MAX_MS - elapsed) / 1000));

  return (
    <div className={styles.recorder}>
      <input
        ref={honeyRef}
        className={styles.honeypot}
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
      />
      <button
        type="button"
        className={`${styles.hold}${holding ? ` ${styles.holding}` : ""}`}
        disabled={busy}
        aria-pressed={holding}
        onPointerDown={(event) => {
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          void startRecording();
        }}
        onPointerUp={stopRecording}
        onPointerCancel={stopRecording}
        onContextMenu={(event) => event.preventDefault()}
      >
        <span className={styles.holdDot} aria-hidden="true" />
        {busy ? "Keeping…" : holding ? `Release · ${remaining}s` : "Hold to reply with your voice"}
      </button>
      <input
        className={styles.recorderName}
        value={name}
        maxLength={60}
        autoComplete="nickname"
        placeholder="your earthly name or alter ego"
        aria-label="Name, optional"
        onChange={(event) => onNameChange(event.target.value)}
      />
      {error ? (
        <p className={styles.formError} role="status">
          {error}
        </p>
      ) : null}
    </div>
  );
}
