import { randomUUID } from "crypto";
import { neon } from "@neondatabase/serverless";

export const POSTIES_COOKIE = "sunday_posties_signed";

type PostiesSignup = {
  name: string;
  platform: "instagram" | "x";
  socialUrl: string;
  mailingAddress: string;
};

function databaseUrl() {
  return process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? "";
}

function cleanSingleLine(value: unknown, max: number) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function cleanAddress(value: unknown) {
  return String(value ?? "")
    .replace(/\0/g, "")
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .slice(0, 600);
}

function socialUrl(platform: PostiesSignup["platform"], value: unknown) {
  const raw = cleanSingleLine(value, 200);
  if (!raw) return null;

  if (/^(?:https?:\/\/)?(?:www\.)?(?:instagram\.com|x\.com|twitter\.com)\//i.test(raw)) {
    try {
      const parsed = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
      const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
      const allowed =
        platform === "instagram"
          ? host === "instagram.com"
          : host === "x.com" || host === "twitter.com";
      const handle = parsed.pathname.split("/").filter(Boolean)[0];
      if (!allowed || !handle) return null;
      return `https://${platform === "instagram" ? "instagram.com" : "x.com"}/${handle.replace(/^@/, "")}`;
    } catch {
      return null;
    }
  }

  const handle = raw.replace(/^@/, "");
  if (!/^[A-Za-z0-9._]{1,30}$/.test(handle)) return null;
  return `https://${platform === "instagram" ? "instagram.com" : "x.com"}/${handle}`;
}

export function cleanPostiesSignup(raw: {
  name?: unknown;
  platform?: unknown;
  social?: unknown;
  mailingAddress?: unknown;
}): PostiesSignup | null {
  const name = cleanSingleLine(raw.name, 80);
  const platform = raw.platform === "instagram" || raw.platform === "x"
    ? raw.platform
    : null;
  const mailingAddress = cleanAddress(raw.mailingAddress);
  const profile = platform ? socialUrl(platform, raw.social) : null;

  if (name.length < 2 || mailingAddress.length < 10 || !platform || !profile) {
    return null;
  }

  return { name, platform, socialUrl: profile, mailingAddress };
}

export async function addPostiesSignup(signup: PostiesSignup) {
  const url = databaseUrl();
  if (!url) return false;

  try {
    const sql = neon(url);
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
      INSERT INTO sunday_posties (
        id,
        name,
        platform,
        social_url,
        mailing_address
      )
      VALUES (
        ${randomUUID()},
        ${signup.name},
        ${signup.platform},
        ${signup.socialUrl},
        ${signup.mailingAddress}
      )
    `;
    return true;
  } catch {
    return false;
  }
}
