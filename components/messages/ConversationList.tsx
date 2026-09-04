"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  RELATIONSHIP_LABELS,
  RELATIONSHIPS,
  type Note,
  type Relationship,
} from "@/lib/types";
import { initialsFor, listTime } from "@/lib/format";
import {
  CheckGlyph,
  ChevronRight,
  DoubleBubble,
  FilterLines,
  HeartPersonGlyph,
  Magnifier,
  PersonGlyph,
  SpamGlyph,
  TrashGlyph,
  TwoPeopleGlyph,
} from "./Icons";

type Folder = "messages" | "spam" | "deleted";

type ConversationListProps = {
  notes: Note[];
  activeSlug?: string;
};

const RELATIONSHIP_ICONS: Record<Relationship, typeof TwoPeopleGlyph> = {
  friends: TwoPeopleGlyph,
  "more-than-friends": HeartPersonGlyph,
  acquaintances: PersonGlyph,
};

export function ConversationList({ notes, activeSlug }: ConversationListProps) {
  const [query, setQuery] = useState("");
  const [folder, setFolder] = useState<Folder>("messages");
  const [relationship, setRelationship] = useState<Relationship | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;

    function onPointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const visible = useMemo(() => {
    const byFolder =
      folder === "messages"
        ? relationship
          ? notes.filter((note) => note.relationship === relationship)
          : notes
        : [];

    const needle = query.trim().toLowerCase();
    if (!needle) return byFolder;
    const matches = byFolder.filter((note) => note.name.toLowerCase().includes(needle));
    return matches.length > 0 ? matches : byFolder;
  }, [folder, notes, query, relationship]);

  function selectFolder(next: Folder) {
    setFolder(next);
    if (next !== "messages") setRelationship(null);
    setMenuOpen(false);
  }

  function selectRelationship(next: Relationship) {
    setFolder("messages");
    setRelationship((current) => (current === next ? null : next));
    setMenuOpen(false);
  }

  return (
    <>
      <div className="search-wrap" ref={menuRef}>
        <div className="search-row">
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
          <button
            type="button"
            className={menuOpen ? "filter-btn is-open" : "filter-btn"}
            aria-label="Filter conversations"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <FilterLines />
          </button>
        </div>
        {menuOpen ? (
          <div className="filter-menu" role="menu" aria-label="Filter conversations">
            <button
              type="button"
              role="menuitemradio"
              aria-checked={folder === "messages"}
              className="filter-item"
              onClick={() => selectFolder("messages")}
            >
              <span className="filter-check">{folder === "messages" ? <CheckGlyph /> : null}</span>
              <span className="filter-icon">
                <DoubleBubble />
              </span>
              Messages
            </button>
            <button
              type="button"
              role="menuitemradio"
              aria-checked={folder === "spam"}
              className="filter-item"
              onClick={() => selectFolder("spam")}
            >
              <span className="filter-check">{folder === "spam" ? <CheckGlyph /> : null}</span>
              <span className="filter-icon">
                <SpamGlyph />
              </span>
              Spam
            </button>
            <button
              type="button"
              role="menuitemradio"
              aria-checked={folder === "deleted"}
              className="filter-item"
              onClick={() => selectFolder("deleted")}
            >
              <span className="filter-check">{folder === "deleted" ? <CheckGlyph /> : null}</span>
              <span className="filter-icon">
                <TrashGlyph />
              </span>
              Recently Deleted
            </button>
            <div className="filter-rule" role="separator" />
            <p className="filter-heading">Filter By</p>
            {RELATIONSHIPS.map((value) => {
              const Icon = RELATIONSHIP_ICONS[value];
              const active = relationship === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={active}
                  className={active ? "filter-item is-active" : "filter-item"}
                  onClick={() => selectRelationship(value)}
                >
                  <span className="filter-check" />
                  <span className="filter-icon">
                    <Icon />
                  </span>
                  {RELATIONSHIP_LABELS[value]}
                </button>
              );
            })}
            <div className="filter-rule" role="separator" />
            <button
              type="button"
              role="menuitem"
              className="filter-item filter-item-plain"
              onClick={() => setMenuOpen(false)}
            >
              Manage Filtering
            </button>
          </div>
        ) : null}
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
              <span className="avatar" aria-hidden="true">
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
