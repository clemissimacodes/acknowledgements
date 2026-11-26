import "server-only";

import { randomBytes, randomUUID } from "crypto";
import { del } from "@vercel/blob";
import { neon } from "@neondatabase/serverless";
import {
  FRIEND_BADGES,
  MET_HOW,
  friendPrice,
  isFriendBadge,
  isFriendEra,
  slugifyFriend,
  type Friend,
  type FriendColor,
  type Receipt,
  type ReceiptItem,
} from "@/lib/friend-types";

export const FRIEND_BLOB_PREFIX = "friends-and-family/";

function db() {
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? "";
  if (!url) throw new Error("Database is not configured.");
  return neon(url);
}

function iso(value: unknown) {
  return value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();
}

function text(value: unknown, max: number) {
  return String(value ?? "")
    .replace(/\0/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
}

function list(value: unknown, max: number, each: number): string[] {
  const raw = Array.isArray(value)
    ? value
    : String(value ?? "")
        .split(/\n|,/)
        .map((item) => item.trim());
  return raw
    .map((item) => text(item, each))
    .filter(Boolean)
    .slice(0, max);
}

function colors(value: unknown): FriendColor[] {
  const raw = Array.isArray(value)
    ? value
    : String(value ?? "")
        .split(/\n|,/)
        .map((item) => {
          const [name, hex] = item.split(/[:=]/).map((part) => part.trim());
          return { name, hex };
        });
  return raw
    .map((item) => ({
      name: text((item as FriendColor)?.name, 32),
      hex: String((item as FriendColor)?.hex ?? "").trim().toLowerCase(),
    }))
    .filter((item) => /^#[0-9a-f]{6}$/.test(item.hex))
    .map((item) => ({ name: item.name || item.hex, hex: item.hex }))
    .slice(0, 4);
}

function dateOnly(value: unknown) {
  const raw = String(value ?? "").trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) && !Number.isNaN(Date.parse(raw)) ? raw : null;
}

let ready: Promise<void> | null = null;
function ensureTables() {
  if (!ready) {
    ready = (async () => {
      const sql = db();
      await sql`
        CREATE TABLE IF NOT EXISTS friends (
          id TEXT PRIMARY KEY,
          slug TEXT NOT NULL UNIQUE,
          nickname TEXT NOT NULL,
          product_name TEXT NOT NULL DEFAULT '',
          era TEXT NOT NULL,
          badge TEXT NOT NULL DEFAULT 'one-of-one',
          met_on DATE NOT NULL,
          met_how TEXT NOT NULL DEFAULT '',
          hometown TEXT NOT NULL DEFAULT '',
          made_of JSONB NOT NULL DEFAULT '[]',
          care TEXT NOT NULL DEFAULT '',
          description TEXT NOT NULL DEFAULT '',
          relationship TEXT NOT NULL DEFAULT '',
          relationship_options JSONB NOT NULL DEFAULT '[]',
          colors JSONB NOT NULL DEFAULT '[]',
          hero_url TEXT,
          hero_pathname TEXT,
          alt_url TEXT,
          alt_pathname TEXT,
          pairs_with JSONB NOT NULL DEFAULT '[]',
          visible BOOLEAN NOT NULL DEFAULT FALSE,
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`ALTER TABLE friends ADD COLUMN IF NOT EXISTS favorite_memory TEXT NOT NULL DEFAULT ''`;
      await sql`ALTER TABLE friends ADD COLUMN IF NOT EXISTS favorite_trait TEXT NOT NULL DEFAULT ''`;
      await sql`
        CREATE TABLE IF NOT EXISTS friend_receipts (
          id TEXT PRIMARY KEY,
          items JSONB NOT NULL,
          note TEXT NOT NULL DEFAULT '',
          visitor_hash TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
    })().catch((error) => {
      ready = null;
      throw error;
    });
  }
  return ready;
}

type Row = Record<string, unknown>;

function toFriend(row: Row): Friend {
  const metOn = row.met_on instanceof Date ? row.met_on.toISOString().slice(0, 10) : String(row.met_on).slice(0, 10);
  return {
    id: String(row.id),
    slug: String(row.slug),
    nickname: String(row.nickname),
    productName: String(row.product_name ?? ""),
    era: isFriendEra(row.era) ? row.era : "new-arrivals",
    badge: isFriendBadge(row.badge) ? row.badge : "one-of-one",
    metOn,
    metHow: String(row.met_how ?? ""),
    hometown: String(row.hometown ?? ""),
    madeOf: Array.isArray(row.made_of) ? (row.made_of as string[]) : [],
    care: String(row.care ?? ""),
    description: String(row.description ?? ""),
    favoriteMemory: String(row.favorite_memory ?? ""),
    favoriteTrait: String(row.favorite_trait ?? ""),
    relationship: String(row.relationship ?? ""),
    relationshipOptions: Array.isArray(row.relationship_options) ? (row.relationship_options as string[]) : [],
    colors: Array.isArray(row.colors) ? (row.colors as FriendColor[]) : [],
    heroUrl: (row.hero_url as string | null) ?? null,
    heroPathname: (row.hero_pathname as string | null) ?? null,
    altUrl: (row.alt_url as string | null) ?? null,
    altPathname: (row.alt_pathname as string | null) ?? null,
    pairsWith: Array.isArray(row.pairs_with) ? (row.pairs_with as string[]) : [],
    visible: Boolean(row.visible),
    sortOrder: Number(row.sort_order ?? 0),
    createdAt: iso(row.created_at),
  };
}

export async function listFriends({ all = false } = {}): Promise<Friend[]> {
  await ensureTables();
  const sql = db();
  const rows = all
    ? await sql`SELECT * FROM friends ORDER BY sort_order ASC, met_on ASC, created_at ASC`
    : await sql`SELECT * FROM friends WHERE visible ORDER BY sort_order ASC, met_on ASC, created_at ASC`;
  return (rows as Row[]).map(toFriend);
}

export async function getFriendBySlug(slug: string, { all = false } = {}): Promise<Friend | null> {
  await ensureTables();
  const sql = db();
  const rows = (await sql`SELECT * FROM friends WHERE slug = ${slug} LIMIT 1`) as Row[];
  const friend = rows[0] ? toFriend(rows[0]) : null;
  return friend && (all || friend.visible) ? friend : null;
}

export async function getFriendById(id: string): Promise<Friend | null> {
  await ensureTables();
  const sql = db();
  const rows = (await sql`SELECT * FROM friends WHERE id = ${id} LIMIT 1`) as Row[];
  return rows[0] ? toFriend(rows[0]) : null;
}

export type FriendInput = {
  nickname: unknown;
  slug?: unknown;
  productName?: unknown;
  era?: unknown;
  badge?: unknown;
  metOn?: unknown;
  metHow?: unknown;
  hometown?: unknown;
  madeOf?: unknown;
  care?: unknown;
  description?: unknown;
  favoriteMemory?: unknown;
  favoriteTrait?: unknown;
  relationship?: unknown;
  relationshipOptions?: unknown;
  colors?: unknown;
  pairsWith?: unknown;
  visible?: unknown;
  sortOrder?: unknown;
};

function normalise(input: FriendInput) {
  const nickname = text(input.nickname, 60);
  if (!nickname) throw new Error("A nickname is required.");
  const metOn = dateOnly(input.metOn);
  if (!metOn) throw new Error("The date we met is required (YYYY-MM-DD).");
  const relationship = text(input.relationship, 40);
  const options = list(input.relationshipOptions, 6, 40);
  if (relationship && !options.includes(relationship)) options.unshift(relationship);
  return {
    nickname,
    slug: slugifyFriend(text(input.slug, 60) || nickname),
    productName: text(input.productName, 80),
    era: isFriendEra(input.era) ? input.era : "new-arrivals",
    badge: isFriendBadge(input.badge) ? input.badge : "one-of-one",
    metOn,
    metHow: text(input.metHow, 60),
    hometown: text(input.hometown, 80),
    madeOf: list(input.madeOf, 6, 80),
    care: text(input.care, 600),
    description: text(input.description, 1600),
    favoriteMemory: text(input.favoriteMemory, 1600),
    favoriteTrait: text(input.favoriteTrait, 600),
    relationship,
    relationshipOptions: options,
    colors: colors(input.colors),
    pairsWith: list(input.pairsWith, 8, 60).map(slugifyFriend),
    visible: input.visible === true || input.visible === "on" || input.visible === "true",
    sortOrder: Number.isFinite(Number(input.sortOrder)) ? Math.trunc(Number(input.sortOrder)) : 0,
  };
}

export async function createFriend(input: FriendInput) {
  await ensureTables();
  const sql = db();
  const f = normalise(input);
  const id = randomUUID();
  const taken = (await sql`SELECT 1 FROM friends WHERE slug = ${f.slug}`) as Row[];
  const slug = taken.length ? `${f.slug}-${id.slice(0, 4)}` : f.slug;
  await sql`
    INSERT INTO friends (id, slug, nickname, product_name, era, badge, met_on, met_how, hometown, made_of, care,
      description, favorite_memory, favorite_trait, relationship, relationship_options, colors, pairs_with, visible, sort_order)
    VALUES (${id}, ${slug}, ${f.nickname}, ${f.productName}, ${f.era}, ${f.badge}, ${f.metOn}, ${f.metHow},
      ${f.hometown}, ${JSON.stringify(f.madeOf)}, ${f.care}, ${f.description}, ${f.favoriteMemory}, ${f.favoriteTrait}, ${f.relationship},
      ${JSON.stringify(f.relationshipOptions)}, ${JSON.stringify(f.colors)}, ${JSON.stringify(f.pairsWith)},
      ${f.visible}, ${f.sortOrder})
  `;
  return getFriendById(id);
}

export async function updateFriend(id: string, input: FriendInput) {
  await ensureTables();
  const sql = db();
  const f = normalise(input);
  const clash = (await sql`SELECT 1 FROM friends WHERE slug = ${f.slug} AND id <> ${id}`) as Row[];
  if (clash.length) throw new Error(`The slug "${f.slug}" is already taken.`);
  await sql`
    UPDATE friends SET slug = ${f.slug}, nickname = ${f.nickname}, product_name = ${f.productName}, era = ${f.era},
      badge = ${f.badge}, met_on = ${f.metOn}, met_how = ${f.metHow}, hometown = ${f.hometown},
      made_of = ${JSON.stringify(f.madeOf)}, care = ${f.care}, description = ${f.description},
      favorite_memory = ${f.favoriteMemory}, favorite_trait = ${f.favoriteTrait},
      relationship = ${f.relationship}, relationship_options = ${JSON.stringify(f.relationshipOptions)},
      colors = ${JSON.stringify(f.colors)}, pairs_with = ${JSON.stringify(f.pairsWith)}, visible = ${f.visible},
      sort_order = ${f.sortOrder}, updated_at = NOW()
    WHERE id = ${id}
  `;
  return getFriendById(id);
}

export async function setFriendImage(
  id: string,
  which: "hero" | "alt",
  image: { url: string; pathname: string } | null,
) {
  await ensureTables();
  const sql = db();
  const current = await getFriendById(id);
  if (!current) throw new Error("Friend not found.");
  const oldPath = which === "hero" ? current.heroPathname : current.altPathname;
  if (which === "hero") {
    await sql`UPDATE friends SET hero_url = ${image?.url ?? null}, hero_pathname = ${image?.pathname ?? null}, updated_at = NOW() WHERE id = ${id}`;
  } else {
    await sql`UPDATE friends SET alt_url = ${image?.url ?? null}, alt_pathname = ${image?.pathname ?? null}, updated_at = NOW() WHERE id = ${id}`;
  }
  if (oldPath && oldPath !== image?.pathname && process.env.BLOB_READ_WRITE_TOKEN) {
    await del(oldPath).catch(() => undefined);
  }
}

export async function setFriendVisible(id: string, visible: boolean) {
  await ensureTables();
  await db()`UPDATE friends SET visible = ${visible}, updated_at = NOW() WHERE id = ${id}`;
}

export async function deleteFriend(id: string) {
  await ensureTables();
  const current = await getFriendById(id);
  if (!current) return;
  await db()`DELETE FROM friends WHERE id = ${id}`;
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    for (const path of [current.heroPathname, current.altPathname]) {
      if (path) await del(path).catch(() => undefined);
    }
  }
}

/* ---- Receipts -------------------------------------------------------- */

function receiptId() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(6);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export async function createReceipt(slugs: string[], note: unknown, visitorHash: string | null) {
  await ensureTables();
  const sql = db();
  const unique = [...new Set(slugs.map(slugifyFriend))].slice(0, 24);
  if (!unique.length) throw new Error("Your bag is empty.");
  const rows = (await sql`SELECT * FROM friends WHERE visible AND slug = ANY(${unique})`) as Row[];
  const bySlug = new Map(rows.map((row) => [String(row.slug), toFriend(row)]));
  const items: ReceiptItem[] = unique
    .map((slug) => bySlug.get(slug))
    .filter((f): f is Friend => Boolean(f))
    .map((f) => ({
      slug: f.slug,
      nickname: f.nickname,
      productName: f.productName,
      price: friendPrice(f.metOn),
      heroUrl: f.heroUrl,
    }));
  if (!items.length) throw new Error("Your bag is empty.");
  if (visitorHash) {
    const recent = (await sql`
      SELECT count(*)::int AS n FROM friend_receipts
      WHERE visitor_hash = ${visitorHash} AND created_at > NOW() - INTERVAL '1 hour'
    `) as Array<{ n: number }>;
    if ((recent[0]?.n ?? 0) >= 20) throw new Error("Slow down a little.");
  }
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const id = receiptId();
    try {
      await sql`INSERT INTO friend_receipts (id, items, note, visitor_hash) VALUES (${id}, ${JSON.stringify(items)}, ${text(note, 280)}, ${visitorHash})`;
      return id;
    } catch (error) {
      if (attempt === 4) throw error;
    }
  }
  throw new Error("Could not write the receipt.");
}

export async function getReceipt(id: string): Promise<Receipt | null> {
  await ensureTables();
  const clean = id.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
  if (!clean) return null;
  const rows = (await db()`SELECT * FROM friend_receipts WHERE id = ${clean} LIMIT 1`) as Row[];
  const row = rows[0];
  if (!row) return null;
  return {
    id: String(row.id),
    items: Array.isArray(row.items) ? (row.items as ReceiptItem[]) : [],
    note: String(row.note ?? ""),
    createdAt: iso(row.created_at),
  };
}

export { FRIEND_BADGES, MET_HOW };
