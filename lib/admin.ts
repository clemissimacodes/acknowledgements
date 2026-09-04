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
      verification?.status === "verified" &&
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
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
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
      SELECT id, name, platform, social_url, mailing_address, created_at
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

export async function clearRadar() {
  await ensureTables();
  await db()`DELETE FROM clemi_radar WHERE id = 1`;
}
