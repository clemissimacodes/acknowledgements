"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type FriendVoiceClip = {
  url: string;
  durationMs: number | null;
  label?: string;
};

type VoiceContextValue = {
  clip: FriendVoiceClip | null;
  setClip: (clip: FriendVoiceClip | null) => void;
};

const FriendVoiceContext = createContext<VoiceContextValue | null>(null);

export function FriendVoiceProvider({ children }: { children: ReactNode }) {
  const [clip, setClip] = useState<FriendVoiceClip | null>(null);
  const value = useMemo(() => ({ clip, setClip }), [clip]);
  return <FriendVoiceContext.Provider value={value}>{children}</FriendVoiceContext.Provider>;
}

export function useFriendVoice() {
  const ctx = useContext(FriendVoiceContext);
  if (!ctx) throw new Error("useFriendVoice must be used inside FriendVoiceProvider");
  return ctx;
}

/* Product pages publish their voice note into the shop header strip. */
export function FriendVoiceBridge({
  url,
  durationMs,
  label,
}: {
  url: string | null;
  durationMs: number | null;
  label?: string;
}) {
  const { setClip } = useFriendVoice();
  useEffect(() => {
    if (!url) {
      setClip(null);
      return;
    }
    setClip({ url, durationMs, label });
    return () => setClip(null);
  }, [url, durationMs, label, setClip]);
  return null;
}

function fmt(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

const BARS = 48;

/* Cheap deterministic bars from the URL — never download/decode audio just to draw. */
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
    out[i] = 0.18 + 0.82 * (0.35 + 0.65 * n * Math.abs(Math.sin((i + 1) * 0.55)));
  }
  return out;
}

/* Very-top header strip: play + waveform + time. Audio loads only on first play. */
export function HeaderVoiceStrip() {
  const { clip } = useFriendVoice();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);

  const peaks = useMemo(
    () => (clip?.url ? barsFromSeed(clip.url, BARS) : []),
    [clip?.url],
  );

  useEffect(() => {
    setPlaying(false);
    setCurrent(0);
    setDuration(clip?.durationMs && clip.durationMs > 0 ? clip.durationMs / 1000 : 0);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  }, [clip?.url, clip?.durationMs]);

  const ensureAudio = useCallback(() => {
    if (!clip?.url) return null;
    if (audioRef.current) return audioRef.current;
    const audio = new Audio();
    audio.preload = "none";
    audio.src = clip.url;
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
  }, [clip?.url]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const toggle = useCallback(() => {
    const audio = ensureAudio();
    if (!audio) return;
    if (audio.paused) void audio.play().catch(() => undefined);
    else audio.pause();
  }, [ensureAudio]);

  const seek = useCallback(
    (ratio: number) => {
      const audio = ensureAudio();
      if (!audio) return;
      const play = () => {
        const len = duration || audio.duration || 0;
        if (!len || !Number.isFinite(len)) return;
        audio.currentTime = Math.min(len, Math.max(0, ratio * len));
      };
      if (audio.readyState >= 1) play();
      else audio.addEventListener("loadedmetadata", play, { once: true });
      void audio.play().catch(() => undefined);
    },
    [duration, ensureAudio],
  );

  if (!clip?.url) return null;

  const progress = duration > 0 ? Math.min(1, current / duration) : 0;

  return (
    <div className="ff-head-voice" role="region" aria-label={clip.label || "Voice memo"}>
      <button
        type="button"
        className="ff-head-voice-play"
        onClick={toggle}
        aria-label={playing ? "Pause voice memo" : "Play voice memo"}
      >
        {playing ? "❚❚" : "▶"}
      </button>
      <button
        type="button"
        className="ff-head-voice-wave"
        aria-label="Seek"
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          seek((event.clientX - rect.left) / Math.max(1, rect.width));
        }}
      >
        <span className="ff-head-voice-bars" aria-hidden="true">
          {peaks.map((amp, index) => (
            <i
              key={index}
              className={index / peaks.length <= progress ? "is-on" : undefined}
              style={{ height: `${Math.round(amp * 100)}%` }}
            />
          ))}
        </span>
      </button>
      <span className="ff-head-voice-time">
        {fmt(current)}
        {duration > 0 ? ` / ${fmt(duration)}` : ""}
      </span>
    </div>
  );
}
