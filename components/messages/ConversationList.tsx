"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Note } from "@/lib/notes";
import { avatarColor, initialsFor, listTime } from "@/lib/format";
import { ChevronRight, Magnifier } from "./Icons";

type ConversationListProps = {
  notes: Note[];
  activeSlug?: string;
};

export function ConversationList({ notes, activeSlug }: ConversationListProps) {
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return notes;
    const matches = notes.filter((note) => note.name.toLowerCase().includes(needle));
    return matches.length > 0 ? matches : notes;
  }, [notes, query]);

  return (
    <>
      <div className="search-wrap">
        <label className="search">
          <span className="visually-hidden">Search conversations by name</span>
          <Magnifier />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search"
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="search"
          />
        </label>
      </div>
      <nav className="list" aria-label="Conversations">
        {visible.map((note) => {
          const active = note.slug === activeSlug;
          return (
            <Link
              key={note.slug}
              href={`/acknowledgements/${note.slug}`}
              className={active ? "row is-active" : "row"}
              aria-current={active ? "page" : undefined}
            >
              <span
                className="avatar"
                style={{ background: avatarColor(note.slug) }}
                aria-hidden="true"
              >
                {initialsFor(note.name)}
              </span>
              <span className="row-body">
                <span className="row-top">
                  <span className="name">{note.name}</span>
                  <span className="meta">
                    {note.example ? <span className="sample-mark">Sample</span> : null}
                    {note.example && note.date ? <span aria-hidden="true">·</span> : null}
                    <time dateTime={note.date}>{listTime(note.date)}</time>
                    <ChevronRight />
                  </span>
                </span>
                <p className="preview">{note.hook}</p>
              </span>
              <span className="row-rule" aria-hidden="true" />
            </Link>
          );
        })}
      </nav>
    </>
  );
}
