import "server-only";

import { randomUUID } from "crypto";
import { del, head } from "@vercel/blob";
import { neon } from "@neondatabase/serverless";

export const VISITOR_MAX_MS = 60_000;
export const MEMO_MAX_MS = 10 * 60_000;
export const VISITOR_MAX_BYTES = 2 * 1024 * 1024;
export const MEMO_MAX_BYTES = 20 * 1024 * 1024;

export const AUDIO_CONTENT_TYPES = [
  "audio/webm",
  "audio/webm;codecs=opus",
  "audio/mp4",
  "audio/mpeg",
  "audio/mp3",
  "audio/ogg",
  "audio/wav",
  "audio/x-wav",
  "audio/x-m4a",
  "audio/aac",
  "audio/m4a",
  "video/webm",
] as const;

export type VoiceMemoKind = "person" | "thought";

export type VoiceMemo = {
  id: string;
  slug: string;
  kind: VoiceMemoKind;
  title: string;
  recordedAt: string;
  durationMs: number;
  blobUrl: string;
  blobPathname: string;
  published: boolean;
  createdAt: string;
  replyCount: number;
};

export type VoiceReply = {
  id: string;
  memoId: string;
  name: string | null;
  durationMs: number;
  blobUrl: string;
  blobPathname: string;
  createdAt: string;
};

export type VoiceMemoWithReplies = VoiceMemo & { replies: VoiceReply[] };

function databaseUrl() {
  return process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? "";
}

function db() {
  const url = databaseUrl();
  if (!url) throw new Error("Database is not configured.");
  return neon(url);
}

function iso(value: string | Date) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function blobConfigured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

async function ensureTables() {
  const sql = db();
  await sql`
    CREATE TABLE IF NOT EXISTS voice_memos (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      kind TEXT NOT NULL CHECK (kind IN ('person', 'thought')),
      title TEXT NOT NULL DEFAULT '',
      recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      duration_ms INTEGER NOT NULL CHECK (duration_ms > 0),
      blob_url TEXT NOT NULL,
      blob_pathname TEXT NOT NULL,
      published BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS voice_replies (
      id TEXT PRIMARY KEY,
      memo_id TEXT NOT NULL REFERENCES voice_memos (id) ON DELETE CASCADE,
      author_name TEXT,
      duration_ms INTEGER NOT NULL CHECK (duration_ms > 0),
      blob_url TEXT NOT NULL,
      blob_pathname TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS voice_memos_kind_recorded_idx
    ON voice_memos (kind, recorded_at DESC)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS voice_replies_memo_created_idx
    ON voice_replies (memo_id, created_at ASC)
  `;
}

function mapMemo(
  row: Record<string, unknown>,
  replyCount = 0,
): VoiceMemo {
  return {
    id: String(row.id),
    slug: String(row.slug),
    kind: row.kind === "person" ? "person" : "thought",
    title: String(row.title ?? ""),
    recordedAt: iso(row.recorded_at as string | Date),
    durationMs: Number(row.duration_ms),
    blobUrl: String(row.blob_url),
    blobPathname: String(row.blob_pathname),
    published: Boolean(row.published),
    createdAt: iso(row.created_at as string | Date),
    replyCount,
  };
}

function mapReply(row: Record<string, unknown>): VoiceReply {
  return {
    id: String(row.id),
    memoId: String(row.memo_id),
    name: row.author_name ? String(row.author_name) : null,
    durationMs: Number(row.duration_ms),
    blobUrl: String(row.blob_url),
    blobPathname: String(row.blob_pathname),
    createdAt: iso(row.created_at as string | Date),
  };
}

export function slugifyTitle(title: string) {
  const base =
    title
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "memo";
  return `${base}-${randomUUID().slice(0, 8)}`;
}

export function isVoiceBlobUrl(value: string) {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return (
      host.endsWith(".blob.vercel-storage.com") ||
      host === "blob.vercel-storage.com"
    );
  } catch {
    return false;
  }
}

export async function assertOwnedBlob(url: string, pathname: string) {
  if (!blobConfigured()) throw new Error("Audio storage is not configured.");
  if (!isVoiceBlobUrl(url)) throw new Error("That recording could not be kept.");
  if (!pathname.startsWith("out-loud/")) {
    throw new Error("That recording could not be kept.");
  }
  try {
    const meta = await head(url);
    if (!meta?.url) throw new Error("missing");
  } catch {
    throw new Error("That recording could not be found.");
  }
}

async function deleteBlobs(urls: string[]) {
  const unique = [...new Set(urls.filter(Boolean))];
  if (!unique.length || !blobConfigured()) return;
  try {
    await del(unique);
  } catch {
    // The database row still goes away; leftover blobs are acceptable.
  }
}

export async function listPublishedMemos(): Promise<VoiceMemo[]> {
  if (!databaseUrl()) return [];
  await ensureTables();
  const rows = await db()`
    SELECT
      m.id,
      m.slug,
      m.kind,
      m.title,
      m.recorded_at,
      m.duration_ms,
      m.blob_url,
      m.blob_pathname,
      m.published,
      m.created_at,
      COUNT(r.id)::int AS reply_count
    FROM voice_memos m
    LEFT JOIN voice_replies r ON r.memo_id = m.id
    WHERE m.published = TRUE
    GROUP BY m.id
    ORDER BY m.recorded_at DESC
  `;
  return rows.map((row) =>
    mapMemo(row as Record<string, unknown>, Number(row.reply_count ?? 0)),
  );
}

export async function getPublishedMemo(slug: string) {
  if (!databaseUrl()) return null;
  await ensureTables();
  const rows = await db()`
    SELECT
      m.id,
      m.slug,
      m.kind,
      m.title,
      m.recorded_at,
      m.duration_ms,
      m.blob_url,
      m.blob_pathname,
      m.published,
      m.created_at,
      COUNT(r.id)::int AS reply_count
    FROM voice_memos m
    LEFT JOIN voice_replies r ON r.memo_id = m.id
    WHERE m.slug = ${slug} AND m.published = TRUE
    GROUP BY m.id
    LIMIT 1
  `;
  const row = rows[0];
  return row
    ? mapMemo(row as Record<string, unknown>, Number(row.reply_count ?? 0))
    : null;
}

export async function getMemoById(id: string) {
  if (!databaseUrl()) return null;
  await ensureTables();
  const rows = await db()`
    SELECT
      id, slug, kind, title, recorded_at, duration_ms,
      blob_url, blob_pathname, published, created_at
    FROM voice_memos
    WHERE id = ${id}
    LIMIT 1
  `;
  const row = rows[0];
  return row ? mapMemo(row as Record<string, unknown>) : null;
}

export async function repliesForMemo(memoId: string) {
  await ensureTables();
  const rows = await db()`
    SELECT id, memo_id, author_name, duration_ms, blob_url, blob_pathname, created_at
    FROM voice_replies
    WHERE memo_id = ${memoId}
    ORDER BY created_at ASC
  `;
  return rows.map((row) => mapReply(row as Record<string, unknown>));
}

export async function listAdminMemos(): Promise<VoiceMemoWithReplies[]> {
  if (!databaseUrl()) return [];
  await ensureTables();
  const [memos, replies] = await Promise.all([
    db()`
      SELECT
        id, slug, kind, title, recorded_at, duration_ms,
        blob_url, blob_pathname, published, created_at
      FROM voice_memos
      ORDER BY recorded_at DESC
    `,
    db()`
      SELECT id, memo_id, author_name, duration_ms, blob_url, blob_pathname, created_at
      FROM voice_replies
      ORDER BY created_at ASC
    `,
  ]);
  const grouped = new Map<string, VoiceReply[]>();
  for (const row of replies) {
    const reply = mapReply(row as Record<string, unknown>);
    const list = grouped.get(reply.memoId) ?? [];
    list.push(reply);
    grouped.set(reply.memoId, list);
  }
  return memos.map((row) => {
    const memo = mapMemo(row as Record<string, unknown>);
    const memoReplies = grouped.get(memo.id) ?? [];
    return {
      ...memo,
      replyCount: memoReplies.length,
      replies: memoReplies,
    };
  });
}

export async function createMemo(input: {
  kind: VoiceMemoKind;
  title: string;
  durationMs: number;
  blobUrl: string;
  blobPathname: string;
  recordedAt?: string | null;
  published?: boolean;
}) {
  await ensureTables();
  await assertOwnedBlob(input.blobUrl, input.blobPathname);
  if (
    !Number.isFinite(input.durationMs) ||
    input.durationMs < 800 ||
    input.durationMs > MEMO_MAX_MS + 2_000
  ) {
    throw new Error("That memo is the wrong length.");
  }
  const id = randomUUID();
  const slug = slugifyTitle(input.title);
  const recordedAt = input.recordedAt || new Date().toISOString();
  const published = input.published !== false;
  const rows = await db()`
    INSERT INTO voice_memos (
      id, slug, kind, title, recorded_at, duration_ms,
      blob_url, blob_pathname, published
    )
    VALUES (
      ${id},
      ${slug},
      ${input.kind},
      ${input.title},
      ${recordedAt},
      ${Math.round(input.durationMs)},
      ${input.blobUrl},
      ${input.blobPathname},
      ${published}
    )
    RETURNING
      id, slug, kind, title, recorded_at, duration_ms,
      blob_url, blob_pathname, published, created_at
  `;
  const row = rows[0];
  if (!row) throw new Error("The memo could not be saved.");
  return mapMemo(row as Record<string, unknown>);
}

export async function createReply(input: {
  memoId: string;
  name: string | null;
  durationMs: number;
  blobUrl: string;
  blobPathname: string;
}) {
  await ensureTables();
  await assertOwnedBlob(input.blobUrl, input.blobPathname);
  if (
    !Number.isFinite(input.durationMs) ||
    input.durationMs < 800 ||
    input.durationMs > VISITOR_MAX_MS + 1_500
  ) {
    throw new Error("That reply is the wrong length.");
  }
  if (!input.blobPathname.startsWith(`out-loud/replies/${input.memoId}/`)) {
    throw new Error("That recording could not be kept.");
  }
  const rows = await db()`
    INSERT INTO voice_replies (
      id, memo_id, author_name, duration_ms, blob_url, blob_pathname
    )
    VALUES (
      ${randomUUID()},
      ${input.memoId},
      ${input.name},
      ${Math.round(input.durationMs)},
      ${input.blobUrl},
      ${input.blobPathname}
    )
    RETURNING id, memo_id, author_name, duration_ms, blob_url, blob_pathname, created_at
  `;
  const row = rows[0];
  if (!row) throw new Error("The reply could not be saved.");
  return mapReply(row as Record<string, unknown>);
}

export async function deleteMemo(id: string) {
  await ensureTables();
  const replies = await db()`
    SELECT blob_url FROM voice_replies WHERE memo_id = ${id}
  `;
  const memos = await db()`
    DELETE FROM voice_memos
    WHERE id = ${id}
    RETURNING blob_url
  `;
  const row = memos[0];
  if (!row) return false;
  await deleteBlobs([
    String(row.blob_url),
    ...replies.map((item) => String(item.blob_url)),
  ]);
  return true;
}

export async function getReplyById(id: string) {
  if (!databaseUrl()) return null;
  await ensureTables();
  const rows = await db()`
    SELECT id, memo_id, author_name, duration_ms, blob_url, blob_pathname, created_at
    FROM voice_replies
    WHERE id = ${id}
    LIMIT 1
  `;
  const row = rows[0];
  return row ? mapReply(row as Record<string, unknown>) : null;
}

export async function deleteReply(id: string) {
  await ensureTables();
  const rows = await db()`
    DELETE FROM voice_replies
    WHERE id = ${id}
    RETURNING blob_url
  `;
  const row = rows[0];
  if (!row) return false;
  await deleteBlobs([String(row.blob_url)]);
  return true;
}

