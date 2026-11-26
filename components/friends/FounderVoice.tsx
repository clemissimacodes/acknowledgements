"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  url: string;
  durationMs: number | null;
  /* Shared unlock: when the page gesture fires, both voice and anthem may start. */
  unlocked: boolean;
  onNeedUnlock?: () => void;
};

function fmt(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

const VOLUME = 0.35;

/* Hairline founder-voice player at the top of the product page. */
export function FounderVoice({ url, durationMs, unlocked, onNeedUnlock }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(durationMs && durationMs > 0 ? durationMs / 1000 : 0);
  const triedAutoplay = useRef(false);

  useEffect(() => {
    const audio = new Audio(url);
    audio.preload = "metadata";
    audio.volume = VOLUME;
    audioRef.current = audio;
    const onMeta = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) setDuration(audio.duration);
    };
    const onTime = () => setCurrent(audio.currentTime);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => {
      setPlaying(false);
      setCurrent(0);
    };
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.pause();
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audioRef.current = null;
    };
  }, [url]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || triedAutoplay.current) return;
    triedAutoplay.current = true;
    void audio.play().catch(() => {
      /* Browser blocked autoplay — wait for unlock / tap. */
    });
  }, [url]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!unlocked || !audio || !audio.paused) return;
    void audio.play().catch(() => undefined);
  }, [unlocked]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      onNeedUnlock?.();
      void audio.play().catch(() => undefined);
    } else {
      audio.pause();
    }
  };

  const progress = duration > 0 ? Math.min(1, current / duration) : 0;

  return (
    <div className="ff-voice">
      <button type="button" className="ff-voice-btn" onClick={toggle} aria-label={playing ? "Pause" : "Play"}>
        <span className="ff-voice-icon" aria-hidden="true">
          {playing ? "❚❚" : "♪"}
        </span>
        <span className="ff-voice-label">Hear what our founder has to say about this one</span>
        <span className="ff-voice-time">
          {fmt(current)}
          {duration > 0 ? ` / ${fmt(duration)}` : ""}
        </span>
      </button>
      <div className="ff-voice-line" aria-hidden="true">
        <i style={{ transform: `scaleX(${progress})` }} />
      </div>
    </div>
  );
}
