"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export type PhotoIndexRoll = {
  slug: string;
  title: string;
  note: string;
  year: number | null;
  frameCount: number;
  cover: { url: string; width: number; height: number } | null;
};

function ratio(cover: PhotoIndexRoll["cover"]) {
  if (!cover || !cover.width || !cover.height) return 3 / 2;
  return cover.width / cover.height;
}

export function PhotoIndex({
  rolls,
  heading,
}: {
  rolls: PhotoIndexRoll[];
  heading?: React.ReactNode;
}) {
  const [active, setActive] = useState<number | null>(null);
  const [shown, setShown] = useState<number | null>(null);
  const warmed = useRef(false);

  // Warm the browser cache so the first hover is instant.
  useEffect(() => {
    if (warmed.current) return;
    warmed.current = true;
    const handles = rolls
      .map((roll) => roll.cover?.url)
      .filter((url): url is string => Boolean(url))
      .map((url) => {
        const image = new Image();
        image.decoding = "async";
        image.src = url;
        return image;
      });
    return () => {
      handles.forEach((image) => {
        image.src = "";
      });
    };
  }, [rolls]);

  // Keep the last image mounted while fading out so it does not blink.
  useEffect(() => {
    if (active !== null) setShown(active);
  }, [active]);

  const preview = shown !== null ? rolls[shown] : null;

  return (
    <div
      className={`photo-index${active !== null ? " is-peeking" : ""}`}
      onMouseLeave={() => setActive(null)}
    >
      {/* Painted first so the rows (positioned, later in tree order) can
          blend against it with mix-blend-mode: difference. */}
      <div
        className="photo-peek"
        aria-hidden="true"
        style={{ "--peek-ratio": ratio(preview?.cover ?? null) } as React.CSSProperties}
      >
        {preview?.cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview.cover.url} alt="" decoding="async" />
        ) : null}
      </div>
      {heading}
      <div className="photo-index-head" aria-hidden="true">
        <span className="photo-col-no">no.</span>
        <span className="photo-col-title">roll</span>
        <span className="photo-col-note">note</span>
        <span className="photo-col-year">year</span>
      </div>
      <ol className="photo-index-list">
        {rolls.map((roll, index) => (
          <li
            key={roll.slug}
            className={`photo-row${active === index ? " is-active" : ""}`}
          >
            <Link
              href={`/photography/${roll.slug}`}
              onMouseEnter={() => setActive(index)}
              onFocus={() => setActive(index)}
              onBlur={() => setActive(null)}
            >
              <span className="photo-col-no">
                {String(index).padStart(3, "0")}
              </span>
              <span className="photo-col-title">
                {roll.title}
                <span className="photo-frames" aria-label={`${roll.frameCount} frames`}>
                  {" "}
                  ×{roll.frameCount}
                </span>
              </span>
              <span className="photo-col-note">{roll.note}</span>
              <span className="photo-col-year">{roll.year ?? ""}</span>
              <span className="photo-row-thumb" aria-hidden="true">
                {roll.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={roll.cover.url} alt="" loading="lazy" decoding="async" />
                ) : null}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
