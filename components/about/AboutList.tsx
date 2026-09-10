"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

export type AboutNote = {
  text: string;
  label: string;
  href?: string;
  image?: {
    src: string;
    alt: string;
  };
};

type Point = { x: number; y: number };
type Size = { width: number; height: number };

const VIDEO_SIZE = { width: 1080, height: 1358 };

const INITIAL_CENTERS: Point[] = [
  { x: 0.375, y: 0.32 },
  { x: 0.25, y: 0.206 },
  { x: 0.792, y: 0.28 },
  { x: 0.509, y: 0.456 },
  { x: 0.588, y: 0.643 },
  { x: 0.218, y: 0.721 },
];

const GENERATED_CENTERS: Point[] = [
  { x: 0.78, y: 0.72 },
  { x: 0.16, y: 0.5 },
  { x: 0.72, y: 0.18 },
  { x: 0.46, y: 0.82 },
];

function focusBackgroundPosition(point: Point) {
  const heightScale = 3.9;
  const widthScale = heightScale * (1080 / 1358);
  const horizontal =
    ((0.5 - point.x * widthScale) / (1 - widthScale)) * 100;
  const vertical =
    ((0.5 - point.y * heightScale) / (1 - heightScale)) * 100;
  return `${horizontal}% ${vertical}%`;
}

function containPosition(point: Point, container: Size) {
  if (!container.width || !container.height) return point;

  const scale = Math.min(
    container.width / VIDEO_SIZE.width,
    container.height / VIDEO_SIZE.height,
  );
  const renderedWidth = VIDEO_SIZE.width * scale;
  const renderedHeight = VIDEO_SIZE.height * scale;

  return {
    x:
      (point.x * renderedWidth + (container.width - renderedWidth) / 2) /
      container.width,
    y:
      (point.y * renderedHeight + (container.height - renderedHeight) / 2) /
      container.height,
  };
}

function trackCenter(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  previous: Point,
) {
  const startX = Math.max(0, Math.floor((previous.x - 0.09) * width));
  const endX = Math.min(width - 1, Math.ceil((previous.x + 0.09) * width));
  const startY = Math.max(0, Math.floor((previous.y - 0.075) * height));
  const endY = Math.min(height - 1, Math.ceil((previous.y + 0.075) * height));
  let bestX = Math.round(previous.x * width);
  let bestY = Math.round(previous.y * height);
  let bestScore = -Infinity;

  for (let y = startY; y <= endY; y += 1) {
    for (let x = startX; x <= endX; x += 1) {
      const offset = (y * width + x) * 4;
      const red = pixels[offset] ?? 255;
      const green = pixels[offset + 1] ?? 255;
      const blue = pixels[offset + 2] ?? 255;
      const maximum = Math.max(red, green, blue);
      const minimum = Math.min(red, green, blue);
      const chroma = maximum - minimum;
      const darkness = 255 - (red + green + blue) / 3;
      const distance = Math.hypot(
        x - previous.x * width,
        y - previous.y * height,
      );
      const score = chroma * 1.2 + darkness * 0.9 - distance * 1.15;

      if (score > bestScore) {
        bestScore = score;
        bestX = x;
        bestY = y;
      }
    }
  }

  const radius = Math.max(4, Math.round(width * 0.022));
  let weightedX = 0;
  let weightedY = 0;
  let totalWeight = 0;
  for (
    let y = Math.max(0, bestY - radius);
    y <= Math.min(height - 1, bestY + radius);
    y += 1
  ) {
    for (
      let x = Math.max(0, bestX - radius);
      x <= Math.min(width - 1, bestX + radius);
      x += 1
    ) {
      const offset = (y * width + x) * 4;
      const red = pixels[offset] ?? 255;
      const green = pixels[offset + 1] ?? 255;
      const blue = pixels[offset + 2] ?? 255;
      const chroma = Math.max(red, green, blue) - Math.min(red, green, blue);
      const darkness = 255 - (red + green + blue) / 3;
      const weight = Math.max(0, chroma + darkness - 65);
      weightedX += x * weight;
      weightedY += y * weight;
      totalWeight += weight;
    }
  }

  return totalWeight > 0
    ? { x: weightedX / totalWeight / width, y: weightedY / totalWeight / height }
    : previous;
}

export function AboutList({
  title,
  notes,
}: {
  title: string;
  notes: AboutNote[];
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const trackerCanvasRef = useRef<HTMLCanvasElement>(null);
  const [centers, setCenters] = useState<Point[]>(INITIAL_CENTERS);
  const [stageSize, setStageSize] = useState<Size>({ width: 0, height: 0 });
  const centersRef = useRef<Point[]>(INITIAL_CENTERS);
  const [active, setActive] = useState<number | null>(null);
  const [snapshot, setSnapshot] = useState("");
  const activeNote = active === null ? null : notes[active];
  const activeCenter =
    centers[active ?? 0] ??
    GENERATED_CENTERS[((active ?? INITIAL_CENTERS.length) - INITIAL_CENTERS.length) % GENERATED_CENTERS.length] ??
    { x: 0.5, y: 0.5 };

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const updateSize = () => {
      setStageSize({ width: stage.clientWidth, height: stage.clientHeight });
    };
    const observer = new ResizeObserver(updateSize);
    updateSize();
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setActive(null);
        if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          void videoRef.current?.play().catch(() => undefined);
        }
      }
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = trackerCanvasRef.current;
    if (!video || !canvas) return;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return;
    const videoElement = video;
    const trackerCanvas = canvas;
    const trackerContext = context;

    let animationFrame = 0;
    let lastTrackedAt = 0;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    function followCircles(timestamp: number) {
      if (
        !reducedMotion.matches &&
        active === null &&
        videoElement.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
        timestamp - lastTrackedAt > 85
      ) {
        lastTrackedAt = timestamp;
        trackerCanvas.width = 216;
        trackerCanvas.height = 272;
        trackerContext.drawImage(
          videoElement,
          0,
          0,
          trackerCanvas.width,
          trackerCanvas.height,
        );
        const pixels = trackerContext.getImageData(
          0,
          0,
          trackerCanvas.width,
          trackerCanvas.height,
        ).data;
        const previous = centersRef.current;
        const tracked = previous.map((point) =>
          trackCenter(
            pixels,
            trackerCanvas.width,
            trackerCanvas.height,
            point,
          ),
        );
        const smoothed = tracked.map((point, index) => {
          const prior = previous[index] ?? point;
          return {
            x: prior.x + (point.x - prior.x) * 0.16,
            y: prior.y + (point.y - prior.y) * 0.16,
          };
        });
        const next = smoothed.map((point, index) => {
          const overlapsAnotherFact = smoothed.some(
            (other, otherIndex) =>
              otherIndex !== index &&
              Math.hypot(point.x - other.x, point.y - other.y) < 0.075,
          );
          return overlapsAnotherFact ? previous[index] ?? point : point;
        });
        centersRef.current = next;
        setCenters(next);
      }
      animationFrame = window.requestAnimationFrame(followCircles);
    }

    function handleMotionPreference() {
      if (reducedMotion.matches) {
        videoElement.pause();
        centersRef.current = INITIAL_CENTERS;
        setCenters(INITIAL_CENTERS);
      } else if (active === null) {
        void videoElement.play().catch(() => undefined);
      }
    }

    videoElement.playbackRate = 0.55;
    handleMotionPreference();
    reducedMotion.addEventListener("change", handleMotionPreference);
    animationFrame = window.requestAnimationFrame(followCircles);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      reducedMotion.removeEventListener("change", handleMotionPreference);
    };
  }, [active]);

  function openNote(index: number) {
    const video = videoRef.current;
    if (!video) return;
    video.pause();

    const canvas = document.createElement("canvas");
    const width = Math.min(720, video.videoWidth || 720);
    const height = Math.round(
      width * ((video.videoHeight || 1358) / (video.videoWidth || 1080)),
    );
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d")?.drawImage(video, 0, 0, width, height);
    setSnapshot(canvas.toDataURL("image/jpeg", 0.86));
    setActive(index);
  }

  function closeNote() {
    setActive(null);
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      void videoRef.current?.play().catch(() => undefined);
    }
  }

  return (
    <section className="about-orbit" aria-labelledby="about-orbit-title">
      <h1 className="visually-hidden" id="about-orbit-title">
        {title}
      </h1>

      <div className="about-orbit-stage" ref={stageRef}>
        <video
          className="about-orbit-art"
          ref={videoRef}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden="true"
          disablePictureInPicture
        >
          <source
            src="/about/elegant-minimal-circles.webm?v=beige4-hd"
            type="video/webm"
          />
          <source
            src="/about/elegant-minimal-circles.m4v?v=beige4-hd"
            type="video/mp4"
          />
        </video>
        <canvas ref={trackerCanvasRef} hidden />
        {notes.slice(0, INITIAL_CENTERS.length).map((note, index) => {
          const sourceCenter =
            centers[index] ?? INITIAL_CENTERS[index] ?? { x: 0.5, y: 0.5 };
          const position = containPosition(sourceCenter, stageSize);

          return (
            <button
              key={note.text}
              className="about-orbit-target"
              type="button"
              style={{
                left: `${position.x * 100}%`,
                top: `${position.y * 100}%`,
              }}
              onClick={() => openNote(index)}
              aria-label={`Magnify: ${note.text}`}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              <small>{note.label}</small>
            </button>
          );
        })}
        {notes.slice(INITIAL_CENTERS.length).map((note, extraIndex) => {
          const index = INITIAL_CENTERS.length + extraIndex;
          const position =
            GENERATED_CENTERS[extraIndex % GENERATED_CENTERS.length] ??
            { x: 0.5, y: 0.5 };
          const style = {
            left: `${position.x * 100}%`,
            top: `${position.y * 100}%`,
            animationDelay: `${extraIndex * -1.7}s`,
          } satisfies CSSProperties;

          return (
            <div className="about-generated-thing" key={note.text} style={style}>
              <span className="about-generated-watercolor" aria-hidden="true" />
              <button
                className="about-orbit-target"
                type="button"
                onClick={() => openNote(index)}
                aria-label={`Magnify: ${note.text}`}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                <small>{note.label}</small>
              </button>
            </div>
          );
        })}
      </div>

      {activeNote ? (
        <div
          className="about-focus"
          role="dialog"
          aria-modal="true"
          aria-label={`Tiny thing ${(active ?? 0) + 1}`}
          onClick={closeNote}
        >
          <button
            className="about-focus-close"
            type="button"
            onClick={closeNote}
          >
            Close
          </button>
          <div
            className="about-focus-circle"
            style={{
              backgroundImage: snapshot ? `url(${snapshot})` : undefined,
              backgroundPosition: focusBackgroundPosition(activeCenter),
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <span className="about-focus-number">
              {String((active ?? 0) + 1).padStart(2, "0")}
            </span>
            <p>
              {activeNote.href ? (
                <a href={activeNote.href} target="_blank" rel="noreferrer">
                  {activeNote.text}
                </a>
              ) : (
                activeNote.text
              )}
            </p>
            {activeNote.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={activeNote.image.src} alt={activeNote.image.alt} />
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
