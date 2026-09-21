import "server-only";

import { createHmac, randomUUID } from "crypto";
import { neon } from "@neondatabase/serverless";

export type SecretsOutcome = "cracked" | "wrong" | "locked";

export type SecretsAttempt = {
  id: string;
  guestId: string;
  ipHash: string | null;
  city: string | null;
  country: string | null;
  device: string;
  userAgent: string | null;
  clerkUserId: string | null;
  clerkEmail: string | null;
  guess: string;
  outcome: SecretsOutcome;
  createdAt: string;
};

export type SecretsGuesser = {
  handle: string;
  attempts: number;
  wrong: number;
  cracked: number;
  lastGuess: string;
  lastSeen: string;
  city: string | null;
  country: string | null;
  device: string;
  clerkEmail: string | null;
};

export type SecretsAttemptReport = {
  total: number;
  last24h: number;
  cracked: number;
  globalFailuresThisHour: number;
  globalFailuresPerHourCap: number;
  guessers: SecretsGuesser[];
  attempts: SecretsAttempt[];
};

export type GuesserIdentity = {
  guestId: string;
  ipHash: string | null;
};

// Throttle policy. A four-letter password cannot be made unguessable; it can
// only be made slow and expensive to guess. After the free failures a guesser
// (matched by guest cookie OR hashed IP) is locked out for 1 min, then 2, 4,
// 8… up to a day, and every attempt made while locked extends the streak. On
// top of that, wrong guesses from the whole internet are capped per hour, so a
// distributed brute force of all 26^4 lowercase combinations needs months.
const FREE_FAILURES = 5;
const MAX_LOCK_SECONDS = 24 * 60 * 60;
const GLOBAL_FAILURES_PER_HOUR = 150;
const GLOBAL_LOCK_SECONDS = 10 * 60;
const RETENTION_DAYS = 365;

function databaseUrl() {
  return process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? "";
}

function db() {
  const url = databaseUrl();
  if (!url) throw new Error("Database is not configured.");
  return neon(url);
}

function iso(value: unknown) {
  return new Date(value as string | Date).toISOString();
}

function cleanLine(value: unknown, max: number) {
  return String(value ?? "")
    .replace(/\0/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export function hashIp(ip: string) {
  const secret =
    process.env.VISITOR_HASH_SECRET ??
    process.env.CLERK_SECRET_KEY ??
    process.env.ADMIN_EMAIL;
  if (!ip || !secret) return null;
  return createHmac("sha256", secret).update(ip).digest("hex");
}

export function requestIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return request.headers.get("x-real-ip")?.trim() || forwarded || "";
}

export function deviceFromAgent(userAgent: string) {
  if (/ipad|tablet|kindle/i.test(userAgent)) return "tablet";
  if (/mobile|iphone|android/i.test(userAgent)) return "mobile";
  return "desktop";
}

export function isGuestId(value: string | undefined): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  );
}

export function newGuestId() {
  return randomUUID();
}

export function guesserHandle(guestId: string, ipHash: string | null) {
  return `guest-${guestId.slice(0, 8)}${ipHash ? ` · ip-${ipHash.slice(0, 8)}` : ""}`;
}

async function ensureTable() {
  const sql = db();
  await sql`
    CREATE TABLE IF NOT EXISTS secrets_attempts (
      id TEXT PRIMARY KEY,
      guest_id TEXT NOT NULL,
      ip_hash TEXT,
      city TEXT,
      country TEXT,
      device TEXT NOT NULL,
      user_agent TEXT,
      clerk_user_id TEXT,
      clerk_email TEXT,
      guess TEXT NOT NULL,
      outcome TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS secrets_attempts_created_at_idx
    ON secrets_attempts (created_at DESC)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS secrets_attempts_guest_idx
    ON secrets_attempts (guest_id, created_at DESC)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS secrets_attempts_ip_idx
    ON secrets_attempts (ip_hash, created_at DESC)
  `;
}

export type ThrottleVerdict =
  | { locked: false }
  | { locked: true; reason: "guesser" | "global"; retryAfterSeconds: number };

export async function assessSecretsThrottle(
  identity: GuesserIdentity,
): Promise<ThrottleVerdict> {
  await ensureTable();
  const sql = db();
  const [guesser] = (await sql`
    SELECT COUNT(*)::int AS failures, MAX(created_at) AS last_failure
    FROM secrets_attempts
    WHERE outcome <> 'cracked'
      AND created_at > NOW() - INTERVAL '24 hours'
      AND (
        guest_id = ${identity.guestId}
        OR (${identity.ipHash}::text IS NOT NULL AND ip_hash = ${identity.ipHash})
      )
  `) as Array<{ failures: number; last_failure: string | Date | null }>;
  const [global] = (await sql`
    SELECT COUNT(*)::int AS failures
    FROM secrets_attempts
    WHERE outcome = 'wrong'
      AND created_at > NOW() - INTERVAL '1 hour'
  `) as Array<{ failures: number }>;

  const failures = Number(guesser?.failures ?? 0);
  if (failures >= FREE_FAILURES && guesser?.last_failure) {
    const lockSeconds = Math.min(
      60 * 2 ** (failures - FREE_FAILURES),
      MAX_LOCK_SECONDS,
    );
    const unlockAt = new Date(guesser.last_failure).getTime() + lockSeconds * 1000;
    const remaining = Math.ceil((unlockAt - Date.now()) / 1000);
    if (remaining > 0) {
      return { locked: true, reason: "guesser", retryAfterSeconds: remaining };
    }
  }

  if (Number(global?.failures ?? 0) >= GLOBAL_FAILURES_PER_HOUR) {
    return {
      locked: true,
      reason: "global",
      retryAfterSeconds: GLOBAL_LOCK_SECONDS,
    };
  }

  return { locked: false };
}

export async function recordSecretsAttempt(input: {
  identity: GuesserIdentity;
  request: Request;
  guess: string;
  outcome: SecretsOutcome;
  clerkUserId?: string | null;
  clerkEmail?: string | null;
}) {
  await ensureTable();
  const { request } = input;
  let city = "";
  try {
    city = cleanLine(
      decodeURIComponent(request.headers.get("x-vercel-ip-city") ?? ""),
      80,
    );
  } catch {
    city = "";
  }
  const country = cleanLine(request.headers.get("x-vercel-ip-country"), 8);
  const userAgent = cleanLine(request.headers.get("user-agent"), 400);
  const sql = db();
  await sql`
    DELETE FROM secrets_attempts
    WHERE created_at < NOW() - (${RETENTION_DAYS}::int * INTERVAL '1 day')
  `;
  await sql`
    INSERT INTO secrets_attempts (
      id, guest_id, ip_hash, city, country, device, user_agent,
      clerk_user_id, clerk_email, guess, outcome
    )
    VALUES (
      ${randomUUID()},
      ${input.identity.guestId},
      ${input.identity.ipHash},
      ${city || null},
      ${country || null},
      ${deviceFromAgent(userAgent)},
      ${userAgent || null},
      ${input.clerkUserId ?? null},
      ${input.clerkEmail ?? null},
      ${cleanLine(input.guess, 200)},
      ${input.outcome}
    )
  `;
}

function mapAttempt(row: Record<string, unknown>): SecretsAttempt {
  return {
    id: String(row.id),
    guestId: String(row.guest_id),
    ipHash: row.ip_hash ? String(row.ip_hash) : null,
    city: row.city ? String(row.city) : null,
    country: row.country ? String(row.country) : null,
    device: String(row.device),
    userAgent: row.user_agent ? String(row.user_agent) : null,
    clerkUserId: row.clerk_user_id ? String(row.clerk_user_id) : null,
    clerkEmail: row.clerk_email ? String(row.clerk_email) : null,
    guess: String(row.guess),
    outcome: row.outcome as SecretsOutcome,
    createdAt: iso(row.created_at),
  };
}

export async function getSecretsAttemptReport(): Promise<SecretsAttemptReport> {
  await ensureTable();
  const sql = db();
  const attempts = (await sql`
    SELECT id, guest_id, ip_hash, city, country, device, user_agent,
           clerk_user_id, clerk_email, guess, outcome, created_at
    FROM secrets_attempts
    ORDER BY created_at DESC
    LIMIT 400
  `) as Array<Record<string, unknown>>;
  const [totals] = (await sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours')::int AS last24h,
      COUNT(*) FILTER (WHERE outcome = 'cracked')::int AS cracked,
      COUNT(*) FILTER (
        WHERE outcome = 'wrong' AND created_at > NOW() - INTERVAL '1 hour'
      )::int AS global_hour
    FROM secrets_attempts
  `) as Array<{
    total: number;
    last24h: number;
    cracked: number;
    global_hour: number;
  }>;
  const guessers = (await sql`
    SELECT DISTINCT ON (guest_id)
      guest_id,
      ip_hash,
      city,
      country,
      device,
      clerk_email,
      guess,
      created_at,
      COUNT(*) OVER (PARTITION BY guest_id)::int AS attempts,
      COUNT(*) FILTER (WHERE outcome = 'wrong') OVER (PARTITION BY guest_id)::int AS wrong,
      COUNT(*) FILTER (WHERE outcome = 'cracked') OVER (PARTITION BY guest_id)::int AS cracked
    FROM secrets_attempts
    ORDER BY guest_id, created_at DESC
  `) as Array<Record<string, unknown>>;

  return {
    total: Number(totals?.total ?? 0),
    last24h: Number(totals?.last24h ?? 0),
    cracked: Number(totals?.cracked ?? 0),
    globalFailuresThisHour: Number(totals?.global_hour ?? 0),
    globalFailuresPerHourCap: GLOBAL_FAILURES_PER_HOUR,
    guessers: guessers
      .map((row) => ({
        handle: guesserHandle(
          String(row.guest_id),
          row.ip_hash ? String(row.ip_hash) : null,
        ),
        attempts: Number(row.attempts),
        wrong: Number(row.wrong),
        cracked: Number(row.cracked),
        lastGuess: String(row.guess),
        lastSeen: iso(row.created_at),
        city: row.city ? String(row.city) : null,
        country: row.country ? String(row.country) : null,
        device: String(row.device),
        clerkEmail: row.clerk_email ? String(row.clerk_email) : null,
      }))
      .sort((left, right) => right.lastSeen.localeCompare(left.lastSeen))
      .slice(0, 40),
    attempts: attempts.map(mapAttempt),
  };
}

export async function clearSecretsAttempts() {
  await ensureTable();
  await db()`DELETE FROM secrets_attempts`;
}
