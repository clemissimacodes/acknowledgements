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
  const activeNote = open === null ? null : notes[open];

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(null);
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  return (
    <>
      <ol className="about-list">
        {notes.map((note, index) => (
          <li
            key={note.text}
            tabIndex={0}
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
          </li>
        ))}
      </ol>
      {activeNote ? (
        <div
          className={`about-magnified${activeNote.image ? " has-image" : ""}`}
          aria-hidden="true"
        >
          <span>{activeNote.text}</span>
          {activeNote.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={activeNote.image.src} alt="" />
          ) : null}
        </div>
      ) : null}
    </>
  );
}
