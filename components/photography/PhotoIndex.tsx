"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { formatRollTime, rollNumber } from "@/lib/photography-format";
import { Abbr } from "./PhotoHeader";

export type PhotoIndexRoll = {
  slug: string;
  title: string;
  photograph: string;
  year: number | null;
  month: number | null;
  cover: { url: string; width: number; height: number } | null;
};

function ratio(cover: PhotoIndexRoll["cover"]) {
  if (!cover || !cover.width || !cover.height) return 3 / 2;
  return cover.width / cover.height;
}

export function PhotoIndex({ rolls }: { rolls: PhotoIndexRoll[] }) {
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
      <div className="photo-index-head" aria-hidden="true">
        <span className="photo-col-no">
          <Abbr short="N." full="No" />
        </span>
        <span className="photo-col-title">
          <Abbr short="R." full="Roll" />
        </span>
        <span className="photo-col-note">
          <Abbr short="P." full="Photograph" />
        </span>
        <span className="photo-col-year">
          <Abbr short="T." full="Time" />
        </span>
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
              <span className="photo-col-no">{rollNumber(index)}</span>
              <span className="photo-col-title">{roll.title}</span>
              <span className="photo-col-note">{roll.photograph}</span>
              <span className="photo-col-year">{formatRollTime(roll)}</span>
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
