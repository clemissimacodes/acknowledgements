"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import styles from "./PeelCursor.module.css";

type Point = {
  x: number;
  y: number;
  time: number;
  size: number;
  rotation: number;
  vx: number;
  vy: number;
};

const INTERACTIVE_SELECTOR =
  'a, button, summary, select, input, textarea, [role="button"], [data-cursor-frame]';

export function PeelCursor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerRef = useRef<HTMLSpanElement>(null);
  const wandRef = useRef<HTMLSpanElement>(null);
  const frameRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!finePointer.matches || reducedMotion.matches) return;

    const canvas = canvasRef.current;
    const pointer = pointerRef.current;
    const wand = wandRef.current;
    const frame = frameRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !pointer || !wand || !frame || !context) return;
    const surface = canvas;
    const cursorElement = pointer;
    const wandElement = wand;
    const cropFrame = frame;
    const drawing = context;

    document.documentElement.classList.add("peel-cursor-enabled");

    let points: Point[] = [];
    let animationFrame = 0;
    let hovered: Element | null = null;
    let targetX = -100;
    let targetY = -100;
    let fairyX = -100;
    let fairyY = -100;
    let lastSparkX = -100;
    let lastSparkY = -100;
    let sparkleIndex = 0;
    let visible = false;

    function resizeCanvas() {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      surface.width = Math.round(window.innerWidth * ratio);
      surface.height = Math.round(window.innerHeight * ratio);
      surface.style.width = `${window.innerWidth}px`;
      surface.style.height = `${window.innerHeight}px`;
      drawing.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    function positionFrame() {
      if (!hovered) return;
      const rect = hovered.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      cropFrame.style.setProperty("--frame-x", `${rect.left - 2}px`);
      cropFrame.style.setProperty("--frame-y", `${rect.top - 2}px`);
      cropFrame.style.setProperty("--frame-width", `${rect.width + 4}px`);
      cropFrame.style.setProperty("--frame-height", `${rect.height + 4}px`);
    }

    function setHovered(target: EventTarget | null) {
      const element =
        target instanceof Element ? target.closest(INTERACTIVE_SELECTOR) : null;
      if (element === hovered) return;
      hovered = element;
      cropFrame.classList.toggle("is-visible", Boolean(hovered));
      if (hovered) positionFrame();
    }

    function addSpark(
      x: number,
      y: number,
      burst = false,
      angle = Math.random() * Math.PI * 2,
    ) {
      const speed = burst ? 0.45 + Math.random() * 0.5 : 0;
      points.push({
        x,
        y,
        time: performance.now(),
        size: burst ? 2.4 + Math.random() * 2.4 : 1.5 + (sparkleIndex % 3) * 0.65,
        rotation: angle + Math.PI / 4,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
      });
      sparkleIndex += 1;
      if (points.length > 36) points.shift();
    }

    function draw(now: number) {
      drawing.clearRect(0, 0, window.innerWidth, window.innerHeight);
      points = points.filter((point) => now - point.time < 760);

      for (const [pointIndex, point] of points.entries()) {
        const age = now - point.time;
        const life = Math.max(0, 1 - age / 760);
        const x = point.x + point.vx * age;
        const y = point.y + point.vy * age + point.vy * age * age * 0.00045;
        const radius = point.size * (0.7 + life * 0.3);
        const horizontal = radius * 0.38;

        drawing.save();
        drawing.translate(x, y);
        drawing.rotate(point.rotation);
        const pearl = pointIndex % 3;
        drawing.strokeStyle =
          pearl === 0
            ? `rgba(126, 211, 211, ${life * 0.9})`
            : pearl === 1
              ? `rgba(226, 215, 247, ${life * 0.86})`
              : `rgba(247, 255, 253, ${life * 0.94})`;
        drawing.shadowColor =
          pearl === 1 ? "rgba(210, 190, 240, 0.72)" : "rgba(175, 238, 238, 0.82)";
        drawing.shadowBlur = 4;
        drawing.lineWidth = 0.78;
        drawing.beginPath();
        drawing.moveTo(-radius, 0);
        drawing.quadraticCurveTo(-horizontal, 0, 0, -radius * 2.2);
        drawing.quadraticCurveTo(horizontal, 0, radius, 0);
        drawing.quadraticCurveTo(horizontal, 0, 0, radius * 2.2);
        drawing.quadraticCurveTo(-horizontal, 0, -radius, 0);
        drawing.stroke();
        drawing.fillStyle = `rgba(255, 255, 255, ${life * 0.82})`;
        drawing.fillRect(-0.55, -0.55, 1.1, 1.1);
        drawing.restore();
      }

      if (visible) {
        const desiredX = targetX + (hovered ? 24 : 16);
        const desiredY = targetY - (hovered ? 60 : 52);
        fairyX += (desiredX - fairyX) * 0.18;
        fairyY += (desiredY - fairyY) * 0.18;
        const lagX = desiredX - fairyX;
        const lagY = desiredY - fairyY;
        const lag = Math.hypot(lagX, lagY);
        if (lag > 24) {
          fairyX = desiredX - (lagX / lag) * 24;
          fairyY = desiredY - (lagY / lag) * 24;
        }
        cursorElement.style.setProperty("--fairy-x", `${fairyX}px`);
        cursorElement.style.setProperty("--fairy-y", `${fairyY}px`);
        const handX = fairyX + 7;
        const handY = fairyY + 42;
        wandElement.style.setProperty(
          "--wand-angle",
          `${Math.atan2(handY - targetY, handX - targetX)}rad`,
        );
        wandElement.style.setProperty(
          "--wand-length",
          `${Math.hypot(handX - targetX, handY - targetY)}px`,
        );
      }
      animationFrame = window.requestAnimationFrame(draw);
    }

    function onPointerMove(event: PointerEvent) {
      if (event.pointerType === "touch") return;
      visible = true;
      cursorElement.classList.add("is-visible");
      wandElement.classList.add(styles.wandVisible);
      surface.classList.add("is-visible");
      setHovered(event.target);

      targetX = event.clientX;
      targetY = event.clientY;
      wandElement.style.left = `${targetX}px`;
      wandElement.style.top = `${targetY}px`;
      if (fairyX < -50) {
        fairyX = targetX + 16;
        fairyY = targetY - 52;
      }

      const sparkDistance = Math.hypot(
        targetX - lastSparkX,
        targetY - lastSparkY,
      );
      if (!hovered && sparkDistance > 13) {
        addSpark(targetX, targetY);
        lastSparkX = targetX;
        lastSparkY = targetY;
      }
    }

    function onPointerDown(event: PointerEvent) {
      if (!visible || event.pointerType === "touch") return;
      cursorElement.classList.remove("is-pressed");
      cursorElement.classList.remove(styles.flick);
      wandElement.classList.remove(styles.wandFlick);
      void cursorElement.offsetWidth;
      cursorElement.classList.add("is-pressed", styles.flick);
      wandElement.classList.add(styles.wandFlick);
      window.setTimeout(() => cursorElement.classList.remove(styles.flick), 360);
      window.setTimeout(() => wandElement.classList.remove(styles.wandFlick), 360);
      for (let index = 0; index < 7; index += 1) {
        addSpark(
          event.clientX,
          event.clientY,
          true,
          (index / 7) * Math.PI * 2,
        );
      }
      const sigil = document.createElement("span");
      sigil.className = styles.sigil;
      sigil.style.left = `${event.clientX}px`;
      sigil.style.top = `${event.clientY}px`;
      sigil.setAttribute("aria-hidden", "true");
      document.body.appendChild(sigil);
      window.setTimeout(() => sigil.remove(), 720);
    }

    function hide() {
      visible = false;
      hovered = null;
      points = [];
      fairyX = -100;
      fairyY = -100;
      lastSparkX = -100;
      lastSparkY = -100;
      cursorElement.classList.remove("is-visible");
      wandElement.classList.remove(styles.wandVisible);
      cropFrame.classList.remove("is-visible");
      surface.classList.remove("is-visible");
    }

    resizeCanvas();
    animationFrame = window.requestAnimationFrame(draw);
    window.addEventListener("resize", resizeCanvas);
    window.addEventListener("scroll", positionFrame, true);
    document.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("pointerdown", onPointerDown, { passive: true });
    document.documentElement.addEventListener("mouseleave", hide);

    return () => {
      document.documentElement.classList.remove("peel-cursor-enabled");
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("scroll", positionFrame, true);
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerdown", onPointerDown);
      document.documentElement.removeEventListener("mouseleave", hide);
    };
  }, []);

  return (
    <div className="peel-cursor" aria-hidden="true">
      <canvas ref={canvasRef} className="peel-cursor-trail" />
      <span ref={frameRef} className="peel-cursor-frame">
        <i />
        <i />
        <i />
        <i />
      </span>
      <span
        ref={pointerRef}
        className={`peel-cursor-pointer ${styles.follower}`}
      >
        <svg
          className={styles.wings}
          viewBox="0 0 100 64"
          focusable="false"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="wing-blue" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0" stopColor="#fff1b9" stopOpacity=".52" />
              <stop offset=".32" stopColor="#d5e7ee" stopOpacity=".72" />
              <stop offset=".72" stopColor="#9ebdd7" stopOpacity=".68" />
              <stop offset="1" stopColor="#789dbd" stopOpacity=".52" />
            </linearGradient>
            <linearGradient id="wing-pearl" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#fff8cf" stopOpacity=".66" />
              <stop offset=".45" stopColor="#dce9ee" stopOpacity=".72" />
              <stop offset="1" stopColor="#a9c8dd" stopOpacity=".58" />
            </linearGradient>
            <filter id="wing-sketch" x="-15%" y="-15%" width="130%" height="130%">
              <feTurbulence
                type="fractalNoise"
                baseFrequency=".045"
                numOctaves="2"
                seed="8"
                result="paper"
              />
              <feDisplacementMap
                in="SourceGraphic"
                in2="paper"
                scale=".7"
                xChannelSelector="R"
                yChannelSelector="G"
              />
            </filter>
          </defs>
          <g className={styles.upperWing} filter="url(#wing-sketch)">
            <path
              d="M50 38C40 22 19 4 7 8c3 14 23 29 43 32Z"
              fill="url(#wing-blue)"
              stroke="#668ca9"
              strokeOpacity=".62"
              strokeWidth="1.25"
            />
            <path
              d="M50 38C60 22 81 4 93 8c-3 14-23 29-43 32Z"
              fill="url(#wing-blue)"
              stroke="#668ca9"
              strokeOpacity=".62"
              strokeWidth="1.25"
            />
            <path
              d="M50 39C32 25 10 25 2 33c9 12 31 14 48 8Z"
              fill="url(#wing-pearl)"
              stroke="#789db4"
              strokeOpacity=".58"
              strokeWidth="1.2"
            />
            <path
              d="M50 39C68 25 90 25 98 33c-9 12-31 14-48 8Z"
              fill="url(#wing-pearl)"
              stroke="#789db4"
              strokeOpacity=".58"
              strokeWidth="1.2"
            />
            <path
              d="M49 38C36 24 23 14 10 9m40 30c14-15 27-25 40-30M48 40c-15-7-28-9-42-7m46 7c15-7 28-9 42-7"
              fill="none"
              stroke="#6f91aa"
              strokeOpacity=".32"
              strokeWidth=".72"
            />
            <path
              d="m84 10 1.2 3.3 3.3 1.2-3.3 1.2-1.2 3.3-1.2-3.3-3.3-1.2 3.3-1.2Zm6 7 .7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7Z"
              fill="#fbffff"
              fillOpacity=".78"
            />
          </g>
          <g className={styles.lowerWing} filter="url(#wing-sketch)">
            <path
              d="M50 40C36 35 20 39 18 49c6 1 4 7 12 5 4 6 14-5 20-12Z"
              fill="url(#wing-blue)"
              stroke="#7698b3"
              strokeOpacity=".58"
              strokeWidth="1.2"
            />
            <path
              d="M50 40C64 35 80 39 82 49c-6 1-4 7-12 5-4 6-14-5-20-12Z"
              fill="url(#wing-blue)"
              stroke="#7698b3"
              strokeOpacity=".58"
              strokeWidth="1.2"
            />
            <path
              d="M50 41C40 40 30 43 22 49m28-8c10-1 20 2 28 8"
              fill="none"
              stroke="#718fa8"
              strokeOpacity=".3"
              strokeWidth=".7"
            />
          </g>
        </svg>
        <Image src="/clemi/still.png" alt="" width={43} height={59} />
      </span>
      <span ref={wandRef} className={styles.wandCursor}>
        <i />
        <b />
      </span>
    </div>
  );
}
