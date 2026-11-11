"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { publishRecording } from "@/app/(volume)/voice-memos/actions";
import {
  FOLDER_LABELS,
  RECORDING_FOLDERS,
  RECORDING_MAX_BYTES,
  formatClock,
  type RecordingFolder,
} from "@/lib/recording-types";
import { computePeaks, decodeAudio } from "./audio";
import { uploadRecordingFile } from "./audio";

type Draft = {
  key: string;
  file: File;
  title: string;
  folder: RecordingFolder;
  recordedAt: string;
  durationMs: number | null;
  peaks: number[] | null;
  status: "reading" | "ready" | "uploading" | "done" | "error";
  message: string;
};

function localDateTime(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function titleFromFile(name: string) {
  return name.replace(/\.[a-z0-9]{2,5}$/i, "").replace(/[_-]+/g, " ").trim() || "New Recording";
}

export function Publisher() {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function patch(key: string, changes: Partial<Draft>) {
    setDrafts((current) =>
      current.map((draft) => (draft.key === key ? { ...draft, ...changes } : draft)),
    );
  }

  async function addFiles(files: FileList | File[]) {
    const incoming = Array.from(files).filter((file) =>
      /^audio\//.test(file.type) || /\.(m4a|mp3|wav|aac|ogg|webm|aiff?)$/i.test(file.name),
    );
    const next: Draft[] = incoming.map((file) => ({
      key: crypto.randomUUID(),
      file,
      title: titleFromFile(file.name),
      folder: "notes",
      recordedAt: localDateTime(new Date(file.lastModified || Date.now())),
      durationMs: null,
      peaks: null,
      status: "reading",
      message: "",
    }));
    setDrafts((current) => [...current, ...next]);
    for (const draft of next) {
      if (draft.file.size > RECORDING_MAX_BYTES) {
        patch(draft.key, { status: "error", message: "Over 200 MB." });
        continue;
      }
      try {
        const buffer = await decodeAudio(draft.file);
        patch(draft.key, {
          durationMs: Math.round(buffer.duration * 1000),
          peaks: computePeaks(buffer),
          status: "ready",
        });
      } catch {
        patch(draft.key, {
          status: "error",
          message: "Could not read this file. Try an m4a, mp3 or wav.",
        });
      }
    }
  }

  async function publishAll() {
    if (busy) return;
    setBusy(true);
    let published = 0;
    for (const draft of drafts) {
      if (draft.status !== "ready" || !draft.durationMs) continue;
      patch(draft.key, { status: "uploading", message: "Uploading…" });
      try {
        const uploaded = await uploadRecordingFile(draft.file, { role: "recording" });
        await publishRecording({
          title: draft.title,
          folder: draft.folder,
          durationMs: draft.durationMs,
          url: uploaded.url,
          pathname: uploaded.pathname,
          peaks: draft.peaks,
          recordedAt: draft.recordedAt
            ? new Date(draft.recordedAt).toISOString()
            : undefined,
        });
        patch(draft.key, { status: "done", message: "Published" });
        published += 1;
      } catch (error) {
        patch(draft.key, {
          status: "error",
          message: error instanceof Error ? error.message : "Upload failed.",
        });
      }
    }
    setBusy(false);
    if (published) {
      setDrafts((current) => current.filter((draft) => draft.status !== "done"));
      router.refresh();
    }
  }

  const readyCount = drafts.filter((draft) => draft.status === "ready").length;

  return (
    <div className="admin-publisher">
      <div
        className="admin-dropzone"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          void addFiles(event.dataTransfer.files);
        }}
      >
        <p>
          Drop voice memos here, or{" "}
          <button type="button" onClick={() => inputRef.current?.click()}>
            choose files
          </button>
          . From the Voice Memos app: select a memo, then File → Share → Save
          to Files (or drag it straight out of the list).
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="audio/*,.m4a,.mp3,.wav,.aac,.ogg,.webm"
          multiple
          hidden
          onChange={(event) => {
            if (event.target.files) void addFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </div>

      {drafts.length ? (
        <ul className="admin-drafts">
          {drafts.map((draft) => (
            <li key={draft.key} className="admin-draft" data-status={draft.status}>
              <input
                value={draft.title}
                maxLength={120}
                aria-label="Title"
                disabled={draft.status === "uploading" || draft.status === "done"}
                onChange={(event) => patch(draft.key, { title: event.target.value })}
              />
              <select
                value={draft.folder}
                aria-label="Folder"
                disabled={draft.status === "uploading" || draft.status === "done"}
                onChange={(event) =>
                  patch(draft.key, { folder: event.target.value as RecordingFolder })
                }
              >
                {RECORDING_FOLDERS.map((folder) => (
                  <option key={folder} value={folder}>
                    {FOLDER_LABELS[folder]}
                  </option>
                ))}
              </select>
              <input
                type="datetime-local"
                value={draft.recordedAt}
                aria-label="Recorded at"
                disabled={draft.status === "uploading" || draft.status === "done"}
                onChange={(event) => patch(draft.key, { recordedAt: event.target.value })}
              />
              <span className="admin-draft-meta">
                {draft.durationMs ? formatClock(draft.durationMs) : "…"} ·{" "}
                {(draft.file.size / (1024 * 1024)).toFixed(1)} MB
                {draft.message ? ` · ${draft.message}` : ""}
              </span>
              <button
                type="button"
                className="admin-draft-remove"
                aria-label="Remove"
                disabled={draft.status === "uploading"}
                onClick={() =>
                  setDrafts((current) => current.filter((item) => item.key !== draft.key))
                }
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {drafts.length ? (
        <div className="admin-roll-actions">
          <button type="button" disabled={busy || !readyCount} onClick={() => void publishAll()}>
            {busy
              ? "Publishing…"
              : `Publish ${readyCount} recording${readyCount === 1 ? "" : "s"}`}
          </button>
        </div>
      ) : null}
    </div>
  );
}
