"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./VoiceMemos.module.css";

/* The window chrome. The traffic lights do what they do on a Mac:
   red closes (back to the contents), yellow minimizes into a dock,
   green toggles full screen. */
export function MacWindow({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const windowRef = useRef<HTMLDivElement>(null);
  const [minimized, setMinimized] = useState(false);
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    const onChange = () => setZoomed(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleZoom = useCallback(() => {
    const element = windowRef.current;
    if (!element) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => setZoomed(false));
      return;
    }
    if (element.requestFullscreen) {
      element.requestFullscreen().catch(() => setZoomed((value) => !value));
    } else {
      setZoomed((value) => !value);
    }
  }, []);

  return (
    <>
      <div
        ref={windowRef}
        className={`${styles.window}${zoomed ? ` ${styles.zoomed}` : ""}${minimized ? ` ${styles.minimized}` : ""}`}
      >
        <div className={styles.titlebar}>
          <span className={styles.lights}>
            <button
              type="button"
              className={styles.close}
              aria-label="Close Voice Memos"
              title="Close"
              onClick={() => router.push("/")}
            />
            <button
              type="button"
              className={styles.minimize}
              aria-label="Minimize"
              title="Minimize"
              onClick={() => setMinimized(true)}
            />
            <button
              type="button"
              className={styles.zoom}
              aria-label={zoomed ? "Exit full screen" : "Full screen"}
              title={zoomed ? "Exit Full Screen" : "Full Screen"}
              onClick={toggleZoom}
            />
          </span>
          <p className={styles.titlebarTitle} aria-hidden="true">
            Voice Memos
          </p>
          <p className={styles.shortcuts}>
            <kbd>space</kbd> play · <kbd>←</kbd><kbd>→</kbd> 15s · <kbd>↑</kbd>
            <kbd>↓</kbd> memos · <kbd>F</kbd> heart · <kbd>L</kbd> loop
          </p>
        </div>
        {children}
      </div>
      {minimized ? (
        <div className={styles.dock}>
          <button
            type="button"
            className={styles.dockIcon}
            aria-label="Restore Voice Memos"
            onClick={() => setMinimized(false)}
          >
            <svg viewBox="0 0 64 64" aria-hidden="true">
              <rect width="64" height="64" rx="14" fill="#1c1c1e" />
              {[14, 20, 26, 32, 38, 44, 50].map((x, index) => (
                <rect
                  key={x}
                  x={x - 1.5}
                  y={32 - [10, 18, 24, 14, 22, 12, 8][index]}
                  width="3"
                  height={[10, 18, 24, 14, 22, 12, 8][index] * 2}
                  rx="1.5"
                  fill="#ff3b30"
                />
              ))}
            </svg>
            <span>Voice Memos</span>
          </button>
        </div>
      ) : null}
    </>
  );
}
