"use client";

import { useEffect, useState } from "react";

/** Long enough to read each phrase: quick for "wobble", slower for walks. */
function readingTime(phrase: string) {
  return 220 + phrase.length * 38;
}

export function RotatingWords({ words }: { words: readonly string[] }) {
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

  return (
    <>
      <span className="visually-hidden">{words.join(", ")}</span>
      <span className="rotating-words" aria-hidden="true">
        {words[index]}
      </span>
    </>
  );
}
