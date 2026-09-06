import { neon } from "@neondatabase/serverless";

type ClerkUser = {
  id: string;
  primaryEmailAddress: {
    emailAddress: string;
    verification: { status: string } | null;
  } | null;
  externalAccounts: Array<{
    provider: string;
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

  const verifiedOwnerEmail =
    user.primaryEmailAddress?.verification?.status === "verified" &&
    user.primaryEmailAddress.emailAddress.toLowerCase() === ownerEmail;
  const hasGoogleIdentity = user.externalAccounts.some(
    ({ provider, verification }) =>
      (provider === "google" || provider === "oauth_google") &&
      (verification === null || verification.status === "verified"),
  );
  if (!verifiedOwnerEmail || !hasGoogleIdentity) return false;

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
}

export async function getAdminData() {
  await ensureTables();
  const sql = db();
  await sql`DELETE FROM site_visits WHERE created_at < NOW() - INTERVAL '30 days'`;

  const [posties, wishes, introductions, visits] = await Promise.all([
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
  };
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
