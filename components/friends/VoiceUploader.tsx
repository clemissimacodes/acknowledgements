"use client";

import { upload } from "@vercel/blob/client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { attachFriendVoice, clearFriendVoiceForm } from "@/app/(shop)/actions";
import { FRIEND_VOICE_MAX_BYTES, VOICE_CONTENT_TYPES } from "@/lib/friend-types";

type Props = {
  id: string;
  currentUrl: string | null;
  currentDurationMs: number | null;
};

function formatDuration(ms: number | null) {
  if (!ms || ms <= 0) return "";
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

async function measureDuration(file: File): Promise<number | null> {
  const url = URL.createObjectURL(file);
  try {
    const audio = new Audio();
    audio.preload = "metadata";
    const duration = await new Promise<number | null>((resolve) => {
      audio.onloadedmetadata = () => {
        resolve(Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration * 1000 : null);
      };
      audio.onerror = () => resolve(null);
      audio.src = url;
    });
    return duration;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/* Drop / pick an audio file for the founder voice note on the product page. */
export function VoiceUploader({ id, currentUrl, currentDurationMs }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const onFile = async (file: File | undefined | null) => {
    if (!file) return;
    const type = file.type || "audio/mpeg";
    if (!VOICE_CONTENT_TYPES.includes(type) && !/\.(m4a|mp3|wav|aac|ogg|webm)$/i.test(file.name)) {
      setError("Use an audio file (m4a, mp3, wav…).");
      return;
    }
    if (file.size > FRIEND_VOICE_MAX_BYTES) {
      setError("That recording is over 20 MB.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const durationMs = await measureDuration(file);
      const ext = (file.name.split(".").pop() || "m4a").toLowerCase().replace(/[^a-z0-9]/g, "") || "m4a";
      const blob = await upload(`friends-and-family/${id}/voice.${ext}`, file, {
        access: "public",
        handleUploadUrl: "/api/friends/upload",
        contentType: type,
      });
      await attachFriendVoice({
        id,
        url: blob.url,
        pathname: blob.pathname,
        durationMs,
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="admin-drop-wrap admin-voice-wrap">
      <div
        className={`admin-drop admin-voice-drop${busy ? " is-busy" : ""}`}
        role="button"
        tabIndex={0}
        aria-label="Founder voice note"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }}
        onDrop={(event) => {
          event.preventDefault();
          const file =
            Array.from(event.dataTransfer.files).find((f) => f.type.startsWith("audio/")) ??
            event.dataTransfer.files[0];
          void onFile(file);
        }}
      >
        <span className="admin-drop-label">
          <strong>{busy ? "Uploading…" : currentUrl ? "Voice note" : "Voice note (none yet)"}</strong>
          <small>
            {currentUrl
              ? `On the product page${currentDurationMs ? ` · ${formatDuration(currentDurationMs)}` : ""}. Click to replace.`
              : "Hear what our founder has to say — m4a / mp3 / wav"}
          </small>
        </span>
        {currentUrl ? (
          <audio controls src={currentUrl} preload="metadata" onClick={(event) => event.stopPropagation()} />
        ) : null}
        <input
          ref={inputRef}
          type="file"
          accept="audio/*,.m4a,.mp3,.wav,.aac,.ogg,.webm"
          disabled={busy}
          hidden
          onChange={(event) => void onFile(event.target.files?.[0])}
        />
      </div>
      {error ? <em className="admin-drop-error">{error}</em> : null}
      {currentUrl && !busy ? (
        <form action={clearFriendVoiceForm} className="admin-drop-remove">
          <input type="hidden" name="id" value={id} />
          <button type="submit">Remove</button>
        </form>
      ) : null}
    </div>
  );
}
