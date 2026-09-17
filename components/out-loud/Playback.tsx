"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type QueueClip = { id: string; src: string };

type PlaybackApi = {
  activeId: string | null;
  paused: boolean;
  currentTime: number;
  duration: number;
  playThrough: boolean;
  setPlayThrough: (value: boolean) => void;
  setQueue: (clips: QueueClip[]) => void;
  toggle: (clip: QueueClip) => void;
  seek: (ratio: number) => void;
  stop: () => void;
};

const PlaybackContext = createContext<PlaybackApi | null>(null);

export function PlaybackProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const queueRef = useRef<QueueClip[]>([]);
  const activeIdRef = useRef<string | null>(null);
  const playThroughRef = useRef(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [paused, setPaused] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playThrough, setPlayThroughState] = useState(false);

  const setActive = useCallback((id: string | null) => {
    activeIdRef.current = id;
    setActiveId(id);
  }, []);

  const load = useCallback((src: string) => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.src !== src) {
      audio.src = src;
    }
  }, []);

  const playClip = useCallback(
    (clip: QueueClip) => {
      const audio = audioRef.current;
      if (!audio) return;
      load(clip.src);
      setActive(clip.id);
      setPaused(false);
      void audio.play().catch(() => {
        setPaused(true);
      });
    },
    [load, setActive],
  );

  useEffect(() => {
    const audio = new Audio();
    audio.preload = "metadata";
    audioRef.current = audio;

    const onTime = () => setCurrentTime(audio.currentTime);
    const onDuration = () => {
      if (Number.isFinite(audio.duration)) setDuration(audio.duration);
    };
    const onEnded = () => {
      if (playThroughRef.current) {
        const index = queueRef.current.findIndex(
          (clip) => clip.id === activeIdRef.current,
        );
        const next = queueRef.current[index + 1];
        if (next) {
          playClip(next);
          return;
        }
      }
      setActive(null);
      setPaused(true);
      setCurrentTime(0);
    };
    const onPause = () => {
      if (!audio.ended) setPaused(true);
    };
    const onPlay = () => setPaused(false);

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("durationchange", onDuration);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("play", onPlay);

    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("durationchange", onDuration);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("play", onPlay);
      audioRef.current = null;
    };
  }, [playClip, setActive]);

  const setPlayThrough = useCallback((value: boolean) => {
    playThroughRef.current = value;
    setPlayThroughState(value);
  }, []);

  const setQueue = useCallback((clips: QueueClip[]) => {
    queueRef.current = clips;
  }, []);

  const toggle = useCallback(
    (clip: QueueClip) => {
      const audio = audioRef.current;
      if (!audio) return;
      if (activeIdRef.current === clip.id) {
        if (audio.paused) {
          setPaused(false);
          void audio.play().catch(() => setPaused(true));
        } else {
          audio.pause();
        }
        return;
      }
      playClip(clip);
    },
    [playClip],
  );

  const seek = useCallback((ratio: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) {
      return;
    }
    audio.currentTime = Math.min(
      audio.duration,
      Math.max(0, ratio * audio.duration),
    );
  }, []);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setActive(null);
    setPaused(true);
    setCurrentTime(0);
  }, [setActive]);

  const value = useMemo<PlaybackApi>(
    () => ({
      activeId,
      paused,
      currentTime,
      duration,
      playThrough,
      setPlayThrough,
      setQueue,
      toggle,
      seek,
      stop,
    }),
    [
      activeId,
      paused,
      currentTime,
      duration,
      playThrough,
      setPlayThrough,
      setQueue,
      toggle,
      seek,
      stop,
    ],
  );

  return (
    <PlaybackContext.Provider value={value}>{children}</PlaybackContext.Provider>
  );
}

export function usePlayback() {
  const value = useContext(PlaybackContext);
  if (!value) {
    throw new Error("usePlayback must be used inside PlaybackProvider.");
  }
  return value;
}
