import { createHash, randomBytes, randomUUID } from "crypto";
import { neon } from "@neondatabase/serverless";

export type PlaceStatus = "draft" | "approved" | "rejected";
export type PlaceConfidence = "high" | "ambiguous";
export type EvidenceCategory = "flight" | "flight and reservation" | "owner-added";

export type CurrentLocation = {
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  updatedAt: string;
  expiresAt: string;
};

export type TravelPlace = {
  id: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  firstYear: number;
  lastYear: number;
  status: PlaceStatus;
  confidence: PlaceConfidence;
  evidenceCategory: EvidenceCategory;
};

export type TrackerToken = {
  id: string;
  label: string;
  status: "active" | "revoked";
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

type GeocodedCity = {
  city: string;
  country: string;
  latitude: number;
  longitude: number;
};

const TOKEN_RATE_LIMIT = 12;
const TOKEN_RATE_WINDOW_MINUTES = 60;
const CLEMI_LOCATION_ENDPOINT =
  "https://sam-get-location.nisala.workers.dev/";
const CLEMI_LOCATION_KEY = "clem_loc";

function databaseUrl() {
  return process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? "";
}

function db() {
  const url = databaseUrl();
  if (!url) throw new Error("Database is not configured.");
  return neon(url);
}

function cleanLine(value: unknown, max: number) {
  return String(value ?? "")
    .replace(/\0/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function cleanId(value: unknown) {
  const id = cleanLine(value, 100);
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(id)) throw new Error("Invalid record.");
  return id;
}

function numberInRange(value: unknown, min: number, max: number) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    throw new Error("Invalid value.");
  }
  return number;
}

function iso(value: string | Date) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function tokenHash(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export async function ensureTrackerTables() {
  const sql = db();
  await sql`
    CREATE TABLE IF NOT EXISTS clemi_current_location (
      id SMALLINT PRIMARY KEY CHECK (id = 1),
      city TEXT NOT NULL,
      country TEXT NOT NULL,
      latitude DOUBLE PRECISION NOT NULL,
      longitude DOUBLE PRECISION NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS clemi_places (
      id TEXT PRIMARY KEY,
      city TEXT NOT NULL,
      country TEXT NOT NULL,
      latitude DOUBLE PRECISION NOT NULL,
      longitude DOUBLE PRECISION NOT NULL,
      first_year INTEGER NOT NULL,
      last_year INTEGER NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('draft', 'approved', 'rejected')),
      confidence TEXT NOT NULL DEFAULT 'high',
      evidence_category TEXT NOT NULL DEFAULT 'owner-added',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (city, country)
    )
  `;
  await sql`
    ALTER TABLE clemi_places
    ADD COLUMN IF NOT EXISTS confidence TEXT DEFAULT 'high'
  `;
  await sql`
    ALTER TABLE clemi_places
    ADD COLUMN IF NOT EXISTS evidence_category TEXT DEFAULT 'owner-added'
  `;
  await sql`
    UPDATE clemi_places
    SET confidence = COALESCE(NULLIF(confidence, ''), 'high'),
        evidence_category = COALESCE(NULLIF(evidence_category, ''), 'owner-added')
    WHERE confidence IS NULL OR confidence = ''
       OR evidence_category IS NULL OR evidence_category = ''
  `;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS clemi_places_city_country_key
    ON clemi_places (city, country)
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS clemi_tracker_tokens (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'revoked')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_used_at TIMESTAMPTZ,
      revoked_at TIMESTAMPTZ,
      rate_window_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      rate_count INTEGER NOT NULL DEFAULT 0
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS clemi_tracker_migrations (
      migration_key TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    WITH marker AS (
      INSERT INTO clemi_tracker_migrations (migration_key)
      VALUES ('travel-seeds-v1')
      ON CONFLICT (migration_key) DO NOTHING
      RETURNING migration_key
    ),
    seeds (
      id, city, country, latitude, longitude, first_year, last_year,
      status, confidence, evidence_category
    ) AS (
      VALUES
        ('seed-los-angeles', 'Los Angeles', 'United States', 34.05369, -118.24277, 2025, 2026, 'draft', 'high', 'flight'),
        ('seed-burbank', 'Burbank', 'United States', 34.18165, -118.32585, 2025, 2026, 'draft', 'high', 'flight'),
        ('seed-seoul', 'Seoul', 'South Korea', 37.56668, 126.97829, 2026, 2026, 'draft', 'high', 'flight'),
        ('seed-hong-kong', 'Hong Kong', 'Hong Kong', 22.27933, 114.16281, 2026, 2026, 'draft', 'high', 'flight'),
        ('seed-xiamen', 'Xiamen', 'China', 24.48011, 118.08535, 2026, 2026, 'draft', 'high', 'flight'),
        ('seed-sanya', 'Sanya', 'China', 18.25347, 109.50344, 2026, 2026, 'draft', 'high', 'flight'),
        ('seed-boston', 'Boston', 'United States', 42.35543, -71.06051, 2024, 2026, 'draft', 'high', 'flight and reservation'),
        ('seed-portland-maine', 'Portland', 'United States', 43.65776, -70.25887, 2024, 2026, 'draft', 'high', 'flight'),
        ('seed-copenhagen', 'Copenhagen', 'Denmark', 55.68672, 12.57007, 2026, 2026, 'draft', 'ambiguous', 'flight'),
        ('seed-chicago', 'Chicago', 'United States', 41.87556, -87.62442, 2026, 2026, 'draft', 'ambiguous', 'flight')
    )
    INSERT INTO clemi_places (
      id, city, country, latitude, longitude, first_year, last_year,
      status, confidence, evidence_category
    )
    SELECT seeds.*
    FROM seeds, marker
    ON CONFLICT DO NOTHING
  `;
}

function mapCurrent(row: Record<string, unknown>): CurrentLocation {
  return {
    city: String(row.city),
    country: String(row.country),
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    updatedAt: iso(row.updated_at as string | Date),
    expiresAt: iso(row.expires_at as string | Date),
  };
}

function mapPlace(row: Record<string, unknown>): TravelPlace {
  return {
    id: String(row.id),
    city: String(row.city),
    country: String(row.country),
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    firstYear: Number(row.first_year),
    lastYear: Number(row.last_year),
    status:
      row.status === "approved" || row.status === "rejected"
        ? row.status
        : "draft",
    confidence: row.confidence === "ambiguous" ? "ambiguous" : "high",
    evidenceCategory:
      row.evidence_category === "flight" ||
      row.evidence_category === "flight and reservation"
        ? row.evidence_category
        : "owner-added",
  };
}

function mapToken(row: Record<string, unknown>): TrackerToken {
  return {
    id: String(row.id),
    label: String(row.label),
    status: row.status === "revoked" ? "revoked" : "active",
    createdAt: iso(row.created_at as string | Date),
    lastUsedAt: row.last_used_at
      ? iso(row.last_used_at as string | Date)
      : null,
    revokedAt: row.revoked_at ? iso(row.revoked_at as string | Date) : null,
  };
}

export async function getPublicTrackerData() {
  try {
    await ensureTrackerTables();
    const sql = db();
    const [remoteCurrent, current, places] = await Promise.all([
      getRemoteCurrentLocation(),
      sql`
        SELECT city, country, latitude, longitude, updated_at, expires_at
        FROM clemi_current_location
        WHERE id = 1 AND expires_at > NOW()
      `,
      sql`
        SELECT id, city, country, latitude, longitude, first_year, last_year,
               status, confidence, evidence_category
        FROM clemi_places
        WHERE status = 'approved'
        ORDER BY first_year DESC, city ASC
      `,
    ]);
    return {
      current: remoteCurrent ?? (current[0] ? mapCurrent(current[0]) : null),
      places: places.map(mapPlace),
    };
  } catch {
    return { current: null, places: [] };
  }
}

async function getRemoteCurrentLocation(): Promise<CurrentLocation | null> {
  const password = process.env.CLEMI_LOCATION_READ_PASSWORD?.trim();
  if (!password) return null;

  try {
    const query = new URLSearchParams({
      ppassword: password,
      key: CLEMI_LOCATION_KEY,
    });
    const response = await fetch(`${CLEMI_LOCATION_ENDPOINT}?${query}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return null;

    const raw = await response.text();
    const latitude = Number(raw.match(/Latitude:\s*(-?\d+(?:\.\d+)?)/i)?.[1]);
    const longitude = Number(
      raw.match(/Longitude:\s*(-?\d+(?:\.\d+)?)/i)?.[1],
    );
    if (
      !Number.isFinite(latitude) ||
      latitude < -90 ||
      latitude > 90 ||
      !Number.isFinite(longitude) ||
      longitude < -180 ||
      longitude > 180
    ) {
      return null;
    }

    const addressLines = raw
      .replace(/<\/?br\s*\/?>/gi, "\n")
      .split(/\r?\n/)
      .map((line) => cleanLine(line, 120))
      .filter(Boolean);
    const city = (addressLines[1] ?? "Unknown")
      .replace(/,\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?$/i, "")
      .replace(/\s+[A-Z]{2}\s+\d{5}(?:-\d{4})?$/i, "");
    const country = addressLines[2] ?? "Unknown";
    const updatedAt = new Date();

    return {
      city,
      country,
      // Keep the public marker at city-level precision.
      latitude: Math.round(latitude * 10) / 10,
      longitude: Math.round(longitude * 10) / 10,
      updatedAt: updatedAt.toISOString(),
      expiresAt: new Date(updatedAt.getTime() + 3 * 60 * 60 * 1000).toISOString(),
    };
  } catch {
    return null;
  }
}

export async function getTrackerAdminData() {
  await ensureTrackerTables();
  const sql = db();
  const [current, places, tokens] = await Promise.all([
    sql`
      SELECT city, country, latitude, longitude, updated_at, expires_at
      FROM clemi_current_location
      WHERE id = 1 AND expires_at > NOW()
    `,
    sql`
      SELECT id, city, country, latitude, longitude, first_year, last_year,
             status, confidence, evidence_category
      FROM clemi_places
      ORDER BY
        CASE status WHEN 'draft' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
        first_year DESC,
        city ASC
    `,
    sql`
      SELECT id, label, status, created_at, last_used_at, revoked_at
      FROM clemi_tracker_tokens
      ORDER BY created_at DESC
    `,
  ]);
  return {
    current: current[0] ? mapCurrent(current[0]) : null,
    places: places.map(mapPlace),
    tokens: tokens.map(mapToken),
  };
}

async function nominatim(
  path: "reverse" | "search",
  params: URLSearchParams,
): Promise<unknown> {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/${path}?${params}`,
    {
      headers: {
        Accept: "application/json",
        "Accept-Language": "en",
        "User-Agent": "Clemi-Tracker/2.0 (https://clemissima.com/privacy)",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    },
  );
  if (!response.ok) throw new Error("Location service is unavailable.");
  return response.json();
}

async function cityCentroid(cityValue: string, countryValue: string) {
  const city = cleanLine(cityValue, 80);
  const country = cleanLine(countryValue, 80);
  if (city.length < 2 || country.length < 2) {
    throw new Error("Could not identify a city.");
  }
  const params = new URLSearchParams({
    format: "jsonv2",
    city,
    country,
    limit: "1",
    addressdetails: "1",
  });
  const rows = (await nominatim("search", params)) as Array<{
    lat?: string;
    lon?: string;
    address?: Record<string, string | undefined>;
  }>;
  const row = rows[0];
  if (!row?.lat || !row.lon) throw new Error("Could not find that city.");
  const latitude = Number(row.lat);
  const longitude = Number(row.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error("Could not find that city.");
  }
  return {
    city: cleanLine(
      row.address?.city ??
        row.address?.town ??
        row.address?.village ??
        row.address?.municipality ??
        city,
      80,
    ),
    country: cleanLine(row.address?.country ?? country, 80),
    latitude,
    longitude,
  } satisfies GeocodedCity;
}

export async function geocodeShortcutCoordinates(
  latitudeValue: unknown,
  longitudeValue: unknown,
) {
  const latitude = numberInRange(latitudeValue, -90, 90);
  const longitude = numberInRange(longitudeValue, -180, 180);
  const params = new URLSearchParams({
    format: "jsonv2",
    lat: String(latitude),
    lon: String(longitude),
    zoom: "10",
    addressdetails: "1",
  });
  const result = (await nominatim("reverse", params)) as {
    address?: Record<string, string | undefined>;
  };
  const address = result.address ?? {};
  const city =
    address.city ??
    address.town ??
    address.village ??
    address.municipality ??
    address.county;
  const country = address.country;
  if (!city || !country) throw new Error("Could not identify a city.");
  return cityCentroid(city, country);
}

export async function storeCurrentLocation(location: GeocodedCity) {
  await ensureTrackerTables();
  await db()`
    INSERT INTO clemi_current_location (
      id, city, country, latitude, longitude, updated_at, expires_at
    )
    VALUES (
      1, ${location.city}, ${location.country}, ${location.latitude},
      ${location.longitude}, NOW(), NOW() + INTERVAL '3 hours'
    )
    ON CONFLICT (id) DO UPDATE SET
      city = EXCLUDED.city,
      country = EXCLUDED.country,
      latitude = EXCLUDED.latitude,
      longitude = EXCLUDED.longitude,
      updated_at = NOW(),
      expires_at = NOW() + INTERVAL '3 hours'
  `;
}

export async function authorizeTrackerToken(tokenValue: string) {
  const token = cleanLine(tokenValue, 200);
  if (!/^radar_[A-Za-z0-9_-]{40,}$/.test(token)) return "invalid" as const;
  await ensureTrackerTables();
  const rows = await db()`
    WITH candidate AS (
      SELECT id
      FROM clemi_tracker_tokens
      WHERE token_hash = ${tokenHash(token)} AND status = 'active'
    ),
    accepted AS (
      UPDATE clemi_tracker_tokens AS token
      SET rate_window_started_at =
            CASE
              WHEN token.rate_window_started_at <=
                   NOW() - (${TOKEN_RATE_WINDOW_MINUTES} * INTERVAL '1 minute')
              THEN NOW()
              ELSE token.rate_window_started_at
            END,
          rate_count =
            CASE
              WHEN token.rate_window_started_at <=
                   NOW() - (${TOKEN_RATE_WINDOW_MINUTES} * INTERVAL '1 minute')
              THEN 1
              ELSE token.rate_count + 1
            END,
          last_used_at = NOW()
      FROM candidate
      WHERE token.id = candidate.id
        AND (
          token.rate_window_started_at <=
            NOW() - (${TOKEN_RATE_WINDOW_MINUTES} * INTERVAL '1 minute')
          OR token.rate_count < ${TOKEN_RATE_LIMIT}
        )
      RETURNING token.id
    )
    SELECT CASE
      WHEN EXISTS (SELECT 1 FROM accepted) THEN 'ok'
      WHEN EXISTS (SELECT 1 FROM candidate) THEN 'rate-limited'
      ELSE 'invalid'
    END AS result
  `;
  const result = rows[0]?.result;
  return result === "ok"
    ? ("ok" as const)
    : result === "rate-limited"
      ? ("rate-limited" as const)
      : ("invalid" as const);
}

export async function createTrackerToken(labelValue: unknown) {
  await ensureTrackerTables();
  const label = cleanLine(labelValue, 80) || "iPhone Shortcut";
  const plaintext = `radar_${randomBytes(32).toString("base64url")}`;
  await db()`
    INSERT INTO clemi_tracker_tokens (
      id, label, token_hash
    )
    VALUES (
      ${randomUUID()}, ${label}, ${tokenHash(plaintext)}
    )
  `;
  return { plaintext };
}

export async function revokeTrackerToken(idValue: unknown) {
  await ensureTrackerTables();
  await db()`
    UPDATE clemi_tracker_tokens
    SET status = 'revoked', revoked_at = NOW()
    WHERE id = ${cleanId(idValue)} AND status = 'active'
  `;
}

export async function clearCurrentLocation() {
  await ensureTrackerTables();
  await db()`DELETE FROM clemi_current_location WHERE id = 1`;
}

export async function goDark() {
  await ensureTrackerTables();
  await db()`
    WITH cleared AS (
      DELETE FROM clemi_current_location WHERE id = 1 RETURNING id
    )
    UPDATE clemi_tracker_tokens
    SET status = 'revoked', revoked_at = NOW()
    WHERE status = 'active'
  `;
}

export async function saveTravelPlace(input: {
  id?: unknown;
  city: unknown;
  country: unknown;
  firstYear: unknown;
  lastYear: unknown;
  confidence: unknown;
  evidenceCategory: unknown;
}) {
  await ensureTrackerTables();
  const existingId = input.id ? cleanId(input.id) : null;
  const id = existingId ?? randomUUID();
  const requestedCity = cleanLine(input.city, 80);
  const requestedCountry = cleanLine(input.country, 80);
  const firstYear = Math.trunc(numberInRange(input.firstYear, 1900, 2100));
  const lastYear = Math.trunc(
    numberInRange(input.lastYear, firstYear, 2100),
  );
  const confidence: PlaceConfidence =
    input.confidence === "ambiguous" ? "ambiguous" : "high";
  const evidenceCategory: EvidenceCategory =
    input.evidenceCategory === "flight" ||
    input.evidenceCategory === "flight and reservation"
      ? input.evidenceCategory
      : "owner-added";
  const geocoded = await cityCentroid(requestedCity, requestedCountry);
  const sql = db();

  if (!existingId) {
    await sql`
      INSERT INTO clemi_places (
        id, city, country, latitude, longitude, first_year, last_year,
        status, confidence, evidence_category
      )
      VALUES (
        ${id}, ${geocoded.city}, ${geocoded.country},
        ${geocoded.latitude}, ${geocoded.longitude},
        ${firstYear}, ${lastYear}, 'draft', ${confidence}, ${evidenceCategory}
      )
    `;
    return;
  }

  await sql`
    UPDATE clemi_places
    SET city = ${geocoded.city},
        country = ${geocoded.country},
        latitude = ${geocoded.latitude},
        longitude = ${geocoded.longitude},
        first_year = ${firstYear},
        last_year = ${lastYear},
        confidence = ${confidence},
        evidence_category = ${evidenceCategory},
        updated_at = NOW()
    WHERE id = ${id}
  `;
}

export async function setTravelPlaceStatus(idValue: unknown, status: unknown) {
  const id = cleanId(idValue);
  if (status !== "draft" && status !== "approved" && status !== "rejected") {
    throw new Error("Invalid place status.");
  }
  await ensureTrackerTables();
  await db()`
    UPDATE clemi_places
    SET status = ${status}, updated_at = NOW()
    WHERE id = ${id}
  `;
}

export async function deleteTravelPlace(idValue: unknown) {
  await ensureTrackerTables();
  await db()`DELETE FROM clemi_places WHERE id = ${cleanId(idValue)}`;
}
