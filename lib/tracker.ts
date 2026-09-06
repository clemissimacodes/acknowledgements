import { createHmac, randomUUID } from "crypto";
import { clerkClient } from "@clerk/nextjs/server";
import { neon } from "@neondatabase/serverless";

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
  status: "draft" | "approved" | "rejected";
};

type CalendarEvent = {
  status?: string;
  location?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
};

type GeocodedCity = {
  city: string;
  country: string;
  latitude: number;
  longitude: number;
};

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
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(id)) throw new Error("Invalid place.");
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

function locationHash(location: string) {
  const secret =
    process.env.CALENDAR_LOCATION_HASH_SECRET ??
    process.env.CLERK_SECRET_KEY ??
    "";
  if (!secret) throw new Error("Location hashing is not configured.");
  return createHmac("sha256", secret)
    .update(location.toLowerCase().trim())
    .digest("hex");
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
    ADD COLUMN IF NOT EXISTS evidence TEXT DEFAULT 'Google Calendar'
  `;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS clemi_places_city_country_key
    ON clemi_places (city, country)
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS clemi_calendar_settings (
      id SMALLINT PRIMARY KEY CHECK (id = 1),
      owner_user_id TEXT NOT NULL,
      last_synced_at TIMESTAMPTZ,
      sync_started_at TIMESTAMPTZ,
      last_sync_error TEXT
    )
  `;
  await sql`
    ALTER TABLE clemi_calendar_settings
    ADD COLUMN IF NOT EXISTS sync_started_at TIMESTAMPTZ
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS clemi_location_cache (
      location_hash TEXT PRIMARY KEY,
      city TEXT NOT NULL,
      country TEXT NOT NULL,
      latitude DOUBLE PRECISION NOT NULL,
      longitude DOUBLE PRECISION NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
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
  };
}

export async function getPublicTrackerData() {
  try {
    await ensureTrackerTables();
    const sql = db();
    const [current, places] = await Promise.all([
      sql`
        SELECT city, country, latitude, longitude, updated_at, expires_at
        FROM clemi_current_location
        WHERE id = 1 AND expires_at > NOW()
      `,
      sql`
        SELECT id, city, country, latitude, longitude, first_year, last_year, status
        FROM clemi_places
        WHERE status = 'approved'
        ORDER BY first_year DESC, city ASC
      `,
    ]);
    return {
      current: current[0] ? mapCurrent(current[0]) : null,
      places: places.map(mapPlace),
    };
  } catch {
    return { current: null, places: [] };
  }
}

export async function getTrackerAdminData() {
  await ensureTrackerTables();
  const sql = db();
  const [current, places, settings] = await Promise.all([
    sql`
      SELECT city, country, latitude, longitude, updated_at, expires_at
      FROM clemi_current_location
      WHERE id = 1 AND expires_at > NOW()
    `,
    sql`
      SELECT id, city, country, latitude, longitude, first_year, last_year, status
      FROM clemi_places
      ORDER BY
        CASE status WHEN 'draft' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
        first_year DESC,
        city ASC
    `,
    sql`
      SELECT owner_user_id, last_synced_at, last_sync_error
      FROM clemi_calendar_settings
      WHERE id = 1
    `,
  ]);
  return {
    current: current[0] ? mapCurrent(current[0]) : null,
    places: places.map(mapPlace),
    connected: Boolean(settings[0]?.owner_user_id),
    lastSyncedAt: settings[0]?.last_synced_at
      ? iso(settings[0].last_synced_at as string | Date)
      : null,
    lastSyncError: settings[0]?.last_sync_error
      ? String(settings[0].last_sync_error)
      : null,
  };
}

async function googleCalendarToken(userId: string) {
  const client = await clerkClient();
  const response = await client.users.getUserOauthAccessToken(userId, "google");
  return response.data[0]?.token ?? null;
}

async function calendarEvents(token: string) {
  const events: CalendarEvent[] = [];
  let pageToken = "";
  for (let page = 0; page < 5; page += 1) {
    const params = new URLSearchParams({
      maxResults: "2500",
      singleEvents: "true",
      orderBy: "startTime",
      timeMin: "2000-01-01T00:00:00.000Z",
      timeMax: new Date().toISOString(),
      fields: "items(status,location,start,end),nextPageToken",
      ...(pageToken ? { pageToken } : {}),
    });
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
        signal: AbortSignal.timeout(12_000),
      },
    );
    if (!response.ok) {
      throw new Error(
        response.status === 403
          ? "Reconnect Google with Calendar read access."
          : "Google Calendar could not be read.",
      );
    }
    const payload = (await response.json()) as {
      items?: CalendarEvent[];
      nextPageToken?: string;
    };
    events.push(...(payload.items ?? []));
    if (!payload.nextPageToken) break;
    pageToken = payload.nextPageToken;
  }
  return events;
}

function eventDate(value: CalendarEvent["start"]) {
  const date = value?.dateTime ?? value?.date;
  return date ? new Date(date) : null;
}

async function cachedCity(location: string) {
  const hash = locationHash(location);
  const rows = await db()`
    SELECT city, country, latitude, longitude
    FROM clemi_location_cache
    WHERE location_hash = ${hash}
  `;
  return rows[0]
    ? {
        city: String(rows[0].city),
        country: String(rows[0].country),
        latitude: Number(rows[0].latitude),
        longitude: Number(rows[0].longitude),
      }
    : null;
}

async function geocodeCalendarLocation(locationValue: string) {
  const location = cleanLine(locationValue, 300);
  const cached = await cachedCity(location);
  if (cached) return cached;

  const params = new URLSearchParams({
    format: "jsonv2",
    q: location,
    limit: "1",
    addressdetails: "1",
  });
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?${params}`,
    {
      headers: {
        Accept: "application/json",
        "Accept-Language": "en",
        "User-Agent": "Clemi-Tracker/1.0 (https://clemissima.com/privacy)",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(6_000),
    },
  );
  if (!response.ok) return null;
  const rows = (await response.json()) as Array<{
    lat?: string;
    lon?: string;
    address?: Record<string, string | undefined>;
  }>;
  const row = rows[0];
  const address = row?.address ?? {};
  const city =
    address.city ??
    address.town ??
    address.village ??
    address.municipality ??
    address.county;
  const country = address.country;
  if (!row?.lat || !row.lon || !city || !country) return null;
  const result = {
    city: cleanLine(city, 80),
    country: cleanLine(country, 80),
    latitude: Number(row.lat),
    longitude: Number(row.lon),
  };
  await db()`
    INSERT INTO clemi_location_cache (
      location_hash, city, country, latitude, longitude
    )
    VALUES (
      ${locationHash(location)}, ${result.city}, ${result.country},
      ${result.latitude}, ${result.longitude}
    )
    ON CONFLICT (location_hash) DO NOTHING
  `;
  return result;
}

async function upsertDraft(location: GeocodedCity, year: number) {
  await db()`
    INSERT INTO clemi_places (
      id, city, country, latitude, longitude, first_year, last_year, status
    )
    VALUES (
      ${randomUUID()}, ${location.city}, ${location.country},
      ${location.latitude}, ${location.longitude}, ${year}, ${year}, 'draft'
    )
    ON CONFLICT (city, country) DO UPDATE SET
      first_year = LEAST(clemi_places.first_year, EXCLUDED.first_year),
      last_year = GREATEST(clemi_places.last_year, EXCLUDED.last_year),
      updated_at = NOW()
  `;
}

async function storeCurrent(location: GeocodedCity | null) {
  const sql = db();
  if (!location) {
    await sql`DELETE FROM clemi_current_location WHERE id = 1`;
    return;
  }
  await sql`
    INSERT INTO clemi_current_location (
      id, city, country, latitude, longitude, updated_at, expires_at
    )
    VALUES (
      1, ${location.city}, ${location.country}, ${location.latitude},
      ${location.longitude}, NOW(), NOW() + INTERVAL '90 minutes'
    )
    ON CONFLICT (id) DO UPDATE SET
      city = EXCLUDED.city,
      country = EXCLUDED.country,
      latitude = EXCLUDED.latitude,
      longitude = EXCLUDED.longitude,
      updated_at = NOW(),
      expires_at = NOW() + INTERVAL '90 minutes'
  `;
}

export async function syncGoogleCalendar(userId: string) {
  await ensureTrackerTables();
  const sql = db();
  try {
    const token = await googleCalendarToken(userId);
    if (!token) throw new Error("Reconnect Google with Calendar read access.");
    const events = await calendarEvents(token);
    const now = Date.now();
    const located = events
      .filter((event) => event.status !== "cancelled" && event.location)
      .map((event) => ({
        location: cleanLine(event.location, 300),
        start: eventDate(event.start),
        end: eventDate(event.end),
      }))
      .filter(
        (
          event,
        ): event is { location: string; start: Date; end: Date | null } =>
          Boolean(event.location && event.start),
      );

    const active = located.find(
      ({ start, end }) =>
        start.getTime() <= now && (!end || end.getTime() >= now),
    );
    await storeCurrent(
      active ? await geocodeCalendarLocation(active.location) : null,
    );

    const unique = new Map<string, { location: string; year: number }>();
    for (const event of [...located].reverse()) {
      if (event.start.getTime() > now) continue;
      const hash = locationHash(event.location);
      if (!unique.has(hash)) {
        unique.set(hash, {
          location: event.location,
          year: event.start.getUTCFullYear(),
        });
      }
    }

    let processed = 0;
    let newGeocodes = 0;
    for (const candidate of unique.values()) {
      let location = await cachedCity(candidate.location);
      if (!location) {
        if (newGeocodes >= 5) continue;
        if (newGeocodes > 0 || active) {
          await new Promise((resolve) => setTimeout(resolve, 1_100));
        }
        location = await geocodeCalendarLocation(candidate.location);
        newGeocodes += 1;
      }
      if (!location) continue;
      await upsertDraft(location, candidate.year);
      processed += 1;
    }

    await sql`
      INSERT INTO clemi_calendar_settings (
        id, owner_user_id, last_synced_at, sync_started_at, last_sync_error
      )
      VALUES (1, ${userId}, NOW(), NULL, NULL)
      ON CONFLICT (id) DO UPDATE SET
        owner_user_id = EXCLUDED.owner_user_id,
        last_synced_at = NOW(),
        sync_started_at = NULL,
        last_sync_error = NULL
    `;
    return { ok: true as const, processed };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Calendar sync failed.";
    await sql`
      INSERT INTO clemi_calendar_settings (
        id, owner_user_id, last_synced_at, sync_started_at, last_sync_error
      )
      VALUES (1, ${userId}, NOW(), NULL, ${message})
      ON CONFLICT (id) DO UPDATE SET
        owner_user_id = EXCLUDED.owner_user_id,
        last_synced_at = NOW(),
        sync_started_at = NULL,
        last_sync_error = ${message}
    `;
    return { ok: false as const, error: message };
  }
}

export async function syncStoredCalendarOwner() {
  await ensureTrackerTables();
  const rows = await db()`
    SELECT owner_user_id
    FROM clemi_calendar_settings
    WHERE id = 1
  `;
  const userId = rows[0]?.owner_user_id
    ? String(rows[0].owner_user_id)
    : null;
  return userId
    ? syncGoogleCalendar(userId)
    : { ok: false as const, error: "Calendar owner is not connected." };
}

export async function maybeSyncStoredCalendarOwner() {
  await ensureTrackerTables();
  const rows = await db()`
    UPDATE clemi_calendar_settings
    SET sync_started_at = NOW()
    WHERE id = 1
      AND (
        last_synced_at IS NULL
        OR last_synced_at < NOW() - INTERVAL '30 minutes'
      )
      AND (
        sync_started_at IS NULL
        OR sync_started_at < NOW() - INTERVAL '10 minutes'
      )
    RETURNING owner_user_id
  `;
  const userId = rows[0]?.owner_user_id
    ? String(rows[0].owner_user_id)
    : null;
  return userId ? syncGoogleCalendar(userId) : null;
}

export async function clearCurrentLocation() {
  await ensureTrackerTables();
  await db()`DELETE FROM clemi_current_location WHERE id = 1`;
}

export async function saveTravelPlace(input: {
  id?: unknown;
  city: unknown;
  country: unknown;
  firstYear: unknown;
  lastYear: unknown;
  status: unknown;
}) {
  await ensureTrackerTables();
  const id = input.id ? cleanId(input.id) : randomUUID();
  const city = cleanLine(input.city, 80);
  const country = cleanLine(input.country, 80);
  const firstYear = Math.trunc(numberInRange(input.firstYear, 1900, 2100));
  const lastYear = Math.trunc(
    numberInRange(input.lastYear, firstYear, 2100),
  );
  const status =
    input.status === "approved" || input.status === "rejected"
      ? input.status
      : "draft";
  if (city.length < 2 || country.length < 2) throw new Error("Invalid city.");
  const geocoded = await geocodeCalendarLocation(`${city}, ${country}`);
  if (!geocoded) throw new Error("Could not find that city.");
  await db()`
    INSERT INTO clemi_places (
      id, city, country, latitude, longitude, first_year, last_year, status
    )
    VALUES (
      ${id}, ${city}, ${country},
      ${geocoded.latitude}, ${geocoded.longitude},
      ${firstYear}, ${lastYear}, ${status}
    )
    ON CONFLICT (id) DO UPDATE SET
      city = EXCLUDED.city,
      country = EXCLUDED.country,
      latitude = EXCLUDED.latitude,
      longitude = EXCLUDED.longitude,
      first_year = EXCLUDED.first_year,
      last_year = EXCLUDED.last_year,
      status = EXCLUDED.status,
      updated_at = NOW()
  `;
}

export async function setTravelPlaceStatus(idValue: unknown, status: unknown) {
  const id = cleanId(idValue);
  if (status !== "draft" && status !== "approved" && status !== "rejected") {
    throw new Error("Invalid place status.");
  }
  await db()`
    UPDATE clemi_places
    SET status = ${status}, updated_at = NOW()
    WHERE id = ${id}
  `;
}

export async function deleteTravelPlace(idValue: unknown) {
  await db()`DELETE FROM clemi_places WHERE id = ${cleanId(idValue)}`;
}
