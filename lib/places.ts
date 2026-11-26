import "server-only";

import { randomUUID } from "crypto";
import { neon } from "@neondatabase/serverless";
import {
  PLACE_BATCH_MAX,
  PLACE_COUNTRY_MAX,
  PLACE_KINDS,
  PLACE_NAME_MAX,
  PLACE_REASON_MAX,
  PLACE_TRIPS_MAX,
  PLACE_YEAR_MAX,
  PLACE_YEAR_MIN,
  REGION_ID,
  REGION_MAX,
  SEASONS,
  SEED_PLACES,
  sortTrips,
  type Place,
  type PlaceKind,
  type PlaceMatch,
  type Season,
  type Trip,
} from "@/lib/place-types";

// The public world map at /places. Unrelated to the control room's private
// clemi_places (lib/tracker.ts).

function db() {
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? "";
  if (!url) throw new Error("Database is not configured.");
  return neon(url);
}

// How close two spots must be to count as the same place when seeds are
// planted: about two miles, the same as the map uses, and less than the gap
// between Boston and Cambridge.
const SAME_SPOT = 0.03;

let ready: Promise<void> | null = null;

function ensureTable() {
  ready ??= (async () => {
    const sql = db();
    // month and year are from before a place could hold several trips. They
    // are no longer written; what they held is carried into map_place_trips
    // below, and the columns stay so that nothing already stored is touched.
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
    await Promise.all([
      // The ledger of everything already planted: seed places, seed trips, and
      // the trips carried over from the old month and year. A row here
      // outlives what it stands for, so whatever she deletes is never planted
      // again.
      sql`
        CREATE TABLE IF NOT EXISTS map_place_seeds (
          id TEXT PRIMARY KEY,
          seeded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `,
      // States and countries she has checked off without naming a town in them.
      // A row means "been there"; unchecking deletes it.
      sql`
        CREATE TABLE IF NOT EXISTS map_regions (
          id TEXT PRIMARY KEY,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `,
      // A place has any number of trips, and they go when the place goes.
      sql`
        CREATE TABLE IF NOT EXISTS map_place_trips (
          id TEXT PRIMARY KEY,
          place_id TEXT NOT NULL REFERENCES map_places (id) ON DELETE CASCADE,
          season TEXT,
          late BOOLEAN NOT NULL DEFAULT FALSE,
          year SMALLINT NOT NULL,
          reason TEXT NOT NULL DEFAULT '',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `,
    ]);
    // A seed added in a later version may be somewhere she has already put on
    // the map herself: it is entered in the ledger all the same, and the place
    // is planted only if nothing of hers already sits on that spot.
    const seeds = SEED_PLACES.map(({ trips: _trips, note: _note, ...place }, index) => ({
      ...place,
      rank: index,
    }));
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
      WHERE NOT EXISTS (
        SELECT 1
        FROM map_places AS already
        WHERE ABS(already.lat - seeds.lat) < ${SAME_SPOT}
          AND ABS(already.lng - seeds.lng) < ${SAME_SPOT}
      )
      ON CONFLICT (id) DO NOTHING
    `;
    // What a place held before it could hold several trips. A year becomes a
    // trip, once: the month gives the season and the reason goes with it. A
    // reason with no year stays where it is, as the place's own note.
    await sql`
      WITH old AS (
        SELECT id, month, year, reason
        FROM map_places
        WHERE year IS NOT NULL
      ),
      carried AS (
        INSERT INTO map_place_seeds (id)
        SELECT 'first-trip-' || id FROM old
        ON CONFLICT (id) DO NOTHING
        RETURNING id
      )
      INSERT INTO map_place_trips (id, place_id, season, late, year, reason)
      SELECT
        'first-trip-' || old.id,
        old.id,
        CASE
          WHEN old.month IN (12, 1, 2) THEN 'winter'
          WHEN old.month BETWEEN 3 AND 5 THEN 'spring'
          WHEN old.month BETWEEN 6 AND 8 THEN 'summer'
          WHEN old.month BETWEEN 9 AND 11 THEN 'fall'
        END,
        COALESCE(old.month = 12, FALSE),
        old.year,
        old.reason
      FROM old
      JOIN carried ON carried.id = 'first-trip-' || old.id
      ON CONFLICT (id) DO NOTHING
    `;
    // Seed trips go to the seed place, or to the place of hers that stood in
    // for it. A trip that is already there, by season and year, is not added
    // a second time; a place she took off the map gets none.
    const trips = SEED_PLACES.flatMap((place) =>
      place.trips.map((trip) => ({
        id: trip.id,
        place_id: place.id,
        lat: place.lat,
        lng: place.lng,
        season: trip.season,
        late: trip.late,
        year: trip.year,
      })),
    ).map((trip, rank) => ({ ...trip, rank }));
    await sql`
      WITH seeds AS (
        SELECT *
        FROM jsonb_to_recordset(${JSON.stringify(trips)}::jsonb) AS seed(
          id TEXT,
          place_id TEXT,
          lat DOUBLE PRECISION,
          lng DOUBLE PRECISION,
          season TEXT,
          late BOOLEAN,
          year SMALLINT,
          rank INTEGER
        )
      ),
      planted AS (
        INSERT INTO map_place_seeds (id)
        SELECT id FROM seeds
        ON CONFLICT (id) DO NOTHING
        RETURNING id
      ),
      homes AS (
        SELECT
          seeds.*,
          COALESCE(
            (SELECT place.id FROM map_places AS place WHERE place.id = seeds.place_id),
            (
              SELECT place.id
              FROM map_places AS place
              WHERE ABS(place.lat - seeds.lat) < ${SAME_SPOT}
                AND ABS(place.lng - seeds.lng) < ${SAME_SPOT}
              ORDER BY ABS(place.lat - seeds.lat) + ABS(place.lng - seeds.lng), place.created_at, place.id
              LIMIT 1
            )
          ) AS home
        FROM seeds
        JOIN planted ON planted.id = seeds.id
      )
      INSERT INTO map_place_trips (id, place_id, season, late, year, created_at)
      SELECT
        homes.id,
        homes.home,
        homes.season,
        homes.late,
        homes.year,
        NOW() + homes.rank * INTERVAL '1 millisecond'
      FROM homes
      WHERE homes.home IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM map_place_trips AS already
          WHERE already.place_id = homes.home
            AND already.year = homes.year
            AND already.season IS NOT DISTINCT FROM homes.season
        )
      ON CONFLICT (id) DO NOTHING
    `;
  })().catch((error) => {
    ready = null;
    throw error;
  });
  return ready;
}

function mapTrip(row: Record<string, unknown>): Trip {
  const season = String(row.season ?? "");
  return {
    id: String(row.id),
    season: SEASONS.includes(season as Season) ? (season as Season) : null,
    late: season === "winter" && row.late === true,
    year: Number(row.year),
    reason: String(row.reason ?? ""),
  };
}

function mapPlace(row: Record<string, unknown>): Place {
  const kind = String(row.kind);
  const trips = typeof row.trips === "string" ? JSON.parse(row.trips) : row.trips;
  return {
    id: String(row.id),
    name: String(row.name),
    country: String(row.country ?? ""),
    lat: Number(row.lat),
    lng: Number(row.lng),
    kind: PLACE_KINDS.includes(kind as PlaceKind) ? (kind as PlaceKind) : "visited",
    note: String(row.note ?? ""),
    trips: sortTrips(Array.isArray(trips) ? trips.map(mapTrip) : []),
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

const TRIP_ID = /^[A-Za-z0-9_-]{1,140}$/;

type CleanTrip = Trip & { rank: number };

/** Trips as they will be stored. Two in the same season of the same year are one. */
function cleanTrips(value: unknown): CleanTrip[] {
  if (value === null || value === undefined) return [];
  if (!Array.isArray(value)) throw new Error("Those trips did not come through.");
  if (value.length > PLACE_TRIPS_MAX) {
    throw new Error(`A place holds up to ${PLACE_TRIPS_MAX} trips.`);
  }
  const trips: CleanTrip[] = [];
  for (const entry of value) {
    const input = (entry && typeof entry === "object" ? entry : {}) as Record<string, unknown>;
    const year = cleanWhole(input.year, PLACE_YEAR_MIN, PLACE_YEAR_MAX, "That year looks wrong.");
    if (year === null) throw new Error("A trip needs a year.");
    const given = input.season === null || input.season === undefined ? "" : String(input.season);
    if (given && !SEASONS.includes(given as Season)) throw new Error("That season does not exist.");
    const season = given ? (given as Season) : null;
    const reason = cleanLine(input.reason, PLACE_REASON_MAX);
    const same = trips.find((trip) => trip.year === year && trip.season === season);
    if (same) {
      same.reason ||= reason;
      continue;
    }
    // An id is kept only for a trip already on the map, and only once.
    const known =
      typeof input.id === "string" && TRIP_ID.test(input.id) && !trips.some((trip) => trip.id === input.id);
    const id = known ? String(input.id) : randomUUID();
    trips.push({
      id,
      season,
      late: season === "winter" && input.late === true,
      year,
      reason,
      rank: trips.length,
    });
  }
  return trips;
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
    note: cleanLine(input.note, PLACE_REASON_MAX),
    trips: cleanTrips(input.trips),
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
  // A reason left beside an old year went with that year into a trip; only a
  // reason that stands alone is the place's note.
  const rows = (await db()`
    SELECT
      place.id,
      place.name,
      place.country,
      place.lat,
      place.lng,
      place.kind,
      CASE WHEN place.year IS NULL THEN place.reason ELSE '' END AS note,
      COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'id', trip.id,
              'season', trip.season,
              'late', trip.late,
              'year', trip.year,
              'reason', trip.reason
            )
            ORDER BY trip.created_at, trip.id
          )
          FROM map_place_trips AS trip
          WHERE trip.place_id = place.id
        ),
        '[]'::jsonb
      ) AS trips
    FROM map_places AS place
    ORDER BY place.created_at, place.id
  `) as Array<Record<string, unknown>>;
  return rows.map(mapPlace);
}

export async function getRegions() {
  await ensureTable();
  const rows = (await db()`SELECT id FROM map_regions ORDER BY id`) as Array<{ id: string }>;
  return rows.map((row) => String(row.id));
}

/** The seeds stand in when the database is missing, so the page still opens. */
export async function loadPlaces(): Promise<{ places: Place[]; regions: string[]; live: boolean }> {
  try {
    const [places, regions] = await Promise.all([getPlaces(), getRegions()]);
    return { places, regions, live: true };
  } catch {
    return { places: SEED_PLACES, regions: [], live: false };
  }
}

function cleanRegion(value: unknown) {
  const id = String(value ?? "").trim();
  if (!REGION_ID.test(id)) throw new Error("That is not a state or a country on the map.");
  return id;
}

/** Checks a state or a country off, or takes the check away. Safe to repeat. */
export async function setRegionVisited(idValue: unknown, visited: unknown) {
  const id = cleanRegion(idValue);
  await ensureTable();
  if (visited === true) {
    await db()`
      INSERT INTO map_regions (id)
      SELECT ${id}
      WHERE (SELECT COUNT(*) FROM map_regions) < ${REGION_MAX}
      ON CONFLICT (id) DO NOTHING
    `;
  } else {
    await db()`DELETE FROM map_regions WHERE id = ${id}`;
  }
}

// There is one hometown and one "now". Naming a new one turns the old one into
// somewhere she has lived, in the same statement as the write.

export async function createPlace(input: Record<string, unknown>) {
  const details = cleanDetails(input);
  const { lat, lng } = cleanCoordinates(input);
  const id = randomUUID();
  await ensureTable();
  await db()`
    WITH demoted AS (
      UPDATE map_places
      SET kind = 'lived', updated_at = NOW()
      WHERE kind = ${details.kind} AND kind IN ('hometown', 'current')
    ),
    place AS (
      INSERT INTO map_places (id, name, country, lat, lng, kind, reason)
      VALUES (
        ${id}, ${details.name}, ${details.country}, ${lat}, ${lng},
        ${details.kind}, ${details.note}
      )
      RETURNING id
    )
    INSERT INTO map_place_trips (id, place_id, season, late, year, reason, created_at)
    SELECT
      trip.id, place.id, trip.season, trip.late, trip.year, trip.reason,
      NOW() + trip.rank * INTERVAL '1 millisecond'
    FROM jsonb_to_recordset(${JSON.stringify(details.trips)}::jsonb) AS trip(
      id TEXT,
      season TEXT,
      late BOOLEAN,
      year SMALLINT,
      reason TEXT,
      rank INTEGER
    )
    CROSS JOIN place
  `;
  return id;
}

/** A whole list at once, all of them places she has been. One statement: all or none. */
export async function createPlaces(inputs: unknown) {
  if (!Array.isArray(inputs) || !inputs.length) throw new Error("There is nothing to add.");
  if (inputs.length > PLACE_BATCH_MAX) {
    throw new Error(`Add up to ${PLACE_BATCH_MAX} places at a time.`);
  }
  const rows = inputs.map((value: unknown, rank) => {
    const input = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
    const details = cleanDetails({ ...input, kind: "visited" });
    return { id: randomUUID(), ...details, ...cleanCoordinates(input), rank };
  });
  const trips = rows.flatMap((row) => row.trips.map((trip) => ({ ...trip, place_id: row.id })));
  await ensureTable();
  await db()`
    WITH placed AS (
      INSERT INTO map_places (id, name, country, lat, lng, kind, reason, created_at)
      SELECT
        entry.id, entry.name, entry.country, entry.lat, entry.lng, 'visited', entry.note,
        NOW() + entry.rank * INTERVAL '1 millisecond'
      FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) AS entry(
        id TEXT,
        name TEXT,
        country TEXT,
        lat DOUBLE PRECISION,
        lng DOUBLE PRECISION,
        note TEXT,
        rank INTEGER
      )
      RETURNING id
    )
    INSERT INTO map_place_trips (id, place_id, season, late, year, reason, created_at)
    SELECT
      trip.id, placed.id, trip.season, trip.late, trip.year, trip.reason,
      NOW() + trip.rank * INTERVAL '1 millisecond'
    FROM jsonb_to_recordset(${JSON.stringify(trips)}::jsonb) AS trip(
      id TEXT,
      place_id TEXT,
      season TEXT,
      late BOOLEAN,
      year SMALLINT,
      reason TEXT,
      rank INTEGER
    )
    JOIN placed ON placed.id = trip.place_id
  `;
  return rows.map((row) => row.id);
}

/**
 * The place and its trips as she left them: trips no longer listed are
 * removed, the rest are changed or added. One statement: all or none.
 */
export async function updatePlace(idValue: unknown, input: Record<string, unknown>) {
  const id = cleanId(idValue);
  const details = cleanDetails(input);
  await ensureTable();
  await db()`
    WITH demoted AS (
      UPDATE map_places
      SET kind = 'lived', updated_at = NOW()
      WHERE kind = ${details.kind} AND kind IN ('hometown', 'current') AND id <> ${id}
    ),
    place AS (
      UPDATE map_places
      SET name = ${details.name},
          country = ${details.country},
          kind = ${details.kind},
          month = NULL,
          year = NULL,
          reason = ${details.note},
          updated_at = NOW()
      WHERE id = ${id}
      RETURNING id
    ),
    incoming AS (
      SELECT *
      FROM jsonb_to_recordset(${JSON.stringify(details.trips)}::jsonb) AS trip(
        id TEXT,
        season TEXT,
        late BOOLEAN,
        year SMALLINT,
        reason TEXT,
        rank INTEGER
      )
    ),
    removed AS (
      DELETE FROM map_place_trips
      WHERE place_id = ${id} AND id NOT IN (SELECT id FROM incoming)
    )
    INSERT INTO map_place_trips (id, place_id, season, late, year, reason, created_at)
    SELECT
      incoming.id, place.id, incoming.season, incoming.late, incoming.year, incoming.reason,
      NOW() + incoming.rank * INTERVAL '1 millisecond'
    FROM incoming
    CROSS JOIN place
    ON CONFLICT (id) DO UPDATE
    SET season = EXCLUDED.season,
        late = EXCLUDED.late,
        year = EXCLUDED.year,
        reason = EXCLUDED.reason,
        updated_at = NOW()
    WHERE map_place_trips.place_id = EXCLUDED.place_id
  `;
}

export async function deletePlace(idValue: unknown) {
  const id = cleanId(idValue);
  await ensureTable();
  // Its trips go with it (ON DELETE CASCADE).
  await db()`DELETE FROM map_places WHERE id = ${id}`;
}

type NominatimRow = {
  lat?: string;
  lon?: string;
  name?: string;
  display_name?: string;
  importance?: number | string;
  address?: Record<string, string | undefined>;
};

// OpenStreetMap's Nominatim asks for no more than one request a second. Every
// search waits its turn here, so a pasted list is looked up one name at a
// time however fast the names arrive.
const SEARCH_GAP_MS = 1100;
let searchLine: Promise<unknown> = Promise.resolve();
let lastSearch = 0;

function inTurn<T>(work: () => Promise<T>): Promise<T> {
  const turn = searchLine.then(async () => {
    const wait = lastSearch + SEARCH_GAP_MS - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    try {
      return await work();
    } finally {
      lastSearch = Date.now();
    }
  });
  searchLine = turn.catch(() => {});
  return turn;
}

/**
 * Free-text place search for the owner's "add a place" and "add many" boxes.
 * The best-known place comes first.
 */
export async function searchPlaceMatches(queryValue: unknown): Promise<PlaceMatch[]> {
  const query = cleanLine(queryValue, 120);
  if (query.length < 2) return [];
  const params = new URLSearchParams({
    q: query,
    format: "jsonv2",
    limit: "8",
    addressdetails: "1",
  });
  const response = await inTurn(() =>
    fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: {
        Accept: "application/json",
        "Accept-Language": "en",
        "User-Agent": "Clemi-Places/1.0 (https://clemissima.com)",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    }),
  );
  if (!response.ok) throw new Error("The place search is unavailable.");
  const rows = (await response.json()) as NominatimRow[];
  const matches: Array<PlaceMatch & { weight: number }> = [];
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
    const region = cleanLine(row.address?.state ?? row.address?.region ?? "", PLACE_COUNTRY_MAX);
    const short = [region, country].filter((part, at, all) => part && part !== name && all.indexOf(part) === at).join(", ");
    if (matches.some((match) => match.name === name && match.context === context)) continue;
    matches.push({ name, context, short, country, lat, lng, weight: Number(row.importance) || 0 });
  }
  return matches
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 6)
    .map(({ weight: _weight, ...match }) => match);
}
