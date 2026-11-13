import "server-only";

import { neon } from "@neondatabase/serverless";
import { getPoem } from "@/lib/poems";

function db() {
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? "";
  if (!url) throw new Error("Database is not configured.");
  return neon(url);
}

let ready: Promise<void> | null = null;

function ensureTable() {
  ready ??= (async () => {
    await db()`
      CREATE TABLE IF NOT EXISTS poem_reads (
        slug TEXT PRIMARY KEY,
        reads INTEGER NOT NULL DEFAULT 0
      )
    `;
  })().catch((error) => {
    ready = null;
    throw error;
  });
  return ready;
}

function cleanSlug(slug: unknown) {
  if (typeof slug !== "string" || !getPoem(slug)) throw new Error("Unknown poem.");
  return slug;
}

export async function poemReads(slug: unknown) {
  const key = cleanSlug(slug);
  await ensureTable();
  const rows = await db()`SELECT reads FROM poem_reads WHERE slug = ${key}`;
  return Number(rows[0]?.reads ?? 0);
}

export async function countPoemRead(slug: unknown) {
  const key = cleanSlug(slug);
  await ensureTable();
  const rows = await db()`
    INSERT INTO poem_reads (slug, reads) VALUES (${key}, 1)
    ON CONFLICT (slug) DO UPDATE SET reads = poem_reads.reads + 1
    RETURNING reads
  `;
  return Number(rows[0].reads);
}
