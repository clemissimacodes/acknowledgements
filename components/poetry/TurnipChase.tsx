"use client";

import { useEffect, useRef } from "react";

const CAST = [
  {
    src: "/poetry/turnip-leap.png",
    face: 1,
    size: 118,
    from: { x: -0.12, y: 0.42 },
  },
  {
    src: "/poetry/turnip-run.png",
    face: -1,
    size: 94,
    from: { x: 1.12, y: 0.08 },
  },
  {
    src: "/poetry/turnip-scurry.png",
    face: 1,
    size: 70,
    from: { x: 0.48, y: 1.14 },
  },
] as const;

const PERIOD = 5.8;
const ENTER = 2.1;

function easeOut(t: number) {
  const u = Math.min(Math.max(t, 0), 1);
  return 1 - (1 - u) ** 3;
}

function mix(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function dance(
  beat: number,
  width: number,
  height: number,
  who: number,
  dt = 0,
) {
  const t = beat + dt;
  const cx = width * 0.6;
  const cy = height * 0.68;
  const rx = Math.min(width * 0.27, 230);
  const ry = Math.min(height * 0.2, 145);

  if (who === 0) {
    return {
      x: cx + Math.cos(t) * rx,
      y: cy + Math.sin(t) * ry,
    };
  }

  if (who === 1) {
    return {
      x: cx + 28 + Math.cos(-t + 1.05) * rx * 0.76,
      y: cy - 22 + Math.sin(-t + 1.05) * ry * 0.88,
    };
  }

  return {
    x: cx - 16 + Math.sin(t * 2) * rx * 0.58,
    y: cy + 10 + Math.sin(t * 2) * Math.cos(t * 2) * ry * 1.2,
  };
}

export function TurnipChase() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const images = Array.from(root.querySelectorAll("img"));
    const started = performance.now();

    const paint = (now: number) => {
      const width = root.clientWidth;
      const height = root.clientHeight;
      const elapsed = (now - started) / 1000;
      const beat = ((elapsed * Math.PI * 2) / PERIOD) % (Math.PI * 2);
      const arrived = easeOut(elapsed / ENTER);

      CAST.forEach((cast, i) => {
        const img = images[i];
        if (!img) return;
        const here = dance(beat, width, height, i);
        const next = dance(beat, width, height, i, 0.05);
        const x = mix(cast.from.x * width, here.x, arrived);
        const y = mix(cast.from.y * height, here.y, arrived);
        const dx = mix(
          here.x - cast.from.x * width,
          next.x - here.x,
          arrived,
        );
        const hop =
          reduce.matches || arrived < 0.85
            ? 0
            : Math.abs(Math.sin(beat * 2 + i * 2.1)) * 4.5;
        const flip = Math.sign(dx || 1) * cast.face;
        img.style.width = `${cast.size}px`;
        img.style.transform = `translate3d(${x - cast.size / 2}px, ${y - cast.size / 2 + hop}px, 0) scaleX(${flip})`;
      });
    };

    paint(performance.now());
    root.classList.add("is-ready");
    if (reduce.matches) return;

    let frame = 0;
    const tick = (now: number) => {
      paint(now);
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <div ref={rootRef} className="turnip-chase" aria-hidden="true">
      {CAST.map((cast) => (
        <img key={cast.src} src={cast.src} alt="" draggable={false} />
      ))}
    </div>
  );
}
