"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Props = {
  url: string;
  durationMs: number | null;
  nickname: string;
  slug: string;
};

function fmt(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

const BARS = 36;

function barsFromSeed(seed: string, count: number) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const out = new Array<number>(count);
  for (let i = 0; i < count; i += 1) {
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    const n = ((h >>> 0) % 1000) / 1000;
    out[i] = 0.22 + 0.78 * (0.35 + 0.65 * n * Math.abs(Math.sin((i + 1) * 0.55)));
  }
  return out;
}

function storageKey(slug: string) {
  return `ff-voice-gift-opened:${slug}`;
}

/* A sealed note from Clem — unwrap once, then play. Feels like a present, not a player. */
export function VoiceGift({ url, durationMs, nickname, slug }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [opened, setOpened] = useState(false);
  const [unwrapping, setUnwrapping] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(
    durationMs && durationMs > 0 ? durationMs / 1000 : 0,
  );

  const peaks = useMemo(() => barsFromSeed(url, BARS), [url]);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(storageKey(slug)) === "1") setOpened(true);
    } catch {
      /* private mode — stay sealed */
    }
  }, [slug]);

  useEffect(() => {
    setPlaying(false);
    setCurrent(0);
    setDuration(durationMs && durationMs > 0 ? durationMs / 1000 : 0);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  }, [url, durationMs]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const ensureAudio = useCallback(() => {
    if (audioRef.current) return audioRef.current;
    const audio = new Audio();
    audio.preload = "none";
    audio.src = url;
    audioRef.current = audio;
    audio.addEventListener("loadedmetadata", () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) setDuration(audio.duration);
    });
    audio.addEventListener("timeupdate", () => setCurrent(audio.currentTime));
    audio.addEventListener("play", () => setPlaying(true));
    audio.addEventListener("pause", () => setPlaying(false));
    audio.addEventListener("ended", () => {
      setPlaying(false);
      setCurrent(0);
    });
    return audio;
  }, [url]);

  const unwrap = () => {
    if (opened || unwrapping) return;
    setUnwrapping(true);
    window.setTimeout(() => {
      setOpened(true);
      setUnwrapping(false);
      try {
        sessionStorage.setItem(storageKey(slug), "1");
      } catch {
        /* ignore */
      }
    }, 720);
  };

  const toggle = () => {
    const audio = ensureAudio();
    if (audio.paused) void audio.play().catch(() => undefined);
    else audio.pause();
  };

  const seek = (ratio: number) => {
    const audio = ensureAudio();
    const play = () => {
      const len = duration || audio.duration || 0;
      if (!len || !Number.isFinite(len)) return;
      audio.currentTime = Math.min(len, Math.max(0, ratio * len));
    };
    if (audio.readyState >= 1) play();
    else audio.addEventListener("loadedmetadata", play, { once: true });
    void audio.play().catch(() => undefined);
  };

  const progress = duration > 0 ? Math.min(1, current / duration) : 0;
  const state = unwrapping ? "is-unwrapping" : opened ? "is-open" : "is-sealed";

  return (
    <div className={`ff-voice-gift ${state}`} role="region" aria-label={`A note from Clem for ${nickname}`}>
      {!opened ? (
        <button type="button" className="ff-voice-gift-seal" onClick={unwrap} disabled={unwrapping}>
          <span className="ff-voice-gift-parcel" aria-hidden="true">
            <span className="ff-voice-gift-lid" />
            <span className="ff-voice-gift-body" />
            <span className="ff-voice-gift-ribbon-v" />
            <span className="ff-voice-gift-ribbon-h" />
            <span className="ff-voice-gift-bow" />
          </span>
          <span className="ff-voice-gift-copy">
            <strong>A note from Clem</strong>
            <em>{unwrapping ? "Opening…" : "Pull the ribbon"}</em>
          </span>
        </button>
      ) : (
        <div className="ff-voice-gift-open">
          <p className="ff-voice-gift-label">
            <strong>For you, {nickname}</strong>
            <span>Clem recorded this just for you.</span>
          </p>
          <div className="ff-voice-gift-player">
            <button
              type="button"
              className="ff-voice-gift-play"
              onClick={toggle}
              aria-label={playing ? "Pause note" : "Play note"}
            >
              {playing ? "❚❚" : "▶"}
            </button>
            <button
              type="button"
              className="ff-voice-gift-wave"
              aria-label="Seek"
              onClick={(event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                seek((event.clientX - rect.left) / Math.max(1, rect.width));
              }}
            >
              <span className="ff-voice-gift-bars" aria-hidden="true">
                {peaks.map((amp, index) => (
                  <i
                    key={index}
                    className={index / peaks.length <= progress ? "is-on" : undefined}
                    style={{ height: `${Math.round(amp * 100)}%` }}
                  />
                ))}
              </span>
            </button>
            <span className="ff-voice-gift-time">
              {fmt(current)}
              {duration > 0 ? ` / ${fmt(duration)}` : ""}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
