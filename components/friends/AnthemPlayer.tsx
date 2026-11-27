"use client";

import { useState } from "react";

type Props = {
  trackId: string;
  unlocked?: boolean;
  onNeedUnlock?: () => void;
};

/* Quiet Spotify anthem. Iframe mounts only after an explicit tap — never on page load. */
export function AnthemPlayer({ trackId, onNeedUnlock }: Props) {
  const [started, setStarted] = useState(false);

  const start = () => {
    onNeedUnlock?.();
    setStarted(true);
  };

  return (
    <div className={`ff-anthem${started ? " is-on" : ""}`}>
      {!started ? (
        <button type="button" className="ff-anthem-whisper" onClick={start}>
          ♪ their song — tap to play softly
        </button>
      ) : (
        <p className="ff-anthem-whisper" aria-live="polite">
          ♪ their song is on
        </p>
      )}
      {started ? (
        <iframe
          className="ff-anthem-frame"
          title="Friendship anthem"
          src={`https://open.spotify.com/embed/track/${trackId}?utm_source=generator&theme=0&autoplay=1`}
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
        />
      ) : null}
    </div>
  );
}
