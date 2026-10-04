"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { rollNumber } from "@/lib/photography-format";
import { Abbr } from "./PhotoHeader";

// The reference-style index: four fixed columns, rows resting in grey that
// come up to ink on hover while a large image of the row fades in behind.
// Shared by Photography (rolls) and Art History (pieces).

export type HoverIndexRow = {
  key: string;
  href: string;
  a: string;
  b: string;
  time: string;
  image: { url: string; width: number; height: number } | null;
  // Shown in the centre instead of an image while the row is hovered.
  peekText?: string;
};

export type HoverIndexLabels = {
  a: { short: string; full: string };
  b: { short: string; full: string };
  time: { short: string; full: string };
};

function ratio(image: HoverIndexRow["image"]) {
  if (!image || !image.width || !image.height) return 3 / 2;
  return image.width / image.height;
}

export function HoverIndex({
  rows,
  labels,
}: {
  rows: HoverIndexRow[];
  labels: HoverIndexLabels;
}) {
  const [active, setActive] = useState<number | null>(null);
  const [shown, setShown] = useState<number | null>(null);
  const warmed = useRef(false);

  // Warm the browser cache so the first hover is instant.
  useEffect(() => {
    if (warmed.current) return;
    warmed.current = true;
    const handles = rows
      .map((row) => row.image?.url)
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
  }, [rows]);

  // Keep the last image mounted while fading out so it does not blink.
  useEffect(() => {
    if (active !== null) setShown(active);
  }, [active]);

  const preview = shown !== null ? rows[shown] : null;

  return (
    <div
      className={`photo-index${
        active !== null && (rows[active]?.image || rows[active]?.peekText)
          ? " is-peeking"
          : ""
      }`}
      onMouseLeave={() => setActive(null)}
    >
      {/* Painted first so the rows (positioned, later in tree order) can
          blend against it with mix-blend-mode: difference. */}
      <div
        className={`photo-peek${preview?.image ? "" : " is-text"}`}
        aria-hidden="true"
        style={{ "--peek-ratio": ratio(preview?.image ?? null) } as React.CSSProperties}
      >
        {preview?.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview.image.url} alt="" decoding="async" />
        ) : preview?.peekText ? (
          <p className="photo-peek-text">{preview.peekText}</p>
        ) : null}
      </div>
      <div className="photo-index-head" aria-hidden="true">
        <span className="photo-col-no">
          <Abbr short="N." full="No" />
        </span>
        <span className="photo-col-title">
          <Abbr short={labels.a.short} full={labels.a.full} />
        </span>
        <span className="photo-col-note">
          <Abbr short={labels.b.short} full={labels.b.full} />
        </span>
        <span className="photo-col-year">
          <Abbr short={labels.time.short} full={labels.time.full} />
        </span>
      </div>
      <ol className="photo-index-list">
        {rows.map((row, index) => (
          <li
            key={row.key}
            className={`photo-row${active === index ? " is-active" : ""}`}
          >
            <Link
              href={row.href}
              onMouseEnter={() => setActive(index)}
              onFocus={() => setActive(index)}
              onBlur={() => setActive(null)}
            >
              <span className="photo-col-no">{rollNumber(index)}</span>
              <span className="photo-col-title">{row.a}</span>
              <span className="photo-col-note">{row.b}</span>
              <span className="photo-col-year">{row.time}</span>
              <span className="photo-row-thumb" aria-hidden="true">
                {row.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={row.image.url} alt="" loading="lazy" decoding="async" />
                ) : null}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
