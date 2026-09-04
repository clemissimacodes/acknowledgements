import { randomUUID } from "crypto";
import { neon } from "@neondatabase/serverless";

type Introduction = {
  name: string;
  location: string;
  foundVia: string;
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
  name?: unknown;
  location?: unknown;
  foundVia?: unknown;
  tinyThing?: unknown;
}): Introduction | null {
  const introduction = {
    name: cleanLine(raw.name, 80),
    location: cleanLine(raw.location, 120),
    foundVia: cleanLine(raw.foundVia, 240),
    tinyThing: cleanLine(raw.tinyThing, 400),
  };

  if (
    introduction.name.length < 2 ||
    introduction.location.length < 2 ||
    introduction.foundVia.length < 3 ||
    introduction.tinyThing.length < 3
  ) {
    return null;
  }

  return introduction;
}

export async function addIntroduction(introduction: Introduction) {
  const url = databaseUrl();
  if (!url) return false;

  try {
    const sql = neon(url);
    await sql`
      CREATE TABLE IF NOT EXISTS visitor_introductions (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        location TEXT NOT NULL,
        found_via TEXT NOT NULL,
        tiny_thing TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`
      INSERT INTO visitor_introductions (
        id,
        name,
        location,
        found_via,
        tiny_thing
      )
      VALUES (
        ${randomUUID()},
        ${introduction.name},
        ${introduction.location},
        ${introduction.foundVia},
        ${introduction.tinyThing}
      )
    `;
    return true;
  } catch {
    return false;
  }
}
