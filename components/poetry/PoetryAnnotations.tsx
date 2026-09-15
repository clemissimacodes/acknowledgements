"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PoemNote, PoemNoteKind } from "@/lib/poem-comments";

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
  return note.name || "Anonymous";
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
  const [kind, setKind] = useState<PoemNoteKind>("note");
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editKind, setEditKind] = useState<PoemNoteKind>("note");
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
          kind,
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
    setEditKind(note.kind);
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
          kind: editKind,
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

  const activeNotes = active === null ? [] : byLine.get(active) ?? [];

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
          <div>
            <h1>{title}</h1>
            {dedication ? <p className="poem-for">for {dedication}</p> : null}
          </div>
          <p className="poem-annotation-instruction">Tap a line to write in its margin.</p>
        </div>
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
                {isActive ? (
                  <div className="line-annot" ref={annotationRef}>
                    <p className="margin-line">Line {index + 1}</p>
                    <p className="margin-quote">{line}</p>
                    {activeNotes.length ? (
                      <ol className="line-annot-notes">
                        {activeNotes.map((note) => (
                          <li key={note.id}>
                            <p className="margin-meta">
                              <span>{note.kind}</span>
                              <span>{displayName(note)}</span>
                            </p>
                            <p>{note.body}</p>
                          </li>
                        ))}
                      </ol>
                    ) : null}
                    <form className="note-form" onSubmit={submit}>
                      <div className="kind-row" aria-label="Annotation type">
                        <button
                          type="button"
                          className={kind === "note" ? "is-on" : ""}
                          aria-pressed={kind === "note"}
                          onClick={() => setKind("note")}
                        >
                          Note
                        </button>
                        <button
                          type="button"
                          className={kind === "question" ? "is-on" : ""}
                          aria-pressed={kind === "question"}
                          onClick={() => setKind("question")}
                        >
                          Question
                        </button>
                      </div>
                      <input
                        value={name}
                        maxLength={60}
                        autoComplete="nickname"
                        placeholder="Name (optional)"
                        aria-label="Name, optional"
                        onChange={(event) => setName(event.target.value)}
                      />
                      <textarea
                        required
                        minLength={2}
                        maxLength={600}
                        rows={3}
                        value={body}
                        placeholder={
                          kind === "question"
                            ? "Ask about this line…"
                            : "Leave a note on this line…"
                        }
                        aria-label={kind === "question" ? "Question" : "Note"}
                        onChange={(event) => setBody(event.target.value)}
                      />
                      <input
                        className="poem-note-honeypot"
                        name="website"
                        tabIndex={-1}
                        autoComplete="off"
                        aria-hidden="true"
                      />
                      <button type="submit" disabled={busy}>
                        {busy ? "Leaving…" : "Leave it"}
                      </button>
                      <p className="poem-note-public">Names and notes are public. Leave the name blank to be anonymous.</p>
                    </form>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </article>

      <aside className="margin" aria-label="Public poetry margin">
        <p className="poem-hint">
          Tap any line to leave a note or question. Everything written here is public.
        </p>
        <p className="margin-line">Public margin</p>
        {error ? <p className="margin-error">{error}</p> : null}
        {notes.length === 0 ? (
          <p className="margin-empty">No notes yet.</p>
        ) : (
          <ol className="margin-notes">
            {notes.map((note) => (
              <li
                key={note.id}
                className={note.line === active ? "is-on-line" : ""}
              >
                {editingId === note.id ? (
                  <form className="note-form margin-edit-form" onSubmit={saveEdit}>
                    <div className="kind-row">
                      <button
                        type="button"
                        className={editKind === "note" ? "is-on" : ""}
                        onClick={() => setEditKind("note")}
                      >
                        Note
                      </button>
                      <button
                        type="button"
                        className={editKind === "question" ? "is-on" : ""}
                        onClick={() => setEditKind("question")}
                      >
                        Question
                      </button>
                    </div>
                    <input
                      value={editName}
                      maxLength={60}
                      placeholder="Anonymous"
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
                      <button type="button" onClick={() => setEditingId(null)}>
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <button
                      type="button"
                      className="margin-jump"
                      onClick={() => openLine(note.line)}
                    >
                      <span className="margin-meta">
                        <span>{note.kind}</span>
                        <span>l.{note.line + 1}</span>
                        <span>{displayName(note)}</span>
                      </span>
                      <span className="margin-note-body">{note.body}</span>
                    </button>
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
                  </>
                )}
              </li>
            ))}
          </ol>
        )}
      </aside>
    </div>
  );
}
