import "server-only";

import { randomUUID } from "crypto";
import { neon } from "@neondatabase/serverless";
import {
  PLACE_COUNTRY_MAX,
  PLACE_KINDS,
  PLACE_NAME_MAX,
  PLACE_REASON_MAX,
  PLACE_YEAR_MAX,
  PLACE_YEAR_MIN,
  SEED_PLACES,
  type Place,
  type PlaceKind,
  type PlaceMatch,
} from "@/lib/place-types";

// The public world map at /places. Unrelated to the control room's private
// clemi_places (lib/tracker.ts).

function db() {
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? "";
  if (!url) throw new Error("Database is not configured.");
  return neon(url);
}

let ready: Promise<void> | null = null;

function ensureTable() {
  ready ??= (async () => {
    const sql = db();
    await sql`
      CREATE TABLE IF NOT EXISTS map_places (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        country TEXT NOT NULL DEFAULT '',
        lat DOUBLE PRECISION NOT NULL,
        lng DOUBLE PRECISION NOT NULL,
        kind TEXT NOT NULL DEFAULT 'visited',
        month SMALLINT,
        year SMALLINT,
        reason TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    // The ledger of seeds already planted. A seed's row here outlives the
    // place itself, so a seeded place that gets deleted is never planted again.
    await sql`
      CREATE TABLE IF NOT EXISTS map_place_seeds (
        id TEXT PRIMARY KEY,
        seeded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    const seeds = SEED_PLACES.map((place, index) => ({ ...place, rank: index }));
    await sql`
      WITH seeds AS (
        SELECT *
        FROM jsonb_to_recordset(${JSON.stringify(seeds)}::jsonb) AS seed(
          id TEXT,
          name TEXT,
          country TEXT,
          lat DOUBLE PRECISION,
          lng DOUBLE PRECISION,
          kind TEXT,
          rank INTEGER
        )
      ),
      planted AS (
        INSERT INTO map_place_seeds (id)
        SELECT id FROM seeds
        ON CONFLICT (id) DO NOTHING
        RETURNING id
      )
      INSERT INTO map_places (id, name, country, lat, lng, kind, created_at)
      SELECT
        seeds.id,
        seeds.name,
        seeds.country,
        seeds.lat,
        seeds.lng,
        seeds.kind,
        NOW() + seeds.rank * INTERVAL '1 millisecond'
      FROM seeds
      JOIN planted ON planted.id = seeds.id
      ON CONFLICT (id) DO NOTHING
    `;
  })().catch((error) => {
    ready = null;
    throw error;
  });
  return ready;
}

function mapPlace(row: Record<string, unknown>): Place {
  const kind = String(row.kind);
  return {
    id: String(row.id),
    name: String(row.name),
    country: String(row.country ?? ""),
    lat: Number(row.lat),
    lng: Number(row.lng),
    kind: PLACE_KINDS.includes(kind as PlaceKind) ? (kind as PlaceKind) : "visited",
    month: row.month == null ? null : Number(row.month),
    year: row.year == null ? null : Number(row.year),
    reason: String(row.reason ?? ""),
  };
}

function cleanId(value: unknown) {
  const id = String(value ?? "").trim();
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(id)) throw new Error("Invalid place.");
  return id;
}

function cleanLine(value: unknown, maximum: number) {
  return String(value ?? "")
    .replace(/\0/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
}

function cleanWhole(value: unknown, minimum: number, maximum: number, message: string) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number < minimum || number > maximum) {
    throw new Error(message);
  }
  return number;
}

function cleanDetails(input: Record<string, unknown>) {
  const name = cleanLine(input.name, PLACE_NAME_MAX);
  if (!name) throw new Error("A place needs a name.");
  const kind = PLACE_KINDS.includes(input.kind as PlaceKind)
    ? (input.kind as PlaceKind)
    : "visited";
  return {
    name,
    country: cleanLine(input.country, PLACE_COUNTRY_MAX),
    kind,
    month: cleanWhole(input.month, 1, 12, "That month does not exist."),
    year: cleanWhole(input.year, PLACE_YEAR_MIN, PLACE_YEAR_MAX, "That year looks wrong."),
    reason: cleanLine(input.reason, PLACE_REASON_MAX),
  };
}

function cleanCoordinates(input: Record<string, unknown>) {
  const lat = Number(input.lat);
  const lng = Number(input.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90) {
    throw new Error("A place needs a spot on the map.");
  }
  return { lat, lng: ((((lng + 180) % 360) + 360) % 360) - 180 };
}

export async function getPlaces() {
  await ensureTable();
  const rows = (await db()`
    SELECT id, name, country, lat, lng, kind, month, year, reason
    FROM map_places
    ORDER BY created_at, id
  `) as Array<Record<string, unknown>>;
  return rows.map(mapPlace);
}

/** The seeds stand in when the database is missing, so the page still opens. */
export async function loadPlaces(): Promise<{ places: Place[]; live: boolean }> {
  try {
    return { places: await getPlaces(), live: true };
  } catch {
    return { places: SEED_PLACES, live: false };
  }
}

// There is one hometown and one "now". Naming a new one turns the old one into
// somewhere she has been, in the same statement as the write.

export async function createPlace(input: Record<string, unknown>) {
  const details = cleanDetails(input);
  const { lat, lng } = cleanCoordinates(input);
  const id = randomUUID();
  await ensureTable();
  await db()`
    WITH demoted AS (
      UPDATE map_places
      SET kind = 'visited', updated_at = NOW()
      WHERE kind = ${details.kind} AND kind <> 'visited'
    )
    INSERT INTO map_places (id, name, country, lat, lng, kind, month, year, reason)
    VALUES (
      ${id}, ${details.name}, ${details.country}, ${lat}, ${lng},
      ${details.kind}, ${details.month}, ${details.year}, ${details.reason}
    )
  `;
  return id;
}

export async function updatePlace(idValue: unknown, input: Record<string, unknown>) {
  const id = cleanId(idValue);
  const details = cleanDetails(input);
  await ensureTable();
  await db()`
    WITH demoted AS (
      UPDATE map_places
      SET kind = 'visited', updated_at = NOW()
      WHERE kind = ${details.kind} AND kind <> 'visited' AND id <> ${id}
    )
    UPDATE map_places
    SET name = ${details.name},
        country = ${details.country},
        kind = ${details.kind},
        month = ${details.month},
        year = ${details.year},
        reason = ${details.reason},
        updated_at = NOW()
    WHERE id = ${id}
  `;
}

export async function deletePlace(idValue: unknown) {
  const id = cleanId(idValue);
  await ensureTable();
  await db()`DELETE FROM map_places WHERE id = ${id}`;
}

type NominatimRow = {
  lat?: string;
  lon?: string;
  name?: string;
  display_name?: string;
  address?: Record<string, string | undefined>;
};

/** Free-text place search for the owner's "add a place" box. */
export async function searchPlaceMatches(queryValue: unknown): Promise<PlaceMatch[]> {
  const query = cleanLine(queryValue, 120);
  if (query.length < 2) return [];
  const params = new URLSearchParams({
    q: query,
    format: "jsonv2",
    limit: "6",
    addressdetails: "1",
  });
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: {
      Accept: "application/json",
      "Accept-Language": "en",
      "User-Agent": "Clemi-Places/1.0 (https://clemissima.com)",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error("The place search is unavailable.");
  const rows = (await response.json()) as NominatimRow[];
  const matches: PlaceMatch[] = [];
  for (const row of rows) {
    const lat = Number(row.lat);
    const lng = Number(row.lon);
    const parts = String(row.display_name ?? "")
      .split(",")
      .map((part) => part.trim())
      .filter((part) => part && !/^\d[\d\s-]*$/.test(part));
    const name = cleanLine(row.name || parts[0], PLACE_NAME_MAX);
    if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const country = cleanLine(row.address?.country ?? parts.at(-1) ?? "", PLACE_COUNTRY_MAX);
    const context = parts.filter((part) => part !== name).slice(-3).join(", ");
    if (matches.some((match) => match.name === name && match.context === context)) continue;
    matches.push({ name, context, country, lat, lng });
  }
  return matches;
}
