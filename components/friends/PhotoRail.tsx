"use client";

import { useEffect, useRef } from "react";

type Shot = { src: string; alt: string };

export function PhotoRail({ shots, label }: { shots: Shot[]; label: string }) {
  const railRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail || shots.length === 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Chromium/Safari 18+ can use CSS scroll-driven animation; skip JS there.
    if (CSS.supports("animation-timeline", "view()")) return;

    const frames = [...rail.querySelectorAll<HTMLElement>(".ff-parallax-frame img")];
    if (!frames.length) return;

    let ticking = false;
    const update = () => {
      ticking = false;
      const vh = window.innerHeight || 1;
      for (const img of frames) {
        const frame = img.parentElement;
        if (!frame) continue;
        const rect = frame.getBoundingClientRect();
        const progress = (vh - rect.top) / (vh + rect.height);
        const y = (Math.min(1, Math.max(0, progress)) - 0.5) * 16;
        img.style.setProperty("--ff-parallax-y", `${y}%`);
      }
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [shots.length]);

  if (!shots.length) return null;

  return (
    <div className="ff-photo-rail" ref={railRef} aria-label={label}>
      {shots.map((shot) => (
        <figure className="ff-parallax-frame" key={shot.src}>
          <img src={shot.src} alt={shot.alt} loading="lazy" decoding="async" />
        </figure>
      ))}
    </div>
  );
}
