"use client";

import type { ReactNode } from "react";
import { AnthemPlayer } from "./AnthemPlayer";

type Props = {
  trackId: string | null;
  children: ReactNode;
};

/* Spotify stays behind its own tap. Voice lives in the top header strip. */
export function ProductSoundtrack({ trackId, children }: Props) {
  return (
    <>
      {children}
      {trackId ? <AnthemPlayer trackId={trackId} /> : null}
    </>
  );
}
