"use client";

import { Draw, type DrawHandle, type Stroke } from "drawesome";
import "drawesome/styles.css";
import { useEffect, useRef, useState } from "react";
import styles from "./NoseDoodle.module.css";

export function NoseDoodle({
  onChange,
}: {
  onChange: (image: string) => void;
}) {
  const drawingRef = useRef<DrawHandle>(null);
  const [hasInk, setHasInk] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    document.documentElement.classList.add("nose-drawing-active");
    return () => {
      document.documentElement.classList.remove("nose-drawing-active");
    };
  }, []);

  function handleStrokes(strokes: Stroke[]) {
    setHasInk(strokes.some((stroke) => !stroke.erase));
    setSaved(false);
    onChange("");
  }

  async function saveDrawing() {
    if (!hasInk || !drawingRef.current) return;
    const blob = await drawingRef.current.toPng(1);
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result !== "string") return;
      onChange(reader.result);
      setSaved(true);
    });
    reader.readAsDataURL(blob);
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.paper} data-native-drawing>
        <Draw
          ref={drawingRef}
          background="#faf5ec"
          look="studio"
          depth="soft"
          motion="none"
          inset={12}
          onChange={handleStrokes}
        />
      </div>
      <div className={styles.footer}>
        <a href="https://benji.org/drawesome" target="_blank" rel="noreferrer">
          drawing tools by Benji’s Drawesome
        </a>
        <button type="button" disabled={!hasInk} onClick={() => void saveDrawing()}>
          {saved ? "nose drawn ✓" : "use my drawn nose"}
        </button>
      </div>
    </div>
  );
}
