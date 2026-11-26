"use client";

import { useEffect, useState } from "react";

type Props = {
  trackId: string;
  unlocked: boolean;
  onNeedUnlock?: () => void;
};

/* Quiet Spotify anthem. Browsers block audible autoplay without a gesture, so
   we best-effort load with autoplay and unlock on the first tap anywhere. */
export function AnthemPlayer({ trackId, unlocked, onNeedUnlock }: Props) {
  const [started, setStarted] = useState(false);
  const [key, setKey] = useState(0);

  useEffect(() => {
    if (!unlocked || started) return;
    setStarted(true);
    setKey((k) => k + 1);
  }, [unlocked, started]);

  const src = `https://open.spotify.com/embed/track/${trackId}?utm_source=generator&theme=0${
    started || unlocked ? "&autoplay=1" : ""
  }`;

  return (
    <div className={`ff-anthem${started ? " is-on" : ""}`}>
      {!started ? (
        <button
          type="button"
          className="ff-anthem-whisper"
          onClick={() => {
            onNeedUnlock?.();
            setStarted(true);
            setKey((k) => k + 1);
          }}
        >
          ♪ their song — tap to play softly
        </button>
      ) : (
        <p className="ff-anthem-whisper" aria-live="polite">
          ♪ their song is on
        </p>
      )}
      <iframe
        key={key}
        className="ff-anthem-frame"
        title="Friendship anthem"
        src={src}
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
      />
    </div>
  );
}
