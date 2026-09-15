"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";

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
      if (points.length > 28) points.shift();
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
        drawing.strokeStyle =
          pointIndex % 2
            ? `rgba(77, 142, 142, ${life * 0.82})`
            : `rgba(26, 23, 20, ${life * 0.68})`;
        drawing.lineWidth = 0.7;
        drawing.beginPath();
        drawing.moveTo(-radius, 0);
        drawing.quadraticCurveTo(-horizontal, 0, 0, -radius * 2.2);
        drawing.quadraticCurveTo(horizontal, 0, radius, 0);
        drawing.quadraticCurveTo(horizontal, 0, 0, radius * 2.2);
        drawing.quadraticCurveTo(-horizontal, 0, -radius, 0);
        drawing.stroke();
        drawing.restore();
      }

      if (visible) {
        const desiredX = targetX - 52;
        const desiredY = targetY - 30;
        fairyX += (desiredX - fairyX) * 0.24;
        fairyY += (desiredY - fairyY) * 0.24;
        const lagX = desiredX - fairyX;
        const lagY = desiredY - fairyY;
        const lag = Math.hypot(lagX, lagY);
        if (lag > 24) {
          fairyX = desiredX - (lagX / lag) * 24;
          fairyY = desiredY - (lagY / lag) * 24;
        }
        const wandX = fairyX + 34;
        const wandY = fairyY + 32;
        const dx = targetX - wandX;
        const dy = targetY - wandY;
        cursorElement.style.setProperty("--fairy-x", `${fairyX}px`);
        cursorElement.style.setProperty("--fairy-y", `${fairyY}px`);
        cursorElement.style.setProperty("--wand-angle", `${Math.atan2(dy, dx)}rad`);
        cursorElement.style.setProperty("--wand-length", `${Math.hypot(dx, dy)}px`);
      }
      animationFrame = window.requestAnimationFrame(draw);
    }

    function onPointerMove(event: PointerEvent) {
      if (event.pointerType === "touch") return;
      visible = true;
      cursorElement.classList.add("is-visible");
      surface.classList.add("is-visible");
      setHovered(event.target);

      targetX = event.clientX;
      targetY = event.clientY;
      if (fairyX < -50) {
        fairyX = targetX - 52;
        fairyY = targetY - 30;
      }

      const sparkDistance = Math.hypot(
        targetX - lastSparkX,
        targetY - lastSparkY,
      );
      if (!hovered && sparkDistance > 17) {
        addSpark(targetX, targetY);
        lastSparkX = targetX;
        lastSparkY = targetY;
      }
    }

    function onPointerDown(event: PointerEvent) {
      if (!visible || event.pointerType === "touch") return;
      cursorElement.classList.remove("is-pressed");
      void cursorElement.offsetWidth;
      cursorElement.classList.add("is-pressed");
      for (let index = 0; index < 7; index += 1) {
        addSpark(
          event.clientX,
          event.clientY,
          true,
          (index / 7) * Math.PI * 2,
        );
      }
    }

    function hide() {
      visible = false;
      hovered = null;
      points = [];
      fairyX = -100;
      fairyY = -100;
      lastSparkX = -100;
      lastSparkY = -100;
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
        <span className="fairy-cursor-wings">
          <i />
          <i />
        </span>
        <Image src="/clemi/still.png" alt="" width={43} height={59} />
        <i className="fairy-cursor-wand">
          <b />
        </i>
      </span>
    </div>
  );
}
