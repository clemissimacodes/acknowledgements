import { randomUUID } from "crypto";
import { neon } from "@neondatabase/serverless";

type Introduction = {
  tinyThing: string;
};

function databaseUrl() {
  return process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? "";
}

function cleanLine(value: unknown, max: number) {
  return String(value ?? "")
    .replace(/\0/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export function cleanIntroduction(raw: {
  tinyThing?: unknown;
}): Introduction | null {
  const tinyThing = cleanLine(raw.tinyThing, 400);
  return tinyThing.length >= 3 ? { tinyThing } : null;
}

export async function addIntroduction(introduction: Introduction) {
  const url = databaseUrl();
  if (!url) return false;

  try {
    const sql = neon(url);
    await sql`
      CREATE TABLE IF NOT EXISTS visitor_introductions (
        id TEXT PRIMARY KEY,
        name TEXT,
        location TEXT,
        found_via TEXT,
        tiny_thing TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`
      ALTER TABLE visitor_introductions
        ALTER COLUMN name DROP NOT NULL,
        ALTER COLUMN location DROP NOT NULL,
        ALTER COLUMN found_via DROP NOT NULL
    `;
    await sql`
      INSERT INTO visitor_introductions (
        id,
        tiny_thing
      )
      VALUES (
        ${randomUUID()},
        ${introduction.tinyThing}
      )
    `;
    return true;
  } catch {
    return false;
  }
}
