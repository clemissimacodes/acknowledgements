"use client";

import { formatVoiceDuration } from "@/lib/format";
import { usePlayback, type QueueClip } from "./Playback";

function PlayGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M8 5.5v13l11-6.5-11-6.5z" />
    </svg>
  );
}

function PauseGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M7 5.5h3.4v13H7zM13.6 5.5H17v13h-3.4z" />
    </svg>
  );
}

export function ClipPlayer({
  clip,
  durationMs,
  label,
  extra,
}: {
  clip: QueueClip;
  durationMs: number;
  label: string;
  extra?: React.ReactNode;
}) {
  const { activeId, paused, currentTime, duration, toggle, seek } =
    usePlayback();
  const isActive = activeId === clip.id;
  const isPlaying = isActive && !paused;
  const total = isActive && duration > 0 ? duration : durationMs / 1000;
  const elapsed = isActive ? currentTime : 0;
  const ratio = total > 0 ? Math.min(1, elapsed / total) : 0;

  function onSeek(event: React.PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width) return;
    if (!isActive) toggle(clip);
    seek((event.clientX - rect.left) / rect.width);
  }

  return (
    <div className={`out-loud-player${isPlaying ? " is-playing" : ""}`}>
      <button
        className="out-loud-play"
        type="button"
        aria-label={isPlaying ? `Pause ${label}` : `Play ${label}`}
        onClick={() => toggle(clip)}
      >
        {isPlaying ? <PauseGlyph /> : <PlayGlyph />}
      </button>
      <div className="out-loud-player-body">
        <div className="out-loud-player-meta">
          <span>{label}</span>
          <span>
            {formatVoiceDuration(elapsed * 1000)} /{" "}
            {formatVoiceDuration(total * 1000 || durationMs)}
          </span>
        </div>
        <div
          className="out-loud-progress"
          role="slider"
          aria-label={`${label} progress`}
          aria-valuemin={0}
          aria-valuemax={Math.round(total)}
          aria-valuenow={Math.round(elapsed)}
          tabIndex={0}
          onPointerDown={onSeek}
          onKeyDown={(event) => {
            if (event.key === "ArrowRight") {
              event.preventDefault();
              if (!isActive) toggle(clip);
              seek(Math.min(1, ratio + 0.05));
            }
            if (event.key === "ArrowLeft") {
              event.preventDefault();
              seek(Math.max(0, ratio - 0.05));
            }
          }}
        >
          <span style={{ width: `${ratio * 100}%` }} />
        </div>
        {extra}
      </div>
    </div>
  );
}
