"use client";

import { useCallback, useEffect, useRef } from "react";
import { formatClock } from "@/lib/recording-types";
import styles from "./VoiceMemos.module.css";

export type LoopRegion = { a: number; b: number };

function cssVar(element: HTMLElement, name: string, fallback: string) {
  return getComputedStyle(element).getPropertyValue(name).trim() || fallback;
}

const NACRE_TILE = 180;
const nacreTiles = new Map<string, HTMLCanvasElement>();

/* A mother-of-pearl tile: a cream body crossed by wavy diagonal streaks of
   soft rainbow colour and glossy ridges. Every wave uses whole-number
   frequencies over the tile, so it repeats without seams. */
function nacreTile(base: number[], iris: number, gloss: number) {
  const key = `${base.join()}/${iris}/${gloss}`;
  const cached = nacreTiles.get(key);
  if (cached) return cached;
  const size = NACRE_TILE;
  const tile = document.createElement("canvas");
  tile.width = size;
  tile.height = size;
  const context = tile.getContext("2d");
  if (!context) return tile;
  const image = context.createImageData(size, size);
  const tau = Math.PI * 2;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const v = y / size;
      const warp =
        0.9 * Math.sin(tau * (u + 2 * v)) +
        0.5 * Math.sin(tau * (3 * u - v) + 1.3) +
        0.25 * Math.sin(tau * (5 * u + 4 * v) + 0.7);
      const phase = u + 2 * v + 0.3 * warp;
      // Colour gathers in patches; between them the shell stays milky.
      const patch = Math.pow(0.5 + 0.5 * Math.sin(tau * (u - 2 * v) + warp), 2);
      const ridge = Math.pow(0.5 + 0.5 * Math.sin(tau * (2 * u + 5 * v) + 2 * warp), 8);
      const fleck = 0.5 + 0.5 * Math.sin(tau * (7 * u - 4 * v) + 3 * warp);
      const index = (y * size + x) * 4;
      for (let c = 0; c < 3; c += 1) {
        const rainbow = Math.cos(tau * (phase + c / 3));
        const value =
          base[c] +
          iris * 255 * rainbow * patch +
          gloss * 255 * ridge -
          6 * (1 - fleck);
        image.data[index + c] = Math.max(0, Math.min(255, value));
      }
      image.data[index + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  nacreTiles.set(key, tile);
  return tile;
}

function nacreFill(
  context: CanvasRenderingContext2D,
  element: HTMLElement,
  shift = 0,
) {
  const base = cssVar(element, "--vm-nacre", "226 214 192")
    .split(/[\s,]+/)
    .map(Number);
  const iris = Number(cssVar(element, "--vm-nacre-iris", "0.12")) || 0;
  const gloss = Number(cssVar(element, "--vm-nacre-gloss", "0.16")) || 0;
  const pattern = context.createPattern(nacreTile(base, iris, gloss), "repeat");
  pattern?.setTransform(new DOMMatrix().translateSelf(shift, shift * 0.4));
  return pattern ?? `rgb(${base.join(",")})`;
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
const BAR_STEP = 4;
const BAR_WIDTH = 2.2;

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
    // A hidden canvas (the mobile list view) has no box, and drawing into it
    // would produce negative sizes that throw.
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    const { peaks, duration, time, loop } = stateRef.current;
    const ratio = canvas.width / rect.width;
    const width = canvas.width / ratio;
    const height = canvas.height / ratio;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);

    const wave = cssVar(canvas, "--vm-wave", "#cbb68c");
    const rule = cssVar(canvas, "--vm-rule", "rgba(60,60,67,0.18)");
    const playhead = cssVar(canvas, "--vm-playhead", "#b8945a");
    const sheen = cssVar(canvas, "--vm-sheen", "rgba(255,255,255,0.72)");
    const glow = cssVar(canvas, "--vm-glow", "rgba(232,208,160,0.3)");
    const tickText = cssVar(canvas, "--vm-secondary", "#8e8e93");

    const rulerHeight = 26;
    const waveTop = 0;
    const waveHeight = Math.max(0, height - rulerHeight);
    const mid = waveTop + waveHeight / 2;
    const cx = width / 2;

    // A soft halo behind the playhead so the "now" reads at a glance.
    const halo = context.createRadialGradient(cx, mid, 0, cx, mid, waveHeight * 0.75);
    halo.addColorStop(0, glow);
    // Fade to the glow's own colour so the edge never greys out.
    halo.addColorStop(1, glow.replace(/[\d.]+\s*\)$/, "0)"));
    context.fillStyle = halo;
    context.fillRect(0, waveTop, width, waveHeight);

    // Centre baseline.
    context.fillStyle = rule;
    context.fillRect(0, mid - 0.5, width, 1);

    if (peaks && duration > 0) {
      // The nacre drifts slower than the bars scroll, so it glistens as it plays.
      const playedFill = nacreFill(context, canvas, time * 24);
      const step = BAR_STEP / PIXELS_PER_SECOND;
      const usable = waveHeight - 28;
      for (let x = cx % BAR_STEP; x < width; x += BAR_STEP) {
        const t = time + (x - cx) / PIXELS_PER_SECOND;
        if (t < 0 || t > duration) continue;
        const amp = Math.sqrt(peakAt(peaks, duration, t, t + step));
        const h = Math.max(2.5, amp * usable);
        const inLoop = !loop || (t >= loop.a && t <= loop.b);
        // Bars fade toward the strip's left and right edges.
        const edge = Math.min(1, Math.min(x, width - x) / (width * 0.18));
        const played = x <= cx;
        context.globalAlpha = (inLoop ? 1 : 0.28) * (0.25 + 0.75 * edge);
        context.fillStyle = played ? playedFill : wave;
        context.beginPath();
        context.roundRect(x - BAR_WIDTH / 2, mid - h / 2, BAR_WIDTH, h, BAR_WIDTH / 2);
        context.fill();
        if (played) {
          context.fillStyle = sheen;
          context.beginPath();
          context.roundRect(x - BAR_WIDTH / 2 + 0.4, mid - h * 0.36, 0.7, h * 0.72, 0.35);
          context.fill();
        }
      }
      context.globalAlpha = 1;
    }

    // Loop region.
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

    // Playhead: hairline with a dot above and below.
    context.fillStyle = playhead;
    context.fillRect(cx - 0.75, waveTop + 2, 1.5, waveHeight - 4);
    context.beginPath();
    context.arc(cx, waveTop + 4, 3.2, 0, Math.PI * 2);
    context.arc(cx, waveTop + waveHeight - 4, 3.2, 0, Math.PI * 2);
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
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    const { peaks, duration, time, loop } = stateRef.current;
    const ratio = canvas.width / rect.width;
    const width = canvas.width / ratio;
    const height = canvas.height / ratio;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);

    const wave = cssVar(canvas, "--vm-wave", "#cbb68c");
    const playhead = cssVar(canvas, "--vm-playhead", "#b8945a");
    const loopColor = cssVar(canvas, "--vm-loop", "#ffcc00");
    const loopFill = cssVar(canvas, "--vm-loop-fill", "rgba(255,204,0,0.16)");
    const track = cssVar(canvas, "--vm-fill", "rgba(120,120,128,0.12)");
    const pad = 8;
    const inner = width - pad * 2;

    context.fillStyle = track;
    context.beginPath();
    context.roundRect(0, 0, width, height, 8);
    context.fill();

    const mid = height / 2;
    const step = 2.5;
    const progressX = duration > 0 ? pad + (time / duration) * inner : pad;
    if (peaks && duration > 0) {
      const playedFill = nacreFill(context, canvas);
      for (let x = pad; x < width - pad; x += step) {
        const from = ((x - pad) / inner) * duration;
        const to = ((x - pad + step) / inner) * duration;
        const amp = Math.sqrt(peakAt(peaks, duration, from, to));
        const h = Math.max(2, amp * (height - 12));
        const played = x < progressX;
        context.globalAlpha = played ? 1 : 0.55;
        context.fillStyle = played ? playedFill : wave;
        context.beginPath();
        context.roundRect(x, mid - h / 2, 1.4, h, 0.7);
        context.fill();
      }
      context.globalAlpha = 1;
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

    context.fillStyle = playhead;
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
