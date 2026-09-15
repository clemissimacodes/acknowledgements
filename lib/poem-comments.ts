import { randomUUID } from "crypto";
import { neon } from "@neondatabase/serverless";

export type PoemNoteKind = "note" | "question";

export type PoemNote = {
  id: string;
  poem: string;
  line: number;
  kind: PoemNoteKind;
  name: string | null;
  body: string;
  createdAt: string;
  updatedAt: string;
};

function db() {
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? "";
  if (!url) throw new Error("Database is not configured.");
  return neon(url);
}

function iso(value: string | Date) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

async function ensureTable() {
  const sql = db();
  await sql`
    CREATE TABLE IF NOT EXISTS poem_notes (
      id TEXT PRIMARY KEY,
      poem_slug TEXT NOT NULL,
      line_index INTEGER NOT NULL
        CONSTRAINT poem_notes_anchor_check CHECK (line_index >= -2),
      kind TEXT NOT NULL CHECK (kind IN ('note', 'question')),
      author_name TEXT,
      body TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    ALTER TABLE poem_notes
    DROP CONSTRAINT IF EXISTS poem_notes_line_index_check
  `;
  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'poem_notes_anchor_check'
      ) THEN
        ALTER TABLE poem_notes
        ADD CONSTRAINT poem_notes_anchor_check CHECK (line_index >= -2);
      END IF;
    END
    $$
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS poem_notes_poem_line_idx
    ON poem_notes (poem_slug, line_index, created_at)
  `;
}

function mapNote(row: Record<string, unknown>): PoemNote {
  return {
    id: String(row.id),
    poem: String(row.poem_slug),
    line: Number(row.line_index),
    kind: row.kind === "question" ? "question" : "note",
    name: row.author_name ? String(row.author_name) : null,
    body: String(row.body),
    createdAt: iso(row.created_at as string | Date),
    updatedAt: iso(row.updated_at as string | Date),
  };
}

export async function notesForPoem(poem: string) {
  await ensureTable();
  const rows = await db()`
    SELECT id, poem_slug, line_index, kind, author_name, body, created_at, updated_at
    FROM poem_notes
    WHERE poem_slug = ${poem}
    ORDER BY line_index ASC, created_at ASC
  `;
  return rows.map((row) => mapNote(row as Record<string, unknown>));
}

export async function addPoemNote(input: {
  poem: string;
  line: number;
  kind: PoemNoteKind;
  name: string | null;
  body: string;
}) {
  await ensureTable();
  const rows = await db()`
    INSERT INTO poem_notes (id, poem_slug, line_index, kind, author_name, body)
    VALUES (
      ${randomUUID()},
      ${input.poem},
      ${input.line},
      ${input.kind},
      ${input.name},
      ${input.body}
    )
    RETURNING id, poem_slug, line_index, kind, author_name, body, created_at, updated_at
  `;
  const row = rows[0];
  if (!row) throw new Error("The note could not be saved.");
  return mapNote(row as Record<string, unknown>);
}

export async function updatePoemNote(input: {
  id: string;
  kind: PoemNoteKind;
  name: string | null;
  body: string;
}) {
  await ensureTable();
  const rows = await db()`
    UPDATE poem_notes
    SET
      kind = ${input.kind},
      author_name = ${input.name},
      body = ${input.body},
      updated_at = NOW()
    WHERE id = ${input.id}
    RETURNING id, poem_slug, line_index, kind, author_name, body, created_at, updated_at
  `;
  const row = rows[0];
  return row ? mapNote(row as Record<string, unknown>) : null;
}

export async function deletePoemNote(id: string) {
  await ensureTable();
  const rows = await db()`
    DELETE FROM poem_notes
    WHERE id = ${id}
    RETURNING id
  `;
  return rows.length > 0;
}
