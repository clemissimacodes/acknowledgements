"use client";

import { useEffect, useState } from "react";

export type AboutNote = {
  text: string;
  href?: string;
  image?: {
    src: string;
    alt: string;
  };
};

export function AboutList({ notes }: { notes: AboutNote[] }) {
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(null);
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  return (
    <ol className="about-list">
      {notes.map((note, index) => (
        <li
          key={note.text}
          tabIndex={0}
          className={[
            open === index ? "is-magnified" : "",
            note.image ? "has-image" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onPointerEnter={(event) => {
            if (event.pointerType === "mouse") setOpen(index);
          }}
          onPointerLeave={(event) => {
            if (event.pointerType === "mouse") setOpen(null);
          }}
          onFocus={() => setOpen(index)}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setOpen(null);
          }}
          onClick={(event) => {
            if ((event.target as HTMLElement).closest("a")) return;
            setOpen(open === index ? null : index);
          }}
        >
          <span className="about-note-copy">
            {note.href ? (
              <a href={note.href} target="_blank" rel="noreferrer">
                {note.text}
              </a>
            ) : (
              note.text
            )}
          </span>
          {note.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className="about-note-image"
              src={note.image.src}
              alt={note.image.alt}
            />
          ) : null}
        </li>
      ))}
    </ol>
  );
}
