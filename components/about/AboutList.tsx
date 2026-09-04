"use client";

import { useState } from "react";

export function AboutList({ notes }: { notes: string[] }) {
  const [open, setOpen] = useState<number | null>(null);

  function magnify(node: HTMLLIElement, index: number) {
    node.style.setProperty("--mag", "1");
    const roomX = Math.max(64, window.innerWidth - node.getBoundingClientRect().left - 28);
    const roomY = Math.max(48, window.innerHeight - node.getBoundingClientRect().top - 28);
    const mag = Math.min(roomX / node.offsetWidth, roomY / node.offsetHeight, 16);
    node.style.setProperty("--mag", String(Math.max(1, mag)));
    setOpen(index);
  }

  return (
    <ol className="about-list">
      {notes.map((note, index) => (
        <li
          key={note}
          tabIndex={0}
          className={open === index ? "is-magnified" : undefined}
          onPointerEnter={(event) => magnify(event.currentTarget, index)}
          onPointerLeave={() => setOpen(null)}
          onFocus={(event) => magnify(event.currentTarget, index)}
          onBlur={() => setOpen(null)}
        >
          {note}
        </li>
      ))}
    </ol>
  );
}
