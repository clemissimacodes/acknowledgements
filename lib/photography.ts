import "server-only";

import { randomUUID } from "crypto";
import { neon } from "@neondatabase/serverless";
import { del } from "@vercel/blob";

// Photography lives in "rolls": small curated sequences of frames that tell
// one story each — three pictures of a funny moment, thirty of one sunset.

export const ROLL_MAX_FRAMES = 30;
export const FRAME_MAX_BYTES = 25 * 1024 * 1024;
export const FRAME_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type PhotoFrame = {
  id: string;
  rollId: string;
  url: string;
  pathname: string;
  width: number;
  height: number;
  caption: string;
  position: number;
  createdAt: string;
};

export type PhotoRoll = {
  id: string;
  slug: string;
  title: string;
  note: string;
  year: number | null;
  month: number | null;
  published: boolean;
  coverFrameId: string | null;
  cover: PhotoFrame | null;
  frames: PhotoFrame[];
  frameCount: number;
  createdAt: string;
  updatedAt: string;
};

function databaseUrl() {
  return process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? "";
}

function db() {
  const url = databaseUrl();
  if (!url) throw new Error("Database is not configured.");
  return neon(url);
}

function cleanLine(value: unknown, maximum: number) {
  return String(value ?? "")
    .replace(/\0/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
}

function cleanText(value: unknown, maximum: number) {
  return String(value ?? "")
    .replace(/\0/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maximum);
}

function cleanId(value: unknown) {
  const id = String(value ?? "").trim();
  if (!/^[A-Za-z0-9-]{8,80}$/.test(id)) throw new Error("Invalid record.");
  return id;
}

export function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

// Accepts "YYYY-MM" (from <input type="month">) or a bare year.
function cleanWhen(value: unknown): { year: number | null; month: number | null } {
  const text = String(value ?? "").trim();
  if (!text) return { year: null, month: null };
  const match = /^(\d{4})(?:-(\d{1,2}))?$/.exec(text);
  if (!match) throw new Error("Check the date.");
  const year = Number(match[1]);
  const month = match[2] ? Number(match[2]) : null;
  if (year < 1900 || year > 2100) throw new Error("Check the year.");
  if (month !== null && (month < 1 || month > 12)) {
    throw new Error("Check the month.");
  }
  return { year, month };
}

let ready: Promise<void> | null = null;

function ensureTables() {
  if (!ready) {
    ready = (async () => {
      await db()`
        CREATE TABLE IF NOT EXISTS photo_rolls (
          id TEXT PRIMARY KEY,
          slug TEXT NOT NULL UNIQUE,
          title TEXT NOT NULL,
          note TEXT NOT NULL DEFAULT '',
          year INTEGER,
          month INTEGER,
          published BOOLEAN NOT NULL DEFAULT FALSE,
          cover_frame_id TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await db()`
        CREATE TABLE IF NOT EXISTS photo_frames (
          id TEXT PRIMARY KEY,
          roll_id TEXT NOT NULL REFERENCES photo_rolls(id) ON DELETE CASCADE,
          blob_url TEXT NOT NULL,
          blob_pathname TEXT NOT NULL,
          width INTEGER NOT NULL DEFAULT 0,
          height INTEGER NOT NULL DEFAULT 0,
          caption TEXT NOT NULL DEFAULT '',
          position INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await db()`
        ALTER TABLE photo_rolls ADD COLUMN IF NOT EXISTS month INTEGER
      `;
      await db()`
        CREATE INDEX IF NOT EXISTS photo_frames_roll_idx
        ON photo_frames (roll_id, position)
      `;
    })().catch((error) => {
      ready = null;
      throw error;
    });
  }
  return ready;
}

function mapFrame(row: Record<string, unknown>): PhotoFrame {
  return {
    id: String(row.id),
    rollId: String(row.roll_id),
    url: String(row.blob_url),
    pathname: String(row.blob_pathname),
    width: Number(row.width ?? 0),
    height: Number(row.height ?? 0),
    caption: String(row.caption ?? ""),
    position: Number(row.position ?? 0),
    createdAt: new Date(row.created_at as string | Date).toISOString(),
  };
}

function mapRoll(row: Record<string, unknown>, frames: PhotoFrame[]): PhotoRoll {
  const coverFrameId = row.cover_frame_id ? String(row.cover_frame_id) : null;
  const cover =
    frames.find((frame) => frame.id === coverFrameId) ?? frames[0] ?? null;
  return {
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title),
    note: String(row.note ?? ""),
    year: row.year === null || row.year === undefined ? null : Number(row.year),
    month:
      row.month === null || row.month === undefined ? null : Number(row.month),
    published: Boolean(row.published),
    coverFrameId,
    cover,
    frames,
    frameCount: frames.length,
    createdAt: new Date(row.created_at as string | Date).toISOString(),
    updatedAt: new Date(row.updated_at as string | Date).toISOString(),
  };
}

async function framesForRolls(rollIds: string[]) {
  const grouped = new Map<string, PhotoFrame[]>();
  if (!rollIds.length) return grouped;
  const rows = (await db()`
    SELECT id, roll_id, blob_url, blob_pathname, width, height, caption,
           position, created_at
    FROM photo_frames
    WHERE roll_id = ANY(${rollIds})
    ORDER BY position ASC, created_at ASC
  `) as Array<Record<string, unknown>>;
  for (const row of rows) {
    const frame = mapFrame(row);
    const list = grouped.get(frame.rollId) ?? [];
    list.push(frame);
    grouped.set(frame.rollId, list);
  }
  return grouped;
}

async function listRolls(onlyPublished: boolean) {
  if (!databaseUrl()) return [];
  await ensureTables();
  const rows = (onlyPublished
    ? await db()`
        SELECT id, slug, title, note, year, month, published, cover_frame_id,
               created_at, updated_at
        FROM photo_rolls
        WHERE published = TRUE
        ORDER BY year DESC NULLS LAST, month DESC NULLS LAST, created_at DESC
      `
    : await db()`
        SELECT id, slug, title, note, year, month, published, cover_frame_id,
               created_at, updated_at
        FROM photo_rolls
        ORDER BY year DESC NULLS LAST, month DESC NULLS LAST, created_at DESC
      `) as Array<Record<string, unknown>>;
  const frames = await framesForRolls(rows.map((row) => String(row.id)));
  return rows
    .map((row) => mapRoll(row, frames.get(String(row.id)) ?? []))
    .filter((roll) => !onlyPublished || roll.frameCount > 0);
}

export function listPublishedRolls() {
  return listRolls(true);
}

export function listAllRolls() {
  return listRolls(false);
}

export async function getRollBySlug(slugValue: string) {
  const slug = String(slugValue ?? "").trim().toLowerCase();
  if (!/^[a-z0-9_-]{1,80}$/.test(slug) || !databaseUrl()) return null;
  await ensureTables();
  const rows = (await db()`
    SELECT id, slug, title, note, year, month, published, cover_frame_id,
           created_at, updated_at
    FROM photo_rolls
    WHERE slug = ${slug}
    LIMIT 1
  `) as Array<Record<string, unknown>>;
  const row = rows[0];
  if (!row) return null;
  const frames = await framesForRolls([String(row.id)]);
  return mapRoll(row, frames.get(String(row.id)) ?? []);
}

export async function getRollById(idValue: unknown) {
  const id = cleanId(idValue);
  if (!databaseUrl()) return null;
  await ensureTables();
  const rows = (await db()`
    SELECT id, slug, title, note, year, month, published, cover_frame_id,
           created_at, updated_at
    FROM photo_rolls
    WHERE id = ${id}
    LIMIT 1
  `) as Array<Record<string, unknown>>;
  const row = rows[0];
  if (!row) return null;
  const frames = await framesForRolls([id]);
  return mapRoll(row, frames.get(id) ?? []);
}

async function uniqueSlug(base: string, exceptId?: string) {
  const root = base || "roll";
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = attempt ? `${root}-${attempt + 1}` : root;
    const rows = (await db()`
      SELECT id FROM photo_rolls WHERE slug = ${candidate} LIMIT 1
    `) as Array<{ id: string }>;
    if (!rows[0] || rows[0].id === exceptId) return candidate;
  }
  return `${root}-${randomUUID().slice(0, 6)}`;
}

export async function createRoll(input: {
  title: unknown;
  note: unknown;
  when: unknown;
}) {
  const title = cleanLine(input.title, 120);
  if (title.length < 1) throw new Error("Give the roll a title.");
  const note = cleanText(input.note, 2000);
  const now = new Date();
  const when = cleanWhen(input.when);
  const year = when.year ?? now.getFullYear();
  const month = when.year ? when.month : now.getMonth() + 1;
  await ensureTables();
  const id = randomUUID();
  const slug = await uniqueSlug(slugify(title));
  await db()`
    INSERT INTO photo_rolls (id, slug, title, note, year, month)
    VALUES (${id}, ${slug}, ${title}, ${note}, ${year}, ${month})
  `;
  return { id, slug };
}

export async function updateRoll(input: {
  id: unknown;
  title: unknown;
  note: unknown;
  when: unknown;
  slug: unknown;
}) {
  const id = cleanId(input.id);
  const title = cleanLine(input.title, 120);
  if (title.length < 1) throw new Error("Give the roll a title.");
  const note = cleanText(input.note, 2000);
  const { year, month } = cleanWhen(input.when);
  await ensureTables();
  const requested = slugify(String(input.slug ?? "")) || slugify(title);
  const slug = await uniqueSlug(requested, id);
  await db()`
    UPDATE photo_rolls
    SET title = ${title}, note = ${note}, year = ${year}, month = ${month},
        slug = ${slug}, updated_at = NOW()
    WHERE id = ${id}
  `;
  return { slug };
}

export async function setRollPublished(idValue: unknown, published: boolean) {
  const id = cleanId(idValue);
  await ensureTables();
  if (published) {
    const rows = (await db()`
      SELECT COUNT(*)::int AS count FROM photo_frames WHERE roll_id = ${id}
    `) as Array<{ count: number }>;
    if (!Number(rows[0]?.count ?? 0)) {
      throw new Error("Add at least one frame before publishing.");
    }
  }
  const rows = (await db()`
    UPDATE photo_rolls
    SET published = ${published}, updated_at = NOW()
    WHERE id = ${id}
    RETURNING slug
  `) as Array<{ slug: string }>;
  return rows[0]?.slug ?? null;
}

async function deleteBlobs(urls: string[]) {
  const unique = Array.from(new Set(urls.filter(Boolean)));
  if (!unique.length || !process.env.BLOB_READ_WRITE_TOKEN) return;
  try {
    await del(unique);
  } catch {
    // The database row is already gone; an orphaned blob is harmless.
  }
}

export async function deleteRoll(idValue: unknown) {
  const id = cleanId(idValue);
  await ensureTables();
  const frames = (await db()`
    SELECT blob_url FROM photo_frames WHERE roll_id = ${id}
  `) as Array<{ blob_url: string }>;
  const rows = (await db()`
    DELETE FROM photo_rolls WHERE id = ${id} RETURNING slug
  `) as Array<{ slug: string }>;
  await deleteBlobs(frames.map((frame) => frame.blob_url));
  return rows[0]?.slug ?? null;
}

export async function addFrame(input: {
  rollId: unknown;
  url: unknown;
  pathname: unknown;
  width: unknown;
  height: unknown;
}) {
  const rollId = cleanId(input.rollId);
  const url = String(input.url ?? "").trim();
  const pathname = String(input.pathname ?? "")
    .trim()
    .replace(/^\//, "");
  if (
    !/^https:\/\/[a-z0-9.-]+\.public\.blob\.vercel-storage\.com\//i.test(url) ||
    !pathname.startsWith(`photography/${rollId}/`)
  ) {
    throw new Error("That upload does not belong to this roll.");
  }
  const width = Math.max(0, Math.min(20000, Math.round(Number(input.width) || 0)));
  const height = Math.max(0, Math.min(20000, Math.round(Number(input.height) || 0)));

  await ensureTables();
  const counts = (await db()`
    SELECT COUNT(*)::int AS count, COALESCE(MAX(position), -1)::int AS last
    FROM photo_frames
    WHERE roll_id = ${rollId}
  `) as Array<{ count: number; last: number }>;
  if (Number(counts[0]?.count ?? 0) >= ROLL_MAX_FRAMES) {
    throw new Error(`A roll holds at most ${ROLL_MAX_FRAMES} frames.`);
  }
  const id = randomUUID();
  const position = Number(counts[0]?.last ?? -1) + 1;
  await db()`
    INSERT INTO photo_frames (
      id, roll_id, blob_url, blob_pathname, width, height, position
    )
    VALUES (${id}, ${rollId}, ${url}, ${pathname}, ${width}, ${height}, ${position})
  `;
  await db()`
    UPDATE photo_rolls
    SET cover_frame_id = COALESCE(cover_frame_id, ${id}), updated_at = NOW()
    WHERE id = ${rollId}
  `;
  return { id, position };
}

export async function updateFrameCaption(idValue: unknown, captionValue: unknown) {
  const id = cleanId(idValue);
  const caption = cleanText(captionValue, 600);
  await ensureTables();
  await db()`
    UPDATE photo_frames SET caption = ${caption} WHERE id = ${id}
  `;
}

export async function setRollCover(rollValue: unknown, frameValue: unknown) {
  const rollId = cleanId(rollValue);
  const frameId = cleanId(frameValue);
  await ensureTables();
  await db()`
    UPDATE photo_rolls
    SET cover_frame_id = ${frameId}, updated_at = NOW()
    WHERE id = ${rollId}
      AND EXISTS (
        SELECT 1 FROM photo_frames WHERE id = ${frameId} AND roll_id = ${rollId}
      )
  `;
}

export async function moveFrame(idValue: unknown, direction: "up" | "down") {
  const id = cleanId(idValue);
  await ensureTables();
  const rows = (await db()`
    SELECT roll_id FROM photo_frames WHERE id = ${id} LIMIT 1
  `) as Array<{ roll_id: string }>;
  const rollId = rows[0]?.roll_id;
  if (!rollId) return;
  const frames = (await db()`
    SELECT id FROM photo_frames
    WHERE roll_id = ${rollId}
    ORDER BY position ASC, created_at ASC
  `) as Array<{ id: string }>;
  const order = frames.map((frame) => frame.id);
  const index = order.indexOf(id);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= order.length) return;
  [order[index], order[target]] = [order[target], order[index]];
  for (let position = 0; position < order.length; position += 1) {
    await db()`
      UPDATE photo_frames SET position = ${position} WHERE id = ${order[position]}
    `;
  }
}

export async function deleteFrame(idValue: unknown) {
  const id = cleanId(idValue);
  await ensureTables();
  const rows = (await db()`
    DELETE FROM photo_frames WHERE id = ${id}
    RETURNING roll_id, blob_url
  `) as Array<{ roll_id: string; blob_url: string }>;
  const row = rows[0];
  if (!row) return;
  // If the cover was removed, fall back to the first remaining frame.
  await db()`
    UPDATE photo_rolls
    SET cover_frame_id = (
      SELECT id FROM photo_frames
      WHERE roll_id = ${row.roll_id}
      ORDER BY position ASC, created_at ASC
      LIMIT 1
    ), updated_at = NOW()
    WHERE id = ${row.roll_id} AND cover_frame_id = ${id}
  `;
  await deleteBlobs([row.blob_url]);
}
