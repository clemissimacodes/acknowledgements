import "server-only";

import { createHmac, randomUUID } from "crypto";
import { del, head } from "@vercel/blob";
import { neon } from "@neondatabase/serverless";
import {
  NOTE_MAX_LENGTH,
  PEAK_COUNT,
  RECORDING_MAX_MS,
  REPLY_MAX_MS,
  isRecordingFolder,
  isResponseKind,
  type Recording,
  type RecordingFolder,
  type RecordingNote,
  type RecordingReply,
  type ResponseKind,
} from "@/lib/recording-types";

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

export const RECORDING_BLOB_PREFIX = "voice-memos/recordings/";
export const REPLY_BLOB_PREFIX = "voice-memos/replies/";
const TRASH_DAYS = 30;

function databaseUrl() {
  return process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? "";
}

function db() {
  const url = databaseUrl();
  if (!url) throw new Error("Database is not configured.");
  return neon(url);
}

function blobConfigured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

function iso(value: unknown) {
  return value instanceof Date
    ? value.toISOString()
    : new Date(String(value)).toISOString();
}

/* The control room's datetime-local field sends Los Angeles wall time with no
   zone; the server runs in UTC, so read zone-less values as LA time. */
function parseRecordedAt(value: unknown) {
  const raw = String(value ?? "").trim();
  const wall = raw.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!wall) return raw && !Number.isNaN(Date.parse(raw)) ? new Date(raw).toISOString() : null;
  const [, y, mo, d, h, mi, s] = wall.map(Number);
  const asUtc = Date.UTC(y, mo - 1, d, h, mi, s || 0);
  const offset = (at: number) => {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Los_Angeles",
        hourCycle: "h23",
        year: "numeric",
        month: "numeric",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
        second: "numeric",
      })
        .formatToParts(new Date(at))
        .map((part) => [part.type, Number(part.value)]),
    );
    return (
      Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - at
    );
  };
  const first = asUtc - offset(asUtc);
  return new Date(asUtc - offset(first)).toISOString();
}

function cleanText(value: unknown, maximum: number) {
  return String(value ?? "")
    .replace(/\0/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maximum);
}

function cleanId(value: unknown) {
  const id = String(value ?? "").trim();
  if (!/^[A-Za-z0-9-]{8,80}$/.test(id)) throw new Error("Unknown recording.");
  return id;
}

export function cleanName(value: unknown) {
  const name = cleanText(value, 60).replace(/\n/g, " ");
  if (!name) return null;
  if (name.length < 2 || /https?:\/\/|www\./i.test(name)) {
    throw new Error("That name will not do.");
  }
  return name;
}

export function hashVisitor(token: string) {
  const secret =
    process.env.VISITOR_HASH_SECRET ??
    process.env.CLERK_SECRET_KEY ??
    process.env.ADMIN_EMAIL;
  if (!token || !secret) return null;
  return createHmac("sha256", secret).update(token).digest("hex");
}

let ready: Promise<void> | null = null;

function ensureTables() {
  if (!ready) {
    ready = (async () => {
      const sql = db();
      await sql`
        CREATE TABLE IF NOT EXISTS recordings (
          id TEXT PRIMARY KEY,
          slug TEXT NOT NULL UNIQUE,
          title TEXT NOT NULL DEFAULT '',
          folder TEXT NOT NULL,
          recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          duration_ms INTEGER NOT NULL CHECK (duration_ms > 0),
          blob_url TEXT NOT NULL,
          blob_pathname TEXT NOT NULL,
          peaks JSONB,
          favorite BOOLEAN NOT NULL DEFAULT FALSE,
          deleted_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`ALTER TABLE recordings DROP CONSTRAINT IF EXISTS recordings_folder_check`;
      await sql`
        CREATE TABLE IF NOT EXISTS recording_hearts (
          recording_id TEXT NOT NULL REFERENCES recordings (id) ON DELETE CASCADE,
          visitor_hash TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (recording_id, visitor_hash)
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS recording_notes (
          id TEXT PRIMARY KEY,
          recording_id TEXT NOT NULL REFERENCES recordings (id) ON DELETE CASCADE,
          author_name TEXT,
          body TEXT NOT NULL,
          visitor_hash TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS recording_replies (
          id TEXT PRIMARY KEY,
          recording_id TEXT NOT NULL REFERENCES recordings (id) ON DELETE CASCADE,
          author_name TEXT,
          duration_ms INTEGER NOT NULL CHECK (duration_ms > 0),
          blob_url TEXT NOT NULL,
          blob_pathname TEXT NOT NULL,
          visitor_hash TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      for (const table of ["recording_notes", "recording_replies"]) {
        await sql.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS parent_kind TEXT`);
        await sql.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS parent_id TEXT`);
        await sql.query(
          `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS by_owner BOOLEAN NOT NULL DEFAULT FALSE`,
        );
      }
      // The owner's heart is stored under OWNER_HEART so it can be told apart.
      await sql`
        CREATE TABLE IF NOT EXISTS response_hearts (
          kind TEXT NOT NULL,
          response_id TEXT NOT NULL,
          visitor_hash TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (kind, response_id, visitor_hash)
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS recordings_recorded_idx
        ON recordings (deleted_at, recorded_at DESC)
      `;
    })().catch((error) => {
      ready = null;
      throw error;
    });
  }
  return ready;
}

function parsePeaks(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null;
  const peaks = value.map((item) => Number(item)).filter(Number.isFinite);
  return peaks.length ? peaks : null;
}

function mapRecording(row: Record<string, unknown>): Recording {
  return {
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title ?? ""),
    folder: isRecordingFolder(row.folder) ? row.folder : "notes",
    recordedAt: iso(row.recorded_at),
    durationMs: Number(row.duration_ms),
    url: String(row.blob_url),
    peaks: parsePeaks(row.peaks),
    favorite: Boolean(row.favorite),
    hearts: Number(row.hearts ?? 0),
    noteCount: Number(row.note_count ?? 0),
    replyCount: Number(row.reply_count ?? 0),
    deletedAt: row.deleted_at ? iso(row.deleted_at) : null,
  };
}

function mapNote(row: Record<string, unknown>): RecordingNote {
  return {
    id: String(row.id),
    recordingId: String(row.recording_id),
    name: row.author_name ? String(row.author_name) : null,
    body: String(row.body),
    createdAt: iso(row.created_at),
    ...responseFields(row),
  };
}

function mapReply(row: Record<string, unknown>): RecordingReply {
  return {
    id: String(row.id),
    recordingId: String(row.recording_id),
    name: row.author_name ? String(row.author_name) : null,
    durationMs: Number(row.duration_ms),
    url: String(row.blob_url),
    createdAt: iso(row.created_at),
    ...responseFields(row),
  };
}

function responseFields(row: Record<string, unknown>) {
  return {
    parentKind: isResponseKind(row.parent_kind) ? row.parent_kind : null,
    parentId: row.parent_id ? String(row.parent_id) : null,
    byOwner: Boolean(row.by_owner),
    hearts: Number(row.hearts ?? 0),
    ownerHearted: Boolean(row.owner_hearted),
  };
}

const OWNER_HEART = "owner";
const OWNER_NAME = "clem";

function responseColumns(kind: ResponseKind, alias: string) {
  return `
    ${alias}.parent_kind, ${alias}.parent_id, ${alias}.by_owner,
    (SELECT COUNT(*)::int FROM response_hearts rh
      WHERE rh.kind = '${kind}' AND rh.response_id = ${alias}.id) AS hearts,
    EXISTS (SELECT 1 FROM response_hearts rh
      WHERE rh.kind = '${kind}' AND rh.response_id = ${alias}.id
        AND rh.visitor_hash = '${OWNER_HEART}') AS owner_hearted
  `;
}

const NOTE_COLUMNS = `n.id, n.recording_id, n.author_name, n.body, n.created_at, ${responseColumns("note", "n")}`;
const REPLY_COLUMNS = `p.id, p.recording_id, p.author_name, p.duration_ms, p.blob_url, p.created_at, ${responseColumns("reply", "p")}`;

const RECORDING_COLUMNS = `
  r.id, r.slug, r.title, r.folder, r.recorded_at, r.duration_ms,
  r.blob_url, r.blob_pathname, r.peaks, r.favorite, r.deleted_at,
  (SELECT COUNT(*)::int FROM recording_hearts h WHERE h.recording_id = r.id) AS hearts,
  (SELECT COUNT(*)::int FROM recording_notes n WHERE n.recording_id = r.id) AS note_count,
  (SELECT COUNT(*)::int FROM recording_replies p WHERE p.recording_id = r.id) AS reply_count
`;

async function purgeOldTrash() {
  const rows = await db()`
    DELETE FROM recordings
    WHERE deleted_at IS NOT NULL
      AND deleted_at < NOW() - make_interval(days => ${TRASH_DAYS})
    RETURNING blob_url
  `;
  await deleteBlobs(rows.map((row) => String(row.blob_url)));
}

export async function listRecordings(options: { trash?: boolean } = {}) {
  if (!databaseUrl()) return [] as Recording[];
  await ensureTables();
  if (options.trash) await purgeOldTrash().catch(() => undefined);
  const rows = options.trash
    ? await db().query(
        `SELECT ${RECORDING_COLUMNS} FROM recordings r
         WHERE r.deleted_at IS NOT NULL ORDER BY r.deleted_at DESC`,
      )
    : await db().query(
        `SELECT ${RECORDING_COLUMNS} FROM recordings r
         WHERE r.deleted_at IS NULL ORDER BY r.recorded_at DESC`,
      );
  return (rows as Record<string, unknown>[]).map(mapRecording);
}

export async function getRecordingBySlug(slug: string) {
  if (!databaseUrl()) return null;
  await ensureTables();
  const rows = (await db().query(
    `SELECT ${RECORDING_COLUMNS} FROM recordings r
     WHERE r.slug = $1 AND r.deleted_at IS NULL LIMIT 1`,
    [slug],
  )) as Record<string, unknown>[];
  return rows[0] ? mapRecording(rows[0]) : null;
}

export async function getRecordingById(idValue: unknown) {
  if (!databaseUrl()) return null;
  await ensureTables();
  const id = cleanId(idValue);
  const rows = (await db().query(
    `SELECT ${RECORDING_COLUMNS} FROM recordings r WHERE r.id = $1 LIMIT 1`,
    [id],
  )) as Record<string, unknown>[];
  return rows[0] ? mapRecording(rows[0]) : null;
}

export async function listNotes(recordingId: string) {
  await ensureTables();
  const rows = (await db().query(
    `SELECT ${NOTE_COLUMNS} FROM recording_notes n WHERE n.recording_id = $1 ORDER BY n.created_at ASC`,
    [recordingId],
  )) as Record<string, unknown>[];
  return rows.map((row) => mapNote(row as Record<string, unknown>));
}

export async function listReplies(recordingId: string) {
  await ensureTables();
  const rows = (await db().query(
    `SELECT ${REPLY_COLUMNS} FROM recording_replies p WHERE p.recording_id = $1 ORDER BY p.created_at ASC`,
    [recordingId],
  )) as Record<string, unknown>[];
  return rows.map((row) => mapReply(row as Record<string, unknown>));
}

export async function listAllNotes() {
  if (!databaseUrl()) return [] as RecordingNote[];
  await ensureTables();
  const rows = (await db().query(
    `SELECT ${NOTE_COLUMNS} FROM recording_notes n ORDER BY n.created_at DESC LIMIT 1000`,
  )) as Record<string, unknown>[];
  return rows.map((row) => mapNote(row as Record<string, unknown>));
}

export async function listAllReplies() {
  if (!databaseUrl()) return [] as RecordingReply[];
  await ensureTables();
  const rows = (await db().query(
    `SELECT ${REPLY_COLUMNS} FROM recording_replies p ORDER BY p.created_at DESC LIMIT 1000`,
  )) as Record<string, unknown>[];
  return rows.map((row) => mapReply(row as Record<string, unknown>));
}

export async function heartedByVisitor(visitorHash: string | null) {
  if (!visitorHash || !databaseUrl()) return [] as string[];
  await ensureTables();
  const rows = await db()`
    SELECT recording_id FROM recording_hearts WHERE visitor_hash = ${visitorHash}
  `;
  return rows.map((row) => String(row.recording_id));
}

export async function heartedResponsesByVisitor(visitorHash: string | null) {
  if (!visitorHash || !databaseUrl()) return [] as string[];
  await ensureTables();
  const rows = await db()`
    SELECT kind, response_id FROM response_hearts WHERE visitor_hash = ${visitorHash}
  `;
  return rows.map((row) => `${row.kind}:${row.response_id}`);
}

function slugify(title: string) {
  const base =
    title
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 56) || "recording";
  return `${base}-${randomUUID().slice(0, 6)}`;
}

function isBlobUrl(value: string) {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host.endsWith(".blob.vercel-storage.com");
  } catch {
    return false;
  }
}

async function assertBlob(url: string, pathname: string, prefix: string) {
  if (!blobConfigured()) throw new Error("Audio storage is not configured.");
  if (!isBlobUrl(url) || !pathname.startsWith(prefix)) {
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
    // Row is gone; an orphaned blob is tolerable.
  }
}

function cleanPeaks(value: unknown) {
  if (!Array.isArray(value)) return null;
  const peaks = value
    .slice(0, PEAK_COUNT)
    .map((item) => Math.min(100, Math.max(0, Math.round(Number(item) || 0))));
  return peaks.length >= 16 ? peaks : null;
}

export async function createRecording(input: {
  title: unknown;
  folder: unknown;
  durationMs: unknown;
  url: unknown;
  pathname: unknown;
  peaks: unknown;
  recordedAt?: unknown;
}) {
  await ensureTables();
  const url = String(input.url ?? "");
  const pathname = String(input.pathname ?? "");
  await assertBlob(url, pathname, RECORDING_BLOB_PREFIX);
  const durationMs = Math.round(Number(input.durationMs));
  if (
    !Number.isFinite(durationMs) ||
    durationMs < 500 ||
    durationMs > RECORDING_MAX_MS
  ) {
    throw new Error("That recording is the wrong length.");
  }
  const folder: RecordingFolder = isRecordingFolder(input.folder)
    ? input.folder
    : "notes";
  const title = cleanText(input.title, 120).replace(/\n/g, " ") || "New Recording";
  const recordedAt = parseRecordedAt(input.recordedAt) ?? new Date().toISOString();
  const id = randomUUID();
  const peaks = cleanPeaks(input.peaks);
  await db()`
    INSERT INTO recordings (
      id, slug, title, folder, recorded_at, duration_ms,
      blob_url, blob_pathname, peaks
    ) VALUES (
      ${id}, ${slugify(title)}, ${title}, ${folder}, ${recordedAt},
      ${durationMs}, ${url}, ${pathname}, ${peaks ? JSON.stringify(peaks) : null}
    )
  `;
  return getRecordingById(id);
}

export async function updateRecording(
  idValue: unknown,
  patch: {
    title?: unknown;
    folder?: unknown;
    favorite?: unknown;
    recordedAt?: unknown;
    peaks?: unknown;
  },
) {
  await ensureTables();
  const id = cleanId(idValue);
  if (patch.title !== undefined) {
    const title = cleanText(patch.title, 120).replace(/\n/g, " ");
    if (title) await db()`UPDATE recordings SET title = ${title} WHERE id = ${id}`;
  }
  if (patch.folder !== undefined && isRecordingFolder(patch.folder)) {
    await db()`UPDATE recordings SET folder = ${patch.folder} WHERE id = ${id}`;
  }
  if (patch.favorite !== undefined) {
    const favorite = patch.favorite === true || patch.favorite === "true";
    await db()`UPDATE recordings SET favorite = ${favorite} WHERE id = ${id}`;
  }
  if (patch.recordedAt !== undefined) {
    const recordedAt = parseRecordedAt(patch.recordedAt);
    if (recordedAt) {
      await db()`
        UPDATE recordings SET recorded_at = ${recordedAt} WHERE id = ${id}
      `;
    }
  }
  if (patch.peaks !== undefined) {
    const peaks = cleanPeaks(patch.peaks);
    if (peaks) {
      await db()`
        UPDATE recordings SET peaks = ${JSON.stringify(peaks)} WHERE id = ${id}
      `;
    }
  }
  return getRecordingById(id);
}

export async function toggleFavorite(idValue: unknown) {
  await ensureTables();
  const id = cleanId(idValue);
  const rows = await db()`
    UPDATE recordings SET favorite = NOT favorite WHERE id = ${id}
    RETURNING favorite
  `;
  return Boolean(rows[0]?.favorite);
}

export async function trashRecording(idValue: unknown) {
  await ensureTables();
  const id = cleanId(idValue);
  await db()`
    UPDATE recordings SET deleted_at = NOW() WHERE id = ${id} AND deleted_at IS NULL
  `;
}

export async function restoreRecording(idValue: unknown) {
  await ensureTables();
  const id = cleanId(idValue);
  await db()`UPDATE recordings SET deleted_at = NULL WHERE id = ${id}`;
}

export async function destroyRecording(idValue: unknown) {
  await ensureTables();
  const id = cleanId(idValue);
  const replies = await db()`
    SELECT blob_url FROM recording_replies WHERE recording_id = ${id}
  `;
  const rows = await db()`
    DELETE FROM recordings WHERE id = ${id} RETURNING blob_url
  `;
  if (!rows[0]) return false;
  await deleteBlobs([
    String(rows[0].blob_url),
    ...replies.map((row) => String(row.blob_url)),
  ]);
  return true;
}

export async function toggleHeart(idValue: unknown, visitorHash: string) {
  await ensureTables();
  const id = cleanId(idValue);
  const existing = await db()`
    DELETE FROM recording_hearts
    WHERE recording_id = ${id} AND visitor_hash = ${visitorHash}
    RETURNING recording_id
  `;
  let hearted = false;
  if (!existing.length) {
    const live = await db()`
      SELECT id FROM recordings WHERE id = ${id} AND deleted_at IS NULL
    `;
    if (!live.length) throw new Error("Unknown recording.");
    await db()`
      INSERT INTO recording_hearts (recording_id, visitor_hash)
      VALUES (${id}, ${visitorHash})
      ON CONFLICT DO NOTHING
    `;
    hearted = true;
  }
  const count = await db()`
    SELECT COUNT(*)::int AS count FROM recording_hearts WHERE recording_id = ${id}
  `;
  return { hearted, hearts: Number(count[0]?.count ?? 0) };
}

async function assertNotFlooding(table: "recording_notes" | "recording_replies", visitorHash: string | null, limit: number) {
  if (!visitorHash) return;
  const rows =
    table === "recording_notes"
      ? await db()`
          SELECT COUNT(*)::int AS count FROM recording_notes
          WHERE visitor_hash = ${visitorHash} AND created_at > NOW() - INTERVAL '1 hour'
        `
      : await db()`
          SELECT COUNT(*)::int AS count FROM recording_replies
          WHERE visitor_hash = ${visitorHash} AND created_at > NOW() - INTERVAL '1 hour'
        `;
  if (Number(rows[0]?.count ?? 0) >= limit) {
    throw new Error("That is plenty for one hour. Come back later.");
  }
}

type ResponseAuthor = { visitorHash: string | null; byOwner: boolean };

/** The parent must be a response on the same recording. */
async function cleanParent(recordingId: string, kind: unknown, idValue: unknown) {
  if (kind == null || kind === "" || idValue == null || idValue === "") return null;
  if (!isResponseKind(kind)) throw new Error("Unknown reply.");
  const id = cleanId(idValue);
  const rows =
    kind === "note"
      ? await db()`SELECT id FROM recording_notes WHERE id = ${id} AND recording_id = ${recordingId}`
      : await db()`SELECT id FROM recording_replies WHERE id = ${id} AND recording_id = ${recordingId}`;
  if (!rows.length) throw new Error("That reply is gone.");
  return { kind, id };
}

export async function addNote(input: {
  recordingId: unknown;
  name: unknown;
  body: unknown;
  website: unknown;
  parentKind?: unknown;
  parentId?: unknown;
} & ResponseAuthor) {
  if (cleanText(input.website, 100)) return null;
  await ensureTables();
  const id = cleanId(input.recordingId);
  const body = cleanText(input.body, NOTE_MAX_LENGTH);
  if (body.length < 2) throw new Error("Say a little more.");
  const name = input.byOwner ? OWNER_NAME : cleanName(input.name);
  const live = await db()`
    SELECT id FROM recordings WHERE id = ${id} AND deleted_at IS NULL
  `;
  if (!live.length) throw new Error("Unknown recording.");
  const parent = await cleanParent(id, input.parentKind, input.parentId);
  if (!input.byOwner) await assertNotFlooding("recording_notes", input.visitorHash, 12);
  const noteId = randomUUID();
  await db()`
    INSERT INTO recording_notes (
      id, recording_id, author_name, body, visitor_hash, parent_kind, parent_id, by_owner
    ) VALUES (
      ${noteId}, ${id}, ${name}, ${body}, ${input.visitorHash},
      ${parent?.kind ?? null}, ${parent?.id ?? null}, ${input.byOwner}
    )
  `;
  const rows = (await db().query(
    `SELECT ${NOTE_COLUMNS} FROM recording_notes n WHERE n.id = $1`,
    [noteId],
  )) as Record<string, unknown>[];
  return mapNote(rows[0]);
}

export async function addReply(input: {
  recordingId: unknown;
  name: unknown;
  durationMs: unknown;
  url: unknown;
  pathname: unknown;
  website: unknown;
  parentKind?: unknown;
  parentId?: unknown;
} & ResponseAuthor) {
  if (cleanText(input.website, 100)) return null;
  await ensureTables();
  const id = cleanId(input.recordingId);
  const url = String(input.url ?? "");
  const pathname = String(input.pathname ?? "");
  await assertBlob(url, pathname, `${REPLY_BLOB_PREFIX}${id}/`);
  const durationMs = Math.round(Number(input.durationMs));
  if (
    !Number.isFinite(durationMs) ||
    durationMs < 800 ||
    durationMs > REPLY_MAX_MS + 1_500
  ) {
    throw new Error("That reply is the wrong length.");
  }
  const name = input.byOwner ? OWNER_NAME : cleanName(input.name);
  const live = await db()`
    SELECT id FROM recordings WHERE id = ${id} AND deleted_at IS NULL
  `;
  if (!live.length) throw new Error("Unknown recording.");
  const parent = await cleanParent(id, input.parentKind, input.parentId);
  if (!input.byOwner) await assertNotFlooding("recording_replies", input.visitorHash, 8);
  const replyId = randomUUID();
  await db()`
    INSERT INTO recording_replies (
      id, recording_id, author_name, duration_ms, blob_url, blob_pathname, visitor_hash,
      parent_kind, parent_id, by_owner
    ) VALUES (
      ${replyId}, ${id}, ${name}, ${durationMs}, ${url}, ${pathname}, ${input.visitorHash},
      ${parent?.kind ?? null}, ${parent?.id ?? null}, ${input.byOwner}
    )
  `;
  const rows = (await db().query(
    `SELECT ${REPLY_COLUMNS} FROM recording_replies p WHERE p.id = $1`,
    [replyId],
  )) as Record<string, unknown>[];
  return mapReply(rows[0]);
}

/** Deletes a response together with every reply nested under it. */
async function deleteResponseTree(kind: ResponseKind, id: string) {
  const queue: { kind: ResponseKind; id: string }[] = [{ kind, id }];
  const blobs: string[] = [];
  while (queue.length) {
    const item = queue.shift()!;
    const children = await db()`
      SELECT 'note' AS kind, id FROM recording_notes
        WHERE parent_kind = ${item.kind} AND parent_id = ${item.id}
      UNION ALL
      SELECT 'reply' AS kind, id FROM recording_replies
        WHERE parent_kind = ${item.kind} AND parent_id = ${item.id}
    `;
    for (const child of children) {
      if (isResponseKind(child.kind)) queue.push({ kind: child.kind, id: String(child.id) });
    }
    if (item.kind === "note") {
      await db()`DELETE FROM recording_notes WHERE id = ${item.id}`;
    } else {
      const rows = await db()`
        DELETE FROM recording_replies WHERE id = ${item.id} RETURNING blob_url
      `;
      if (rows[0]) blobs.push(String(rows[0].blob_url));
    }
    await db()`
      DELETE FROM response_hearts WHERE kind = ${item.kind} AND response_id = ${item.id}
    `;
  }
  await deleteBlobs(blobs);
}

export async function deleteNote(idValue: unknown) {
  await ensureTables();
  await deleteResponseTree("note", cleanId(idValue));
}

export async function deleteReply(idValue: unknown) {
  await ensureTables();
  await deleteResponseTree("reply", cleanId(idValue));
}

/** Visitors heart under their own hash; the owner's heart is kept apart so it
    can be shown in orange. */
export async function toggleResponseHeart(
  kindValue: unknown,
  idValue: unknown,
  author: ResponseAuthor,
) {
  await ensureTables();
  if (!isResponseKind(kindValue)) throw new Error("Unknown reply.");
  const kind = kindValue;
  const id = cleanId(idValue);
  const hash = author.byOwner ? OWNER_HEART : author.visitorHash;
  if (!hash) throw new Error("Hearts are unavailable.");
  const exists =
    kind === "note"
      ? await db()`SELECT id FROM recording_notes WHERE id = ${id}`
      : await db()`SELECT id FROM recording_replies WHERE id = ${id}`;
  if (!exists.length) throw new Error("That reply is gone.");
  const removed = await db()`
    DELETE FROM response_hearts
    WHERE kind = ${kind} AND response_id = ${id} AND visitor_hash = ${hash}
    RETURNING response_id
  `;
  if (!removed.length) {
    await db()`
      INSERT INTO response_hearts (kind, response_id, visitor_hash)
      VALUES (${kind}, ${id}, ${hash})
      ON CONFLICT DO NOTHING
    `;
  }
  const counts = await db()`
    SELECT
      COUNT(*)::int AS hearts,
      BOOL_OR(visitor_hash = ${OWNER_HEART}) AS owner_hearted
    FROM response_hearts WHERE kind = ${kind} AND response_id = ${id}
  `;
  return {
    hearted: !removed.length,
    hearts: Number(counts[0]?.hearts ?? 0),
    ownerHearted: Boolean(counts[0]?.owner_hearted),
  };
}
