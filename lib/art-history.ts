import "server-only";

import { randomUUID } from "crypto";
import { neon } from "@neondatabase/serverless";
import { del, put } from "@vercel/blob";

// Art history: favourite pieces, each with the things Clementine loves
// about it. One image per piece; loves are stored one per line.

export const ART_IMAGE_MAX_BYTES = 25 * 1024 * 1024;
export const ART_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type ArtPiece = {
  id: string;
  slug: string;
  artist: string;
  title: string;
  time: string;
  year: number | null;
  place: string;
  note: string;
  loves: string[];
  image: { url: string; pathname: string; width: number; height: number } | null;
  published: boolean;
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

// One love per line; blank lines and leading bullets are dropped.
export function parseLoves(value: unknown) {
  return String(value ?? "")
    .replace(/\0/g, "")
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-*•–—]|\d+[.)])\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 30)
    .map((line) => line.slice(0, 600));
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

// "1665", "c. 1480", "1503–1519", "early 1900s" → a sortable year.
export function yearFromTime(time: string) {
  const bc = /\bbce?\b/i.test(time);
  // "12th century" / "5th c. BC" → the middle of that century.
  const century = /(\d{1,2})(?:st|nd|rd|th)\s+c(?:entury|\.)/i.exec(time);
  if (century) {
    const midpoint = (Number(century[1]) - 1) * 100 + 50;
    return bc ? -midpoint : midpoint;
  }
  const match = /(-?\d{3,4})/.exec(time);
  if (!match) return null;
  const year = Number(match[1]);
  if (!Number.isFinite(year)) return null;
  return bc ? -Math.abs(year) : year;
}

let ready: Promise<void> | null = null;

function ensureTables() {
  if (!ready) {
    ready = (async () => {
      await db()`
        CREATE TABLE IF NOT EXISTS art_pieces (
          id TEXT PRIMARY KEY,
          slug TEXT NOT NULL UNIQUE,
          artist TEXT NOT NULL,
          title TEXT NOT NULL,
          time_text TEXT NOT NULL DEFAULT '',
          year INTEGER,
          place TEXT NOT NULL DEFAULT '',
          note TEXT NOT NULL DEFAULT '',
          loves TEXT NOT NULL DEFAULT '',
          image_url TEXT NOT NULL DEFAULT '',
          image_pathname TEXT NOT NULL DEFAULT '',
          image_width INTEGER NOT NULL DEFAULT 0,
          image_height INTEGER NOT NULL DEFAULT 0,
          published BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
    })().catch((error) => {
      ready = null;
      throw error;
    });
  }
  return ready;
}

function mapPiece(row: Record<string, unknown>): ArtPiece {
  const url = String(row.image_url ?? "");
  return {
    id: String(row.id),
    slug: String(row.slug),
    artist: String(row.artist),
    title: String(row.title),
    time: String(row.time_text ?? ""),
    year: row.year === null || row.year === undefined ? null : Number(row.year),
    place: String(row.place ?? ""),
    note: String(row.note ?? ""),
    loves: parseLoves(row.loves),
    image: url
      ? {
          url,
          pathname: String(row.image_pathname ?? ""),
          width: Number(row.image_width ?? 0),
          height: Number(row.image_height ?? 0),
        }
      : null,
    published: Boolean(row.published),
    createdAt: new Date(row.created_at as string | Date).toISOString(),
    updatedAt: new Date(row.updated_at as string | Date).toISOString(),
  };
}

async function listPieces(onlyPublished: boolean) {
  if (!databaseUrl()) return [];
  await ensureTables();
  // Oldest first: it is a history.
  const rows = (onlyPublished
    ? await db()`
        SELECT id, slug, artist, title, time_text, year, place, note, loves,
           image_url, image_pathname, image_width, image_height, published,
           created_at, updated_at
        FROM art_pieces
        WHERE published = TRUE AND image_url <> ''
        ORDER BY year ASC NULLS LAST, created_at ASC
      `
    : await db()`
        SELECT id, slug, artist, title, time_text, year, place, note, loves,
           image_url, image_pathname, image_width, image_height, published,
           created_at, updated_at
        FROM art_pieces
        ORDER BY year ASC NULLS LAST, created_at ASC
      `) as Array<Record<string, unknown>>;
  return rows.map(mapPiece);
}

export function listPublishedPieces() {
  return listPieces(true);
}

export function listAllPieces() {
  return listPieces(false);
}

export async function getPieceBySlug(slugValue: string) {
  const slug = String(slugValue ?? "").trim().toLowerCase();
  if (!/^[a-z0-9_-]{1,80}$/.test(slug) || !databaseUrl()) return null;
  await ensureTables();
  const rows = (await db()`
    SELECT id, slug, artist, title, time_text, year, place, note, loves,
           image_url, image_pathname, image_width, image_height, published,
           created_at, updated_at
    FROM art_pieces WHERE slug = ${slug} LIMIT 1
  `) as Array<Record<string, unknown>>;
  return rows[0] ? mapPiece(rows[0]) : null;
}

export async function getPieceById(idValue: unknown) {
  const id = cleanId(idValue);
  if (!databaseUrl()) return null;
  await ensureTables();
  const rows = (await db()`
    SELECT id, slug, artist, title, time_text, year, place, note, loves,
           image_url, image_pathname, image_width, image_height, published,
           created_at, updated_at
    FROM art_pieces WHERE id = ${id} LIMIT 1
  `) as Array<Record<string, unknown>>;
  return rows[0] ? mapPiece(rows[0]) : null;
}

async function uniqueSlug(base: string, exceptId?: string) {
  const root = base || "piece";
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = attempt ? `${root}-${attempt + 1}` : root;
    const rows = (await db()`
      SELECT id FROM art_pieces WHERE slug = ${candidate} LIMIT 1
    `) as Array<{ id: string }>;
    if (!rows[0] || rows[0].id === exceptId) return candidate;
  }
  return `${root}-${randomUUID().slice(0, 6)}`;
}

type PieceFields = {
  artist: unknown;
  title: unknown;
  time: unknown;
  place: unknown;
  note: unknown;
  loves: unknown;
};

function cleanFields(input: PieceFields) {
  const artist = cleanLine(input.artist, 120);
  const title = cleanLine(input.title, 160);
  if (!title) throw new Error("Name the piece.");
  if (!artist) throw new Error("Name the artist.");
  const time = cleanLine(input.time, 60);
  return {
    artist,
    title,
    time,
    year: yearFromTime(time),
    place: cleanLine(input.place, 160),
    note: cleanText(input.note, 2000),
    loves: parseLoves(input.loves).join("\n"),
  };
}

export async function createPiece(input: PieceFields) {
  const fields = cleanFields(input);
  await ensureTables();
  const id = randomUUID();
  const slug = await uniqueSlug(slugify(fields.title));
  await db()`
    INSERT INTO art_pieces (
      id, slug, artist, title, time_text, year, place, note, loves
    )
    VALUES (
      ${id}, ${slug}, ${fields.artist}, ${fields.title}, ${fields.time},
      ${fields.year}, ${fields.place}, ${fields.note}, ${fields.loves}
    )
  `;
  return { id, slug };
}

export async function updatePiece(input: PieceFields & { id: unknown; slug: unknown }) {
  const id = cleanId(input.id);
  const fields = cleanFields(input);
  await ensureTables();
  const requested = slugify(String(input.slug ?? "")) || slugify(fields.title);
  const slug = await uniqueSlug(requested, id);
  await db()`
    UPDATE art_pieces
    SET artist = ${fields.artist}, title = ${fields.title},
        time_text = ${fields.time}, year = ${fields.year},
        place = ${fields.place}, note = ${fields.note}, loves = ${fields.loves},
        slug = ${slug}, updated_at = NOW()
    WHERE id = ${id}
  `;
  return { slug };
}

export async function setPiecePublished(idValue: unknown, published: boolean) {
  const id = cleanId(idValue);
  await ensureTables();
  if (published) {
    const rows = (await db()`
      SELECT image_url FROM art_pieces WHERE id = ${id}
    `) as Array<{ image_url: string }>;
    if (!rows[0]?.image_url) throw new Error("Add an image before publishing.");
  }
  const rows = (await db()`
    UPDATE art_pieces SET published = ${published}, updated_at = NOW()
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
    // Row is already gone; an orphaned blob is harmless.
  }
}

export async function deletePiece(idValue: unknown) {
  const id = cleanId(idValue);
  await ensureTables();
  const rows = (await db()`
    DELETE FROM art_pieces WHERE id = ${id} RETURNING slug, image_url
  `) as Array<{ slug: string; image_url: string }>;
  const row = rows[0];
  if (!row) return null;
  await deleteBlobs([row.image_url]);
  return row.slug;
}

// Attach an image already uploaded to Blob by the browser.
export async function setPieceImage(input: {
  id: unknown;
  url: unknown;
  pathname: unknown;
  width: unknown;
  height: unknown;
}) {
  const id = cleanId(input.id);
  const url = String(input.url ?? "").trim();
  const pathname = String(input.pathname ?? "")
    .trim()
    .replace(/^\//, "");
  if (
    !/^https:\/\/[a-z0-9.-]+\.public\.blob\.vercel-storage\.com\//i.test(url) ||
    !pathname.startsWith(`art-history/${id}/`)
  ) {
    throw new Error("That upload does not belong to this piece.");
  }
  const width = Math.max(0, Math.min(20000, Math.round(Number(input.width) || 0)));
  const height = Math.max(0, Math.min(20000, Math.round(Number(input.height) || 0)));
  await ensureTables();
  const previous = (await db()`
    SELECT image_url FROM art_pieces WHERE id = ${id}
  `) as Array<{ image_url: string }>;
  if (!previous[0]) throw new Error("Unknown piece.");
  await db()`
    UPDATE art_pieces
    SET image_url = ${url}, image_pathname = ${pathname},
        image_width = ${width}, image_height = ${height}, updated_at = NOW()
    WHERE id = ${id}
  `;
  if (previous[0].image_url !== url) await deleteBlobs([previous[0].image_url]);
}

// Fetch an image from the web (museum open-access, Wikipedia…) on the
// server and keep a copy in Blob so the piece never depends on a hotlink.
export async function importPieceImageFromUrl(idValue: unknown, sourceValue: unknown) {
  const id = cleanId(idValue);
  const source = String(sourceValue ?? "").trim();
  let parsed: URL;
  try {
    parsed = new URL(source);
  } catch {
    throw new Error("That is not a URL.");
  }
  if (parsed.protocol !== "https:") throw new Error("Use an https image URL.");
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("Image storage is not configured.");
  }

  const response = await fetch(parsed, {
    headers: {
      // Wikimedia and many museums refuse requests without a UA.
      "User-Agent": "clemissima.com art-history importer (+https://clemissima.com)",
      Accept: "image/jpeg,image/png,image/webp,image/*;q=0.8",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`The image could not be fetched (${response.status}).`);
  const type = (response.headers.get("content-type") ?? "").split(";")[0].trim();
  if (!(ART_CONTENT_TYPES as readonly string[]).includes(type)) {
    throw new Error(`That URL is ${type || "not an image"}; it needs to be a JPEG, PNG or WebP file.`);
  }
  const length = Number(response.headers.get("content-length") ?? 0);
  if (length > ART_IMAGE_MAX_BYTES) throw new Error("That image is over 25 MB.");
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength > ART_IMAGE_MAX_BYTES) throw new Error("That image is over 25 MB.");

  const { width, height } = imageSize(buffer, type);
  const extension = type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
  const blob = await put(`art-history/${id}/${randomUUID()}.${extension}`, buffer, {
    access: "public",
    contentType: type,
    addRandomSuffix: true,
  });

  await ensureTables();
  const rows = (await db()`
    SELECT image_url FROM art_pieces WHERE id = ${id}
  `) as Array<{ image_url: string }>;
  await db()`
    UPDATE art_pieces
    SET image_url = ${blob.url}, image_pathname = ${blob.pathname},
        image_width = ${width}, image_height = ${height}, updated_at = NOW()
    WHERE id = ${id}
  `;
  await deleteBlobs([rows[0]?.image_url ?? ""]);
}

export async function removePieceImage(idValue: unknown) {
  const id = cleanId(idValue);
  await ensureTables();
  const previous = (await db()`
    SELECT image_url FROM art_pieces WHERE id = ${id}
  `) as Array<{ image_url: string }>;
  await db()`
    UPDATE art_pieces
    SET image_url = '', image_pathname = '', image_width = 0, image_height = 0,
        published = FALSE, updated_at = NOW()
    WHERE id = ${id}
  `;
  await deleteBlobs([previous[0]?.image_url ?? ""]);
}

// Minimal header parsing for the three formats we accept; 0×0 on failure
// (the pages fall back to a 3:2 box).
function imageSize(buffer: Buffer, type: string) {
  try {
    if (type === "image/png" && buffer.readUInt32BE(12) === 0x49484452) {
      return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
    }
    if (type === "image/webp" && buffer.toString("ascii", 0, 4) === "RIFF") {
      const chunk = buffer.toString("ascii", 12, 16);
      if (chunk === "VP8X") {
        return {
          width: 1 + buffer.readUIntLE(24, 3),
          height: 1 + buffer.readUIntLE(27, 3),
        };
      }
      if (chunk === "VP8 ") {
        return {
          width: buffer.readUInt16LE(26) & 0x3fff,
          height: buffer.readUInt16LE(28) & 0x3fff,
        };
      }
      if (chunk === "VP8L") {
        const bits = buffer.readUInt32LE(21);
        return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
      }
    }
    if (type === "image/jpeg") {
      let offset = 2;
      while (offset + 9 < buffer.length) {
        if (buffer[offset] !== 0xff) break;
        const marker = buffer[offset + 1];
        const size = buffer.readUInt16BE(offset + 2);
        if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
          return {
            height: buffer.readUInt16BE(offset + 5),
            width: buffer.readUInt16BE(offset + 7),
          };
        }
        offset += 2 + size;
      }
    }
  } catch {
    // fall through
  }
  return { width: 0, height: 0 };
}
