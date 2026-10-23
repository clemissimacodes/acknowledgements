"use client";

import { useEffect, useState } from "react";
import styles from "./SecretsReveal.module.css";

const VIDEO_ID = "hB7CDrVnNCs";

// A plain film-leader countdown, 3 2 1, then the video takes the screen.
export function SecretsReveal() {
  const [count, setCount] = useState(3);

  useEffect(() => {
    if (count <= 0) return;
    const timer = window.setTimeout(() => setCount((n) => n - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [count]);

  if (count > 0) {
    return (
      <div className={`secrets-reveal ${styles.leader}`} aria-live="polite">
        <div className={styles.dial} key={count}>
          <span className={styles.sweep} aria-hidden="true" />
          <span className={styles.number}>{count}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`secrets-reveal ${styles.screen}`}>
      <iframe
        src={`https://www.youtube.com/embed/${VIDEO_ID}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
        title="my secret"
        allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}
