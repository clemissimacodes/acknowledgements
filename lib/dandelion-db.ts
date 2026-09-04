import { neon } from "@neondatabase/serverless";
import type { Wish, WishExtras } from "@/lib/dandelion-types";

const VISIBLE = 40;

function databaseUrl() {
  return process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? "";
}

export function postgresConfigured() {
  return Boolean(databaseUrl());
}

function sql() {
  return neon(databaseUrl());
}

async function ensureTable() {
  const db = sql();
  await db`
    CREATE TABLE IF NOT EXISTS dandelion_wishes (
      id TEXT PRIMARY KEY,
      body TEXT NOT NULL,
      location TEXT,
      gender TEXT,
      age TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

export async function postgresListWishes(): Promise<Wish[] | null> {
  if (!postgresConfigured()) return null;
  try {
    await ensureTable();
    const rows = (await sql()`
      SELECT id, body, location, gender, age, created_at
      FROM dandelion_wishes
      ORDER BY created_at DESC
      LIMIT ${VISIBLE}
    `) as Array<{
      id: string;
      body: string;
      location: string | null;
      gender: string | null;
      age: string | null;
      created_at: string | Date;
    }>;
    return rows.map((row) => ({
      id: row.id,
      body: row.body,
      createdAt:
        row.created_at instanceof Date
          ? row.created_at.toISOString()
          : new Date(row.created_at).toISOString(),
      ...(row.location ? { location: row.location } : {}),
      ...(row.gender ? { gender: row.gender } : {}),
      ...(row.age ? { age: row.age } : {}),
    }));
  } catch {
    return null;
  }
}

export async function postgresAddWish(
  wish: Wish,
  extras: WishExtras,
): Promise<Wish | null> {
  if (!postgresConfigured()) return null;
  try {
    await ensureTable();
    await sql()`
      INSERT INTO dandelion_wishes (id, body, location, gender, age, created_at)
      VALUES (
        ${wish.id},
        ${wish.body},
        ${extras.location ?? null},
        ${extras.gender ?? null},
        ${extras.age ?? null},
        ${wish.createdAt}
      )
    `;
    return wish;
  } catch {
    return null;
  }
}
