"use client";

import { useEffect, useState } from "react";

/** Long enough to read each phrase: quick for "wobble", slower for walks. */
function readingTime(phrase: string) {
  return 220 + phrase.length * 38;
}

export function RotatingWords({
  words,
  prefix = "",
  suffix = "",
}: {
  words: readonly string[];
  prefix?: string;
  suffix?: string;
}) {
  const [index, setIndex] = useState(0);
  const [still, setStill] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setStill(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (still) return;
    const timer = window.setTimeout(
      () => setIndex((current) => (current + 1) % words.length),
      readingTime(words[index]),
    );
    return () => window.clearTimeout(timer);
  }, [index, still, words]);

  // Every phrase sits in the same grid cell, so the slot is always as tall as
  // the longest one and the text around it never reflows.
  return (
    <>
      <span className="visually-hidden">
        {prefix} {words.join(", ")} {suffix}
      </span>
      <span className="rotating-words" aria-hidden="true">
        {words.map((word, wordIndex) => (
          <span key={word} className={wordIndex === index ? "is-current" : undefined}>
            {prefix} <em>{word}</em> {suffix}
          </span>
        ))}
      </span>
    </>
  );
}
