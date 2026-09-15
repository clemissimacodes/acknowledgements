"use client";

import { useEffect, useRef } from "react";

type Point = {
  x: number;
  y: number;
  time: number;
};

const INTERACTIVE_SELECTOR =
  'a, button, summary, select, input, textarea, [role="button"], [data-cursor-frame]';

export function PeelCursor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerRef = useRef<HTMLSpanElement>(null);
  const frameRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!finePointer.matches || reducedMotion.matches) return;

    const canvas = canvasRef.current;
    const pointer = pointerRef.current;
    const frame = frameRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !pointer || !frame || !context) return;
    const surface = canvas;
    const cursorElement = pointer;
    const cropFrame = frame;
    const drawing = context;

    document.documentElement.classList.add("peel-cursor-enabled");

    let points: Point[] = [];
    let animationFrame = 0;
    let hovered: Element | null = null;
    let lastX = -100;
    let lastY = -100;
    let lastAngle = 0;
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
      cropFrame.style.setProperty("--frame-x", `${rect.left - 7}px`);
      cropFrame.style.setProperty("--frame-y", `${rect.top - 7}px`);
      cropFrame.style.setProperty("--frame-width", `${rect.width + 14}px`);
      cropFrame.style.setProperty("--frame-height", `${rect.height + 14}px`);
    }

    function setHovered(target: EventTarget | null) {
      const element =
        target instanceof Element ? target.closest(INTERACTIVE_SELECTOR) : null;
      if (element === hovered) return;
      hovered = element;
      cropFrame.classList.toggle("is-visible", Boolean(hovered));
      cursorElement.classList.toggle("is-framing", Boolean(hovered));
      if (hovered) {
        points = [];
        positionFrame();
      }
    }

    function draw(now: number) {
      drawing.clearRect(0, 0, window.innerWidth, window.innerHeight);
      points = points.filter((point) => now - point.time < 720);

      if (points.length > 1) {
        for (let index = 1; index < points.length; index += 1) {
          const previous = points[index - 1];
          const current = points[index];
          const age = now - current.time;
          const life = Math.max(0, 1 - age / 720);
          const progress = index / points.length;
          const width = 1.2 + progress * 5.8;

          drawing.beginPath();
          drawing.moveTo(previous.x, previous.y);
          drawing.lineTo(current.x, current.y);
          drawing.lineCap = "round";
          drawing.lineJoin = "round";
          drawing.lineWidth = width;
          drawing.strokeStyle = `rgba(210, 91, 28, ${life * 0.78})`;
          drawing.stroke();

          drawing.beginPath();
          drawing.moveTo(previous.x - 0.8, previous.y - 0.8);
          drawing.lineTo(current.x - 0.8, current.y - 0.8);
          drawing.lineWidth = Math.max(0.6, width * 0.24);
          drawing.strokeStyle = `rgba(255, 201, 123, ${life * 0.72})`;
          drawing.stroke();
        }
      }

      animationFrame = window.requestAnimationFrame(draw);
    }

    function onPointerMove(event: PointerEvent) {
      if (event.pointerType === "touch") return;
      visible = true;
      cursorElement.classList.add("is-visible");
      surface.classList.add("is-visible");
      setHovered(event.target);

      const dx = event.clientX - lastX;
      const dy = event.clientY - lastY;
      const distance = Math.hypot(dx, dy);
      if (distance > 0.5) lastAngle = Math.atan2(dy, dx);

      lastX = event.clientX;
      lastY = event.clientY;
      cursorElement.style.setProperty("--cursor-x", `${lastX}px`);
      cursorElement.style.setProperty("--cursor-y", `${lastY}px`);
      cursorElement.style.setProperty("--cursor-angle", `${lastAngle}rad`);

      if (!hovered && distance > 1) {
        const curl = Math.sin(performance.now() / 95) * Math.min(distance, 9) * 0.2;
        points.push({
          x: lastX - Math.sin(lastAngle) * curl,
          y: lastY + Math.cos(lastAngle) * curl,
          time: performance.now(),
        });
        if (points.length > 42) points.shift();
      }
    }

    function onPointerDown(event: PointerEvent) {
      if (!visible || event.pointerType === "touch") return;
      cursorElement.classList.remove("is-pressed");
      void cursorElement.offsetWidth;
      cursorElement.classList.add("is-pressed");

      const tear = document.createElement("span");
      tear.className = "peel-cursor-tear";
      tear.style.left = `${event.clientX}px`;
      tear.style.top = `${event.clientY}px`;
      tear.setAttribute("aria-hidden", "true");
      document.body.appendChild(tear);
      window.setTimeout(() => tear.remove(), 650);
    }

    function hide() {
      visible = false;
      hovered = null;
      points = [];
      cursorElement.classList.remove("is-visible", "is-framing");
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
      <span ref={pointerRef} className="peel-cursor-pointer">
        <i />
      </span>
    </div>
  );
}
