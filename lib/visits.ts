import { createHmac, randomUUID } from "crypto";
import { neon } from "@neondatabase/serverless";

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

function referrerHost(value: unknown) {
  const raw = cleanLine(value, 300);
  if (!raw) return null;
  try {
    return new URL(raw).hostname.replace(/^www\./, "").slice(0, 120) || null;
  } catch {
    return null;
  }
}

function deviceFromAgent(userAgent: string) {
  if (/ipad|tablet|kindle/i.test(userAgent)) return "tablet";
  if (/mobile|iphone|android/i.test(userAgent)) return "mobile";
  return "desktop";
}

function decodedHeader(value: string | null) {
  try {
    return decodeURIComponent(value ?? "");
  } catch {
    return "";
  }
}

function hashIp(ip: string) {
  const secret =
    process.env.VISITOR_HASH_SECRET ??
    process.env.CLERK_SECRET_KEY ??
    process.env.ADMIN_EMAIL;
  if (!ip || !secret) return null;
  return createHmac("sha256", secret).update(ip).digest("hex");
}

export async function recordVisit(request: Request, payload: {
  path?: unknown;
  referrer?: unknown;
}) {
  const url = databaseUrl();
  if (!url) return false;

  const path = cleanLine(payload.path, 180);
  if (
    !path.startsWith("/") ||
    path.startsWith("/admin") ||
    path.startsWith("/controlroom")
  ) {
    return false;
  }

  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = request.headers.get("x-real-ip")?.trim() || forwarded || "";
  const city = cleanLine(
    decodedHeader(request.headers.get("x-vercel-ip-city")),
    80,
  );
  const country = cleanLine(request.headers.get("x-vercel-ip-country"), 8);
  const device = deviceFromAgent(request.headers.get("user-agent") ?? "");
  const sql = neon(url);

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
    DELETE FROM site_visits
    WHERE created_at < NOW() - INTERVAL '30 days'
  `;
  await sql`
    INSERT INTO site_visits (
      id,
      path,
      referrer_host,
      device,
      city,
      country,
      ip_hash
    )
    VALUES (
      ${randomUUID()},
      ${path},
      ${referrerHost(payload.referrer)},
      ${device},
      ${city || null},
      ${country || null},
      ${hashIp(ip)}
    )
  `;
  return true;
}
