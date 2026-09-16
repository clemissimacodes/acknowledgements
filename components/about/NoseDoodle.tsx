"use client";

import { Draw, type DrawHandle, type Stroke } from "drawesome";
import "drawesome/styles.css";
import { useRef, useState } from "react";
import styles from "./NoseDoodle.module.css";

export function NoseDoodle({
  onChange,
}: {
  onChange: (image: string) => void;
}) {
  const drawingRef = useRef<DrawHandle>(null);
  const [hasInk, setHasInk] = useState(false);
  const [saved, setSaved] = useState(false);

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
      <div className={styles.paper}>
        <Draw
          ref={drawingRef}
          background="#faf5ec"
          tools={["pencil", "marker"]}
          controls={{
            opacity: false,
            custom: false,
            minimize: false,
          }}
          swatches={["#302d29", "#a65b45", "#7f9ead", "#e5aa8f"]}
          look="studio"
          depth="soft"
          motion="none"
          inset={6}
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
