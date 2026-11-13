"use client";

import { useEffect, useState } from "react";

const READ_AFTER_MS = 10_000;

/**
 * Shows how many times the poem has been read, and counts this visit once the
 * reader has reached the last line and stayed at least ten seconds.
 */
export function PoemReads({ slug }: { slug: string }) {
  const [reads, setReads] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/poems/reads?slug=${encodeURIComponent(slug)}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { reads?: number } | null) => {
        if (!cancelled && typeof data?.reads === "number") setReads(data.reads);
      })
      .catch(() => {});

    const key = `poem-read:${slug}`;
    if (sessionStorage.getItem(key)) return () => void (cancelled = true);

    const started = Date.now();
    let reachedEnd = false;
    let timer: number | undefined;
    const count = () => {
      if (cancelled || sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
      fetch("/api/poems/reads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      })
        .then((response) => (response.ok ? response.json() : null))
        .then((data: { reads?: number } | null) => {
          if (!cancelled && typeof data?.reads === "number") setReads(data.reads);
        })
        .catch(() => sessionStorage.removeItem(key));
    };
    const maybeCount = () => {
      if (!reachedEnd) return;
      const wait = READ_AFTER_MS - (Date.now() - started);
      if (wait <= 0) count();
      else timer = window.setTimeout(count, wait);
    };

    const lines = document.querySelectorAll(".poem-lines .poem-line:not(.is-blank)");
    const last = lines[lines.length - 1];
    const observer = last
      ? new IntersectionObserver((entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            reachedEnd = true;
            observer?.disconnect();
            maybeCount();
          }
        })
      : null;
    if (last) observer?.observe(last);

    return () => {
      cancelled = true;
      observer?.disconnect();
      if (timer) window.clearTimeout(timer);
    };
  }, [slug]);

  if (reads === null) return null;
  return <span>{reads === 1 ? "1 read" : `${reads} reads`}</span>;
}
