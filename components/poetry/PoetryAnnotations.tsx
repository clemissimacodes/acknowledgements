"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PoemNote } from "@/lib/poem-comments";

const NAME_KEY = "clemissima-poetry-name";

type PoetryAnnotationsProps = {
  slug: string;
  title: string;
  dedication?: string;
  lines: string[];
  companion?: {
    src: string;
    alt: string;
    credit: string;
    href: string;
  };
};

function ordered(notes: PoemNote[]) {
  return [...notes].sort(
    (a, b) => a.line - b.line || a.createdAt.localeCompare(b.createdAt),
  );
}

function displayName(note: PoemNote) {
  return note.name || "internet human";
}

export function PoetryAnnotations({
  slug,
  title,
  dedication,
  lines,
  companion,
}: PoetryAnnotationsProps) {
  const [notes, setNotes] = useState<PoemNote[]>([]);
  const [admin, setAdmin] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editBody, setEditBody] = useState("");
  const annotationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setName(window.localStorage.getItem(NAME_KEY)?.trim() ?? "");
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch(
          `/api/poetry/comments?poem=${encodeURIComponent(slug)}`,
          { cache: "no-store" },
        );
        const data = (await response.json()) as {
          notes?: PoemNote[];
          admin?: boolean;
          error?: string;
        };
        if (cancelled) return;
        setNotes(ordered(data.notes ?? []));
        setAdmin(Boolean(data.admin));
        if (!response.ok && data.error) setError(data.error);
      } catch {
        if (!cancelled) setError("The margin is unavailable.");
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const byLine = useMemo(() => {
    const grouped = new Map<number, PoemNote[]>();
    for (const note of notes) {
      const current = grouped.get(note.line) ?? [];
      current.push(note);
      grouped.set(note.line, current);
    }
    return grouped;
  }, [notes]);

  function openLine(index: number) {
    setActive(index);
    setError("");
    window.requestAnimationFrame(() => {
      annotationRef.current?.scrollIntoView({
        block: "nearest",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
    });
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (active === null || busy) return;
    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/poetry/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          poem: slug,
          line: active,
          kind: body.trim().endsWith("?") ? "question" : "note",
          name,
          body,
          website: new FormData(event.currentTarget).get("website"),
        }),
      });
      const data = (await response.json()) as {
        note?: PoemNote;
        error?: string;
      };
      const createdNote = data.note;
      if (!response.ok || !createdNote) {
        setError(data.error ?? "The margin did not take it.");
        return;
      }
      if (name.trim()) {
        window.localStorage.setItem(NAME_KEY, name.trim());
      } else {
        window.localStorage.removeItem(NAME_KEY);
      }
      setNotes((current) => ordered([...current, createdNote]));
      setBody("");
    } catch {
      setError("The margin did not take it.");
    } finally {
      setBusy(false);
    }
  }

  function beginEdit(note: PoemNote) {
    setEditingId(note.id);
    setEditName(note.name ?? "");
    setEditBody(note.body);
    setError("");
  }

  async function saveEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingId || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/poetry/comments/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: editBody.trim().endsWith("?") ? "question" : "note",
          name: editName,
          body: editBody,
        }),
      });
      const data = (await response.json()) as {
        note?: PoemNote;
        error?: string;
      };
      const updatedNote = data.note;
      if (!response.ok || !updatedNote) {
        setError(data.error ?? "The note could not be edited.");
        return;
      }
      setNotes((current) =>
        ordered(
          current.map((note) =>
            note.id === updatedNote.id ? updatedNote : note,
          ),
        ),
      );
      setEditingId(null);
    } catch {
      setError("The note could not be edited.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(note: PoemNote) {
    if (!window.confirm(`Delete this ${note.kind}?`)) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/poetry/comments/${note.id}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "The note could not be deleted.");
        return;
      }
      setNotes((current) => current.filter((item) => item.id !== note.id));
      if (editingId === note.id) setEditingId(null);
    } catch {
      setError("The note could not be deleted.");
    } finally {
      setBusy(false);
    }
  }

  function annotationMargin(index: number) {
    const targetNotes = byLine.get(index) ?? [];
    const isActive = active === index;

    return (
      <>
        {targetNotes.length && !isActive ? (
          <aside className="poem-hover-notes" aria-hidden="true">
            {targetNotes.map((note) => (
              <div key={note.id}>
                <p className="margin-meta">
                  <span>{displayName(note)}</span>
                </p>
                <p>{note.body}</p>
              </div>
            ))}
          </aside>
        ) : null}
        {isActive ? (
          <div className="line-annot" ref={annotationRef}>
            <button
              className="line-annot-close"
              type="button"
              aria-label="Close annotation form"
              onClick={() => setActive(null)}
            >
              ×
            </button>
            {targetNotes.length ? (
              <ol className="line-annot-notes">
                {targetNotes.map((note) =>
                  editingId === note.id ? (
                    <li key={note.id}>
                      <form
                        className="note-form margin-edit-form"
                        onSubmit={saveEdit}
                      >
                        <input
                          value={editName}
                          maxLength={60}
                          placeholder="Your name, if you like"
                          aria-label="Author name"
                          onChange={(event) => setEditName(event.target.value)}
                        />
                        <textarea
                          required
                          minLength={2}
                          maxLength={600}
                          rows={4}
                          value={editBody}
                          aria-label="Annotation"
                          onChange={(event) => setEditBody(event.target.value)}
                        />
                        <div className="margin-admin-actions">
                          <button type="submit" disabled={busy}>
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    </li>
                  ) : (
                    <li key={note.id}>
                      <p className="margin-meta">
                        <span>{displayName(note)}</span>
                      </p>
                      <p>{note.body}</p>
                      {admin ? (
                        <div className="margin-admin-actions">
                          <button type="button" onClick={() => beginEdit(note)}>
                            Edit
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void remove(note)}
                          >
                            Delete
                          </button>
                        </div>
                      ) : null}
                    </li>
                  ),
                )}
              </ol>
            ) : null}
            <form className="note-form" onSubmit={submit}>
              <textarea
                required
                minLength={2}
                maxLength={600}
                rows={2}
                value={body}
                placeholder="thought or question"
                aria-label="Thought or question"
                onChange={(event) => setBody(event.target.value)}
              />
              <input
                className="poem-note-honeypot"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
              />
              <div className="poem-note-footer">
                <input
                  value={name}
                  maxLength={60}
                  autoComplete="nickname"
                  placeholder="name, if you like"
                  aria-label="Name, optional"
                  onChange={(event) => setName(event.target.value)}
                />
                <p className="poem-note-public">public · name optional</p>
                <button
                  className="poem-note-send"
                  type="submit"
                  disabled={busy}
                  aria-label="Post thought or question"
                  title="Post"
                >
                  {busy ? (
                    "…"
                  ) : (
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      focusable="false"
                    >
                      <path d="M4.5 10.5 12 3l7.5 7.5M12 3v18" />
                    </svg>
                  )}
                </button>
              </div>
            </form>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <div className="workshop poetry-annotations">
      <article className="poem-sheet">
        {companion ? (
          <figure className="poem-companion">
            <a href={companion.href} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={companion.src} alt={companion.alt} />
            </a>
            <figcaption>{companion.credit}</figcaption>
          </figure>
        ) : null}
        <div className="poem-head">
          <div className="poem-heading-targets">
            <div className="poem-line-block poem-heading-annotation">
              <div
                className={`poem-line-row poem-title-row${
                  active === -2 ? " is-active" : ""
                }`}
              >
                <h1>
                  <button
                    className="poem-heading-button"
                    type="button"
                    aria-expanded={active === -2}
                    onClick={() => openLine(-2)}
                  >
                    {title}
                  </button>
                </h1>
                <span
                  className={
                    (byLine.get(-2)?.length ?? 0)
                      ? "poem-note-count"
                      : "poem-note-plus"
                  }
                  aria-hidden="true"
                >
                  {(byLine.get(-2)?.length ?? 0) || "+"}
                </span>
              </div>
              {annotationMargin(-2)}
            </div>
            {dedication ? (
              <div className="poem-line-block poem-heading-annotation">
                <div
                  className={`poem-line-row poem-dedication-row${
                    active === -1 ? " is-active" : ""
                  }`}
                >
                  <p className="poem-for">
                    <button
                      className="poem-heading-button"
                      type="button"
                      aria-expanded={active === -1}
                      onClick={() => openLine(-1)}
                    >
                      for {dedication}
                    </button>
                  </p>
                  <span
                    className={
                      (byLine.get(-1)?.length ?? 0)
                        ? "poem-note-count"
                        : "poem-note-plus"
                    }
                    aria-hidden="true"
                  >
                    {(byLine.get(-1)?.length ?? 0) || "+"}
                  </span>
                </div>
                {annotationMargin(-1)}
              </div>
            ) : null}
          </div>
          <p className="poem-annotation-instruction">
            The margins are open. Choose any line.
          </p>
        </div>
        {error ? (
          <p className="poem-margin-error" role="status">
            {error}
          </p>
        ) : null}
        <div className="poem-lines">
          {lines.map((line, index) => {
            const lineNotes = byLine.get(index) ?? [];
            const isActive = active === index;
            if (!line.length) {
              return (
                <p className="poem-line is-blank" key={`${index}-blank`}>
                  {"\u00a0"}
                </p>
              );
            }
            return (
              <div className="poem-line-block" key={`${index}-${line}`}>
                <div className="poem-line-row">
                  <button
                    className={`poem-line poem-line-button${isActive ? " is-active" : ""}${
                      lineNotes.length ? " is-marked" : ""
                    }`}
                    type="button"
                    aria-expanded={isActive}
                    onClick={() => openLine(index)}
                  >
                    {line}
                  </button>
                  {lineNotes.length ? (
                    <span
                      className="poem-note-count"
                      aria-label={`${lineNotes.length} ${
                        lineNotes.length === 1 ? "annotation" : "annotations"
                      }`}
                    >
                      {lineNotes.length}
                    </span>
                  ) : (
                    <span className="poem-note-plus" aria-hidden="true">
                      +
                    </span>
                  )}
                </div>
                {annotationMargin(index)}
              </div>
            );
          })}
        </div>
      </article>
    </div>
  );
}
