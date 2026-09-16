"use client";

import { useRef, useState } from "react";
import {
  fileFromRecording,
  measureAudioDuration,
  MEMO_MAX_MS,
  pickRecorderMime,
} from "@/components/out-loud/record";
import { uploadVoiceFile } from "@/components/out-loud/upload";
import { formatVoiceDuration } from "@/lib/format";

export function OutLoudPublisher() {
  const [kind, setKind] = useState<"person" | "thought">("person");
  const [title, setTitle] = useState("");
  const [recordedAt, setRecordedAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [message, setMessage] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const tickRef = useRef<number>(0);
  const maxTimerRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);

  function stopStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  async function publish(file: File, durationMs: number) {
    if (kind === "person" && title.trim().length < 2) {
      setMessage("Name the person.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const uploaded = await uploadVoiceFile(file, { role: "memo" });
      const response = await fetch("/api/out-loud/memos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          title,
          durationMs,
          url: uploaded.url,
          pathname: uploaded.pathname,
          recordedAt: recordedAt || undefined,
          published: true,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setMessage(data.error ?? "The memo could not be published.");
        return;
      }
      setTitle("");
      setRecordedAt("");
      setMessage("Published.");
      window.location.reload();
    } catch {
      setMessage("The memo could not be published.");
    } finally {
      setBusy(false);
    }
  }

  function stopRecording() {
    window.clearInterval(tickRef.current);
    window.clearTimeout(maxTimerRef.current);
    setRecording(false);
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
  }

  async function toggleRecording() {
    if (busy) return;
    if (recording) {
      stopRecording();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setMessage("This browser will not record.");
      return;
    }
    setMessage("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
        if (durationMs < 800) {
          setMessage("Record a little longer.");
          return;
        }
        void publish(fileFromRecording(blob, "memo"), durationMs);
      });
      recorderRef.current = recorder;
      startedAtRef.current = Date.now();
      setElapsed(0);
      setRecording(true);
      recorder.start(250);
      tickRef.current = window.setInterval(() => {
        setElapsed(Date.now() - startedAtRef.current);
      }, 200);
      maxTimerRef.current = window.setTimeout(() => {
        stopRecording();
      }, MEMO_MAX_MS);
    } catch {
      stopStream();
      setMessage("Microphone permission is needed to record.");
    }
  }

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    setMessage("");
    try {
      const durationMs = await measureAudioDuration(file);
      if (durationMs > MEMO_MAX_MS + 2_000) {
        setMessage("Keep memos under ten minutes.");
        return;
      }
      await publish(file, durationMs);
    } catch {
      setMessage("That file could not be read.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-edit-form admin-out-loud-form">
      <label>
        Kind
        <select
          value={kind}
          onChange={(event) =>
            setKind(event.target.value === "thought" ? "thought" : "person")
          }
        >
          <option value="person">People</option>
          <option value="thought">Thoughts</option>
        </select>
      </label>
      <label>
        {kind === "person" ? "Person" : "Title, optional"}
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={80}
          required={kind === "person"}
          placeholder={kind === "person" ? "Isaiah" : "untitled thought"}
        />
      </label>
      <label>
        Recorded on
        <input
          type="date"
          value={recordedAt}
          onChange={(event) => setRecordedAt(event.target.value)}
        />
      </label>
      <div className="admin-out-loud-record">
        <button type="button" disabled={busy} onClick={() => void toggleRecording()}>
          {recording
            ? `Stop · ${formatVoiceDuration(elapsed)}`
            : busy
              ? "Publishing…"
              : "Record memo"}
        </button>
        <label className="admin-out-loud-file">
          Upload a file
          <input
            type="file"
            accept="audio/*,video/webm"
            disabled={busy || recording}
            onChange={(event) => void onFile(event)}
          />
        </label>
      </div>
      <p>{message}</p>
    </div>
  );
}
