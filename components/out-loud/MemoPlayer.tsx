"use client";

import { ClipPlayer } from "./ClipPlayer";
import { usePlayback } from "./Playback";

export function MemoPlayer({
  id,
  src,
  durationMs,
  label,
}: {
  id: string;
  src: string;
  durationMs: number;
  label: string;
}) {
  const { playThrough, setPlayThrough, toggle, activeId, paused } = usePlayback();
  const clip = { id, src };

  return (
    <ClipPlayer
      clip={clip}
      durationMs={durationMs}
      label={label}
      extra={
        <div className="out-loud-through">
          <button
            type="button"
            className={playThrough ? "is-on" : undefined}
            aria-pressed={playThrough}
            onClick={() => {
              const next = !playThrough;
              setPlayThrough(next);
              if (next && (activeId !== clip.id || paused)) toggle(clip);
            }}
          >
            Play through replies
          </button>
        </div>
      }
    />
  );
}
