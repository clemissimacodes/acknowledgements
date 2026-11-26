"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AnthemPlayer } from "./AnthemPlayer";
import { FounderVoice } from "./FounderVoice";

type Props = {
  voiceUrl: string | null;
  voiceDurationMs: number | null;
  trackId: string | null;
  children: ReactNode;
};

/* Owns the first-gesture unlock shared by founder voice + Spotify anthem. */
export function ProductSoundtrack({ voiceUrl, voiceDurationMs, trackId, children }: Props) {
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    if (unlocked) return;
    const unlock = () => setUnlocked(true);
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [unlocked]);

  return (
    <>
      {voiceUrl ? (
        <FounderVoice
          url={voiceUrl}
          durationMs={voiceDurationMs}
          unlocked={unlocked}
          onNeedUnlock={() => setUnlocked(true)}
        />
      ) : null}
      {children}
      {trackId ? (
        <AnthemPlayer trackId={trackId} unlocked={unlocked} onNeedUnlock={() => setUnlocked(true)} />
      ) : null}
    </>
  );
}
