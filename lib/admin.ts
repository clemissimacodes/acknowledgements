import { neon } from "@neondatabase/serverless";

type ClerkUser = {
  id: string;
  externalAccounts: Array<{
    provider: string;
    emailAddress: string;
    verification: { status: string } | null;
  }>;
};

export type PostiesRow = {
  id: string;
  name: string;
  platform: string;
  socialUrl: string;
  mailingAddress: string;
  sentAt: string | null;
  createdAt: string;
};

export type WishRow = {
  id: string;
  body: string;
  location: string | null;
  gender: string | null;
  age: string | null;
  createdAt: string;
};

export type IntroductionRow = {
  id: string;
  tinyThing: string;
  createdAt: string;
};

export type VisitRow = {
  id: string;
  path: string;
  referrerHost: string | null;
  device: string;
  city: string | null;
  country: string | null;
  ipHash: string | null;
  createdAt: string;
};

export type RadarStatus = {
  area: string;
  note: string | null;
  updatedAt: string;
  expiresAt: string;
};

function databaseUrl() {
  return process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? "";
}

function db() {
  const url = databaseUrl();
  if (!url) throw new Error("Database is not configured.");
  return neon(url);
}

function iso(value: string | Date) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function isAdminUser(user: ClerkUser | null) {
  if (!user) return false;
  const ownerId = process.env.ADMIN_USER_ID?.trim();
  const ownerEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!ownerEmail) return false;

  const verifiedGoogleOwner = user.externalAccounts.some(
    ({ provider, emailAddress, verification }) =>
      provider === "google" &&
      (verification === null || verification.status === "verified") &&
      emailAddress.toLowerCase() === ownerEmail,
  );
  if (!verifiedGoogleOwner) return false;

  return ownerId ? user.id === ownerId : true;
}

async function ensureTables() {
  const sql = db();
  await sql`
    CREATE TABLE IF NOT EXISTS sunday_posties (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      platform TEXT NOT NULL,
      social_url TEXT NOT NULL,
      mailing_address TEXT NOT NULL,
      sent_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    ALTER TABLE sunday_posties
    ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS dandelion_wishes (
      id TEXT PRIMARY KEY,
      body TEXT NOT NULL,
      location TEXT,
      gender TEXT,
      age TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
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
    CREATE TABLE IF NOT EXISTS site_visits (
      id TEXT PRIMARY KEY,
      path TEXT NOT NULL,
      referrer_host TEXT,
      device TEXT NOT NULL,
      city TEXT,
      country TEXT,
      ip_hash TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS site_visits_created_at_idx
    ON site_visits (created_at DESC)
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS clemi_radar (
      id SMALLINT PRIMARY KEY CHECK (id = 1),
      area TEXT NOT NULL,
      note TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL
    )
  `;
}

export async function getAdminData() {
  await ensureTables();
  const sql = db();
  await sql`DELETE FROM site_visits WHERE created_at < NOW() - INTERVAL '30 days'`;

  const [posties, wishes, introductions, visits, radar] = await Promise.all([
    sql`
      SELECT id, name, platform, social_url, mailing_address, sent_at, created_at
      FROM sunday_posties
      ORDER BY created_at DESC
      LIMIT 250
    `,
    sql`
      SELECT id, body, location, gender, age, created_at
      FROM dandelion_wishes
      ORDER BY created_at DESC
      LIMIT 250
    `,
    sql`
      SELECT id, tiny_thing, created_at
      FROM visitor_introductions
      ORDER BY created_at DESC
      LIMIT 250
    `,
    sql`
      SELECT id, path, referrer_host, device, city, country, ip_hash, created_at
      FROM site_visits
      ORDER BY created_at DESC
      LIMIT 500
    `,
    sql`
      SELECT area, note, updated_at, expires_at
      FROM clemi_radar
      WHERE id = 1 AND expires_at > NOW()
    `,
  ]);

  return {
    posties: posties.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      platform: String(row.platform),
      socialUrl: String(row.social_url),
      mailingAddress: String(row.mailing_address),
      sentAt: row.sent_at ? iso(row.sent_at as string | Date) : null,
      createdAt: iso(row.created_at as string | Date),
    })) as PostiesRow[],
    wishes: wishes.map((row) => ({
      id: String(row.id),
      body: String(row.body),
      location: row.location ? String(row.location) : null,
      gender: row.gender ? String(row.gender) : null,
      age: row.age ? String(row.age) : null,
      createdAt: iso(row.created_at as string | Date),
    })) as WishRow[],
    introductions: introductions.map((row) => ({
      id: String(row.id),
      tinyThing: String(row.tiny_thing),
      createdAt: iso(row.created_at as string | Date),
    })) as IntroductionRow[],
    visits: visits.map((row) => ({
      id: String(row.id),
      path: String(row.path),
      referrerHost: row.referrer_host ? String(row.referrer_host) : null,
      device: String(row.device),
      city: row.city ? String(row.city) : null,
      country: row.country ? String(row.country) : null,
      ipHash: row.ip_hash ? String(row.ip_hash) : null,
      createdAt: iso(row.created_at as string | Date),
    })) as VisitRow[],
    radar: radar[0]
      ? ({
          area: String(radar[0].area),
          note: radar[0].note ? String(radar[0].note) : null,
          updatedAt: iso(radar[0].updated_at as string | Date),
          expiresAt: iso(radar[0].expires_at as string | Date),
        } satisfies RadarStatus)
      : null,
  };
}

export async function getActiveRadar(): Promise<RadarStatus | null> {
  try {
    await ensureTables();
    const rows = await db()`
      SELECT area, note, updated_at, expires_at
      FROM clemi_radar
      WHERE id = 1 AND expires_at > NOW()
    `;
    if (!rows[0]) return null;
    return {
      area: String(rows[0].area),
      note: rows[0].note ? String(rows[0].note) : null,
      updatedAt: iso(rows[0].updated_at as string | Date),
      expiresAt: iso(rows[0].expires_at as string | Date),
    };
  } catch {
    return null;
  }
}

export async function setRadar(areaValue: unknown, noteValue: unknown) {
  const area = String(areaValue ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
  const note = String(noteValue ?? "").replace(/\s+/g, " ").trim().slice(0, 140);
  if (area.length < 2) throw new Error("Add a city or neighborhood.");
  await ensureTables();
  await db()`
    INSERT INTO clemi_radar (id, area, note, updated_at, expires_at)
    VALUES (1, ${area}, ${note || null}, NOW(), NOW() + INTERVAL '12 hours')
    ON CONFLICT (id) DO UPDATE SET
      area = EXCLUDED.area,
      note = EXCLUDED.note,
      updated_at = NOW(),
      expires_at = NOW() + INTERVAL '12 hours'
  `;
}

function coarseCoordinates(latitude: number, longitude: number) {
  const latitudeStep = 0.04;
  const longitudeStep =
    latitudeStep /
    Math.max(0.25, Math.cos((latitude * Math.PI) / 180));
  return {
    latitude: Math.round(latitude / latitudeStep) * latitudeStep,
    longitude: Math.round(longitude / longitudeStep) * longitudeStep,
  };
}

async function areaFromCoordinates(latitude: number, longitude: number) {
  const coarse = coarseCoordinates(latitude, longitude);
  const params = new URLSearchParams({
    format: "jsonv2",
    lat: coarse.latitude.toFixed(5),
    lon: coarse.longitude.toFixed(5),
    zoom: "12",
    addressdetails: "1",
  });
  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?${params}`,
    {
      headers: {
        Accept: "application/json",
        "Accept-Language": "en",
        "User-Agent":
          "Clemi-Radar/1.0 (https://clemissima.vercel.app/privacy)",
      },
      signal: AbortSignal.timeout(6_000),
      cache: "no-store",
    },
  );
  if (!response.ok) throw new Error("Could not name this fuzzy location.");
  const payload = (await response.json()) as {
    address?: Record<string, string | undefined>;
  };
  const address = payload.address ?? {};
  const neighborhood =
    address.neighbourhood ??
    address.suburb ??
    address.city_district ??
    address.borough;
  const city =
    address.city ??
    address.town ??
    address.village ??
    address.municipality ??
    address.county;
  const parts = [neighborhood, city]
    .filter((part, index, all): part is string =>
      Boolean(part && all.indexOf(part) === index),
    )
    .slice(0, 2);
  if (parts.length === 0 && address.state) parts.push(address.state);
  if (parts.length === 0) throw new Error("Could not name this fuzzy location.");
  return parts.join(", ");
}

export async function setRadarFromCoordinates(
  latitudeValue: unknown,
  longitudeValue: unknown,
  noteValue: unknown,
) {
  const latitude = Number(latitudeValue);
  const longitude = Number(longitudeValue);
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new Error("That location signal was not valid.");
  }
  const area = await areaFromCoordinates(latitude, longitude);
  await setRadar(area, noteValue);
  return area;
}

export async function clearRadar() {
  await ensureTables();
  await db()`DELETE FROM clemi_radar WHERE id = 1`;
}

function cleanId(value: unknown) {
  const id = String(value ?? "").trim();
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(id)) throw new Error("Invalid record.");
  return id;
}

function cleanRecordLine(value: unknown, max: number) {
  return String(value ?? "")
    .replace(/\0/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export async function updatePostiesRecord(input: {
  id: unknown;
  name: unknown;
  platform: unknown;
  socialUrl: unknown;
  mailingAddress: unknown;
}) {
  const id = cleanId(input.id);
  const name = cleanRecordLine(input.name, 80);
  const platform =
    input.platform === "instagram" || input.platform === "x"
      ? input.platform
      : null;
  const mailingAddress = String(input.mailingAddress ?? "")
    .replace(/\0/g, "")
    .trim()
    .slice(0, 600);
  let socialUrl: URL;
  try {
    socialUrl = new URL(cleanRecordLine(input.socialUrl, 200));
  } catch {
    throw new Error("Invalid social profile.");
  }
  const host = socialUrl.hostname.toLowerCase().replace(/^www\./, "");
  const socialMatches =
    platform === "instagram"
      ? host === "instagram.com"
      : host === "x.com" || host === "twitter.com";
  if (name.length < 2 || mailingAddress.length < 10 || !socialMatches) {
    throw new Error("Invalid Posties record.");
  }
  await db()`
    UPDATE sunday_posties
    SET
      name = ${name},
      platform = ${platform},
      social_url = ${socialUrl.toString()},
      mailing_address = ${mailingAddress}
    WHERE id = ${id}
  `;
}

export async function setPostiesSent(idValue: unknown, sent: boolean) {
  const id = cleanId(idValue);
  await db()`
    UPDATE sunday_posties
    SET sent_at = ${sent ? new Date().toISOString() : null}
    WHERE id = ${id}
  `;
}

export async function updateWishRecord(input: {
  id: unknown;
  body: unknown;
  location: unknown;
  gender: unknown;
  age: unknown;
}) {
  const id = cleanId(input.id);
  const body = cleanRecordLine(input.body, 100);
  if (!body) throw new Error("A wish cannot be empty.");
  await db()`
    UPDATE dandelion_wishes
    SET
      body = ${body},
      location = ${cleanRecordLine(input.location, 40) || null},
      gender = ${cleanRecordLine(input.gender, 24) || null},
      age = ${cleanRecordLine(input.age, 12) || null}
    WHERE id = ${id}
  `;
}

export async function updateIntroductionRecord(idValue: unknown, value: unknown) {
  const id = cleanId(idValue);
  const tinyThing = cleanRecordLine(value, 400);
  if (tinyThing.length < 3) throw new Error("An introduction is too short.");
  await db()`
    UPDATE visitor_introductions
    SET tiny_thing = ${tinyThing}
    WHERE id = ${id}
  `;
}

export async function deleteAdminRecord(
  kind: "posties" | "wish" | "introduction" | "visit",
  idValue: unknown,
) {
  const id = cleanId(idValue);
  const sql = db();
  if (kind === "posties") {
    await sql`DELETE FROM sunday_posties WHERE id = ${id}`;
  } else if (kind === "wish") {
    await sql`DELETE FROM dandelion_wishes WHERE id = ${id}`;
  } else if (kind === "introduction") {
    await sql`DELETE FROM visitor_introductions WHERE id = ${id}`;
  } else {
    await sql`DELETE FROM site_visits WHERE id = ${id}`;
  }
}

export async function clearVisitRecords() {
  await db()`DELETE FROM site_visits`;
}
