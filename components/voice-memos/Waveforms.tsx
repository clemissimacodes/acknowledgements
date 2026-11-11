"use client";

import { useCallback, useEffect, useRef } from "react";
import { formatClock } from "@/lib/recording-types";
import styles from "./VoiceMemos.module.css";

export type LoopRegion = { a: number; b: number };

function cssVar(element: HTMLElement, name: string, fallback: string) {
  return getComputedStyle(element).getPropertyValue(name).trim() || fallback;
}

function peakAt(peaks: number[], duration: number, from: number, to: number) {
  if (!peaks.length || duration <= 0) return 0;
  const start = Math.max(0, Math.floor((from / duration) * peaks.length));
  const end = Math.min(peaks.length - 1, Math.floor((to / duration) * peaks.length));
  let max = 0;
  for (let i = start; i <= end; i += 1) if (peaks[i] > max) max = peaks[i];
  return max / 100;
}

function useCanvasSize(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  draw: () => void,
) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 3);
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(rect.width * ratio));
      canvas.height = Math.max(1, Math.round(rect.height * ratio));
      draw();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    // Colours are read from CSS, so repaint when the system theme flips.
    const scheme = window.matchMedia("(prefers-color-scheme: dark)");
    scheme.addEventListener("change", draw);
    return () => {
      observer.disconnect();
      scheme.removeEventListener("change", draw);
    };
  }, [canvasRef, draw]);
}

/* ------------------------------------------------------------------ */
/* Zoomed waveform: the playhead stays put and the audio scrolls past. */
/* ------------------------------------------------------------------ */

const PIXELS_PER_SECOND = 108;
const BAR_STEP = 3;
const BAR_WIDTH = 1.6;

type WaveformProps = {
  peaks: number[] | null;
  duration: number;
  time: number;
  loop: LoopRegion | null;
  onScrubStart: () => void;
  onScrub: (time: number) => void;
  onScrubEnd: () => void;
};

export function Waveform({
  peaks,
  duration,
  time,
  loop,
  onScrubStart,
  onScrub,
  onScrubEnd,
}: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({ peaks, duration, time, loop });
  stateRef.current = { peaks, duration, time, loop };
  const dragRef = useRef<{ x: number; time: number } | null>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const { peaks, duration, time, loop } = stateRef.current;
    const ratio = canvas.width / Math.max(1, canvas.getBoundingClientRect().width);
    const width = canvas.width / ratio;
    const height = canvas.height / ratio;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);

    const wave = cssVar(canvas, "--vm-wave", "#1d1d1f");
    const dim = cssVar(canvas, "--vm-wave-dim", "rgba(29,29,31,0.3)");
    const rule = cssVar(canvas, "--vm-rule", "rgba(60,60,67,0.18)");
    const accent = cssVar(canvas, "--vm-accent", "#0a84ff");
    const tickText = cssVar(canvas, "--vm-secondary", "#8e8e93");

    const rulerHeight = 26;
    const waveTop = 0;
    const waveHeight = height - rulerHeight;
    const mid = waveTop + waveHeight / 2;
    const cx = width / 2;

    // Baseline hairlines top and bottom of the wave area.
    context.fillStyle = rule;
    context.fillRect(0, waveTop, width, 1);
    context.fillRect(0, waveTop + waveHeight - 1, width, 1);

    if (peaks && duration > 0) {
      for (let x = (cx % BAR_STEP); x < width; x += BAR_STEP) {
        const t = time + (x - cx) / PIXELS_PER_SECOND;
        if (t < 0 || t > duration) continue;
        const step = BAR_STEP / PIXELS_PER_SECOND;
        const amp = peakAt(peaks, duration, t, t + step);
        const h = Math.max(1.5, amp * (waveHeight - 24));
        const inLoop = !loop || (t >= loop.a && t <= loop.b);
        context.fillStyle = inLoop ? wave : dim;
        context.fillRect(x - BAR_WIDTH / 2, mid - h / 2, BAR_WIDTH, h);
      }
    }

    // Loop region tint.
    if (loop && duration > 0) {
      const ax = cx + (loop.a - time) * PIXELS_PER_SECOND;
      const bx = cx + (loop.b - time) * PIXELS_PER_SECOND;
      context.fillStyle = cssVar(canvas, "--vm-loop-fill", "rgba(255,204,0,0.12)");
      context.fillRect(ax, waveTop, bx - ax, waveHeight);
      context.fillStyle = cssVar(canvas, "--vm-loop", "#ffcc00");
      context.fillRect(ax - 1, waveTop, 2, waveHeight);
      context.fillRect(bx - 1, waveTop, 2, waveHeight);
    }

    // Ruler: minor ticks every quarter second, labelled ticks every second.
    const rulerTop = waveTop + waveHeight;
    context.fillStyle = rule;
    context.fillRect(0, rulerTop, width, 1);
    const firstTick = Math.floor((time - cx / PIXELS_PER_SECOND) * 4) / 4;
    context.font =
      "11px -apple-system, BlinkMacSystemFont, 'SF Pro Text', Inter, system-ui, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "top";
    for (let t = firstTick; t < time + cx / PIXELS_PER_SECOND; t += 0.25) {
      if (t < 0) continue;
      const x = cx + (t - time) * PIXELS_PER_SECOND;
      const major = Math.abs(t - Math.round(t)) < 1e-6;
      context.fillStyle = rule;
      context.fillRect(Math.round(x), rulerTop, 1, major ? 8 : 4);
      if (major) {
        context.fillStyle = tickText;
        context.fillText(formatClock(Math.round(t) * 1000), x, rulerTop + 10);
      }
    }

    // Playhead: blue hairline with a dot above and below.
    context.fillStyle = accent;
    context.fillRect(cx - 0.75, waveTop - 6, 1.5, waveHeight + 12);
    context.beginPath();
    context.arc(cx, waveTop - 4, 3.2, 0, Math.PI * 2);
    context.arc(cx, waveTop + waveHeight + 4, 3.2, 0, Math.PI * 2);
    context.fill();
  }, []);

  useCanvasSize(canvasRef, draw);
  useEffect(draw, [draw, peaks, duration, time, loop]);

  function onPointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { x: event.clientX, time: stateRef.current.time };
    onScrubStart();
  }

  function onPointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = event.clientX - drag.x;
    const next = Math.min(
      stateRef.current.duration,
      Math.max(0, drag.time - dx / PIXELS_PER_SECOND),
    );
    onScrub(next);
  }

  function onPointerUp() {
    if (!dragRef.current) return;
    dragRef.current = null;
    onScrubEnd();
  }

  return (
    <canvas
      ref={canvasRef}
      className={styles.waveform}
      role="slider"
      aria-label="Scrub recording"
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      aria-valuenow={Math.round(time)}
      tabIndex={-1}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Overview: the whole recording at a glance, click or drag to seek.  */
/* ------------------------------------------------------------------ */

type OverviewProps = {
  peaks: number[] | null;
  duration: number;
  time: number;
  loop: LoopRegion | null;
  onSeek: (time: number) => void;
  onLoopChange: (loop: LoopRegion) => void;
};

type OverviewDrag = { kind: "seek" | "a" | "b" };

export function Overview({
  peaks,
  duration,
  time,
  loop,
  onSeek,
  onLoopChange,
}: OverviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({ peaks, duration, time, loop });
  stateRef.current = { peaks, duration, time, loop };
  const dragRef = useRef<OverviewDrag | null>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const { peaks, duration, time, loop } = stateRef.current;
    const ratio = canvas.width / Math.max(1, canvas.getBoundingClientRect().width);
    const width = canvas.width / ratio;
    const height = canvas.height / ratio;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);

    const wave = cssVar(canvas, "--vm-wave", "#1d1d1f");
    const played = cssVar(canvas, "--vm-wave-dim", "rgba(29,29,31,0.3)");
    const accent = cssVar(canvas, "--vm-accent", "#0a84ff");
    const loopColor = cssVar(canvas, "--vm-loop", "#ffcc00");
    const loopFill = cssVar(canvas, "--vm-loop-fill", "rgba(255,204,0,0.16)");
    const track = cssVar(canvas, "--vm-fill", "rgba(120,120,128,0.12)");
    const pad = 8;
    const inner = width - pad * 2;

    context.fillStyle = track;
    context.beginPath();
    context.roundRect(0, 0, width, height, 6);
    context.fill();

    const mid = height / 2;
    const step = 2;
    const progressX = duration > 0 ? pad + (time / duration) * inner : pad;
    if (peaks && duration > 0) {
      for (let x = pad; x < width - pad; x += step) {
        const from = ((x - pad) / inner) * duration;
        const to = ((x - pad + step) / inner) * duration;
        const amp = peakAt(peaks, duration, from, to);
        const h = Math.max(1.5, amp * (height - 12));
        context.fillStyle = x < progressX ? played : wave;
        context.fillRect(x, mid - h / 2, 1.1, h);
      }
    }

    if (loop && duration > 0) {
      const ax = pad + (loop.a / duration) * inner;
      const bx = pad + (loop.b / duration) * inner;
      context.fillStyle = loopFill;
      context.fillRect(ax, 0, bx - ax, height);
      context.fillStyle = loopColor;
      for (const x of [ax, bx]) {
        context.beginPath();
        context.roundRect(x - 4, 0, 8, height, 3);
        context.fill();
      }
      context.strokeStyle = "rgba(0,0,0,0.35)";
      context.lineWidth = 1;
      for (const x of [ax, bx]) {
        context.beginPath();
        context.moveTo(x, height * 0.3);
        context.lineTo(x, height * 0.7);
        context.stroke();
      }
    }

    context.fillStyle = accent;
    context.beginPath();
    context.roundRect(progressX - 1.5, -1, 3, height + 2, 1.5);
    context.fill();
  }, []);

  useCanvasSize(canvasRef, draw);
  useEffect(draw, [draw, peaks, duration, time, loop]);

  function timeAt(event: React.PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const pad = 8;
    const ratio = (event.clientX - rect.left - pad) / Math.max(1, rect.width - pad * 2);
    return Math.min(stateRef.current.duration, Math.max(0, ratio * stateRef.current.duration));
  }

  function onPointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    const t = timeAt(event);
    const { loop, duration } = stateRef.current;
    const rect = event.currentTarget.getBoundingClientRect();
    const tolerance = (10 / Math.max(1, rect.width - 16)) * duration;
    if (loop && Math.abs(t - loop.a) < tolerance) {
      dragRef.current = { kind: "a" };
    } else if (loop && Math.abs(t - loop.b) < tolerance) {
      dragRef.current = { kind: "b" };
    } else {
      dragRef.current = { kind: "seek" };
      onSeek(t);
    }
  }

  function onPointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const t = timeAt(event);
    const { loop } = stateRef.current;
    if (drag.kind === "seek") onSeek(t);
    else if (loop && drag.kind === "a") {
      onLoopChange({ a: Math.min(t, loop.b - 0.25), b: loop.b });
    } else if (loop && drag.kind === "b") {
      onLoopChange({ a: loop.a, b: Math.max(t, loop.a + 0.25) });
    }
  }

  function onPointerUp() {
    dragRef.current = null;
  }

  return (
    <canvas
      ref={canvasRef}
      className={styles.overview}
      role="slider"
      aria-label="Seek"
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      aria-valuenow={Math.round(time)}
      tabIndex={-1}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    />
  );
}
