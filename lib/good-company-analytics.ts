import "server-only";

import { createHmac, randomUUID } from "crypto";
import { neon } from "@neondatabase/serverless";

export const SHOP_EVENTS = [
  "shop_view",
  "product_view",
  "add_to_bag",
  "remove_from_bag",
  "checkout",
] as const;

export type ShopEvent = (typeof SHOP_EVENTS)[number];

export type ShopEventPayload = {
  event?: unknown;
  friendSlug?: unknown;
  path?: unknown;
  meta?: unknown;
  visitorHash?: string | null;
};

export type ShopFriendStats = {
  friendSlug: string;
  nickname: string | null;
  views: number;
  bagAdds: number;
  checkouts: number;
};

export type ShopActivityItem = {
  id: string;
  event: ShopEvent;
  friendSlug: string | null;
  nickname: string | null;
  path: string;
  device: string;
  city: string | null;
  country: string | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
};

export type ShopPeriodTotals = {
  shopViews: number;
  productViews: number;
  bagAdds: number;
  checkouts: number;
  uniqueVisitors: number;
};

export type ShopAnalytics = {
  days: number;
  totals7: ShopPeriodTotals;
  totals30: ShopPeriodTotals;
  topFriends: ShopFriendStats[];
  recent: ShopActivityItem[];
};

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

function requestIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return request.headers.get("x-real-ip")?.trim() || forwarded || "";
}

function isShopEvent(value: unknown): value is ShopEvent {
  return typeof value === "string" && (SHOP_EVENTS as readonly string[]).includes(value);
}

function iso(value: unknown) {
  return value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();
}

function parseMeta(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const entries = Object.entries(value as Record<string, unknown>).slice(0, 12);
  if (!entries.length) return null;
  const meta: Record<string, unknown> = {};
  for (const [key, entry] of entries) {
    const cleanKey = cleanLine(key, 40);
    if (!cleanKey) continue;
    if (typeof entry === "string") meta[cleanKey] = cleanLine(entry, 200);
    else if (typeof entry === "number" && Number.isFinite(entry)) meta[cleanKey] = entry;
    else if (typeof entry === "boolean") meta[cleanKey] = entry;
  }
  return Object.keys(meta).length ? meta : null;
}

function db(url = databaseUrl()) {
  return neon(url);
}

type Sql = ReturnType<typeof db>;

async function ensureTable(sql: Sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS good_company_events (
      id TEXT PRIMARY KEY,
      event TEXT NOT NULL,
      friend_slug TEXT,
      path TEXT NOT NULL,
      device TEXT NOT NULL,
      city TEXT,
      country TEXT,
      ip_hash TEXT,
      visitor_hash TEXT,
      meta JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS good_company_events_created_at_idx
    ON good_company_events (created_at DESC)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS good_company_events_friend_event_idx
    ON good_company_events (friend_slug, event, created_at DESC)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS good_company_events_event_created_at_idx
    ON good_company_events (event, created_at DESC)
  `;
}

export async function removeShopEventsFromRequest(request: Request) {
  const url = databaseUrl();
  const ipHash = hashIp(requestIp(request));
  if (!url || !ipHash) return;

  const sql = db(url);
  await sql`DELETE FROM good_company_events WHERE ip_hash = ${ipHash}`;
}

export async function recordShopEvent(request: Request, payload: ShopEventPayload) {
  const url = databaseUrl();
  if (!url) return false;

  if (!isShopEvent(payload.event)) return false;

  const path = cleanLine(payload.path, 180);
  if (
    !path.startsWith("/") ||
    path.startsWith("/admin") ||
    path.startsWith("/controlroom")
  ) {
    return false;
  }

  const friendSlug = cleanLine(payload.friendSlug, 80) || null;
  const meta = parseMeta(payload.meta);
  const visitor =
    typeof payload.visitorHash === "string" && payload.visitorHash
      ? cleanLine(payload.visitorHash, 128)
      : null;

  const ip = requestIp(request);
  const city = cleanLine(decodedHeader(request.headers.get("x-vercel-ip-city")), 80);
  const country = cleanLine(request.headers.get("x-vercel-ip-country"), 8);
  const device = deviceFromAgent(request.headers.get("user-agent") ?? "");
  const sql = db(url);

  await ensureTable(sql);
  await sql`
    DELETE FROM good_company_events
    WHERE created_at < NOW() - INTERVAL '90 days'
  `;
  await sql`
    INSERT INTO good_company_events (
      id,
      event,
      friend_slug,
      path,
      device,
      city,
      country,
      ip_hash,
      visitor_hash,
      meta
    )
    VALUES (
      ${randomUUID()},
      ${payload.event},
      ${friendSlug},
      ${path},
      ${device},
      ${city || null},
      ${country || null},
      ${hashIp(ip)},
      ${visitor || null},
      ${meta ? JSON.stringify(meta) : null}
    )
  `;
  return true;
}

function emptyTotals(): ShopPeriodTotals {
  return {
    shopViews: 0,
    productViews: 0,
    bagAdds: 0,
    checkouts: 0,
    uniqueVisitors: 0,
  };
}

async function periodTotals(sql: Sql, days: number): Promise<ShopPeriodTotals> {
  const rows = (await sql`
    SELECT
      COUNT(*) FILTER (WHERE event = 'shop_view')::int AS shop_views,
      COUNT(*) FILTER (WHERE event = 'product_view')::int AS product_views,
      COUNT(*) FILTER (WHERE event = 'add_to_bag')::int AS bag_adds,
      COUNT(*) FILTER (WHERE event = 'checkout')::int AS checkouts,
      COUNT(DISTINCT COALESCE(NULLIF(visitor_hash, ''), NULLIF(ip_hash, '')))::int AS unique_visitors
    FROM good_company_events
    WHERE created_at > NOW() - make_interval(days => ${days})
  `) as Array<{
    shop_views: number;
    product_views: number;
    bag_adds: number;
    checkouts: number;
    unique_visitors: number;
  }>;

  const row = rows[0];
  if (!row) return emptyTotals();
  return {
    shopViews: Number(row.shop_views ?? 0),
    productViews: Number(row.product_views ?? 0),
    bagAdds: Number(row.bag_adds ?? 0),
    checkouts: Number(row.checkouts ?? 0),
    uniqueVisitors: Number(row.unique_visitors ?? 0),
  };
}

export async function getShopAnalytics({ days = 30 }: { days?: number } = {}): Promise<ShopAnalytics> {
  const window = Math.min(90, Math.max(1, Math.trunc(Number(days) || 30)));
  const url = databaseUrl();
  if (!url) {
    return {
      days: window,
      totals7: emptyTotals(),
      totals30: emptyTotals(),
      topFriends: [],
      recent: [],
    };
  }

  const sql = db(url);
  await ensureTable(sql);
  await sql`
    DELETE FROM good_company_events
    WHERE created_at < NOW() - INTERVAL '90 days'
  `;

  const [totals7, totals30, topRows, recentRows] = await Promise.all([
    periodTotals(sql, 7),
    periodTotals(sql, 30),
    sql`
      SELECT
        e.friend_slug,
        f.nickname,
        COUNT(*) FILTER (WHERE e.event = 'product_view')::int AS views,
        COUNT(*) FILTER (WHERE e.event = 'add_to_bag')::int AS bag_adds,
        COUNT(*) FILTER (WHERE e.event = 'checkout')::int AS checkouts
      FROM good_company_events e
      LEFT JOIN friends f ON f.slug = e.friend_slug
      WHERE e.friend_slug IS NOT NULL
        AND e.created_at > NOW() - make_interval(days => ${window})
        AND e.event IN ('product_view', 'add_to_bag', 'checkout')
      GROUP BY e.friend_slug, f.nickname
      ORDER BY views DESC, bag_adds DESC, checkouts DESC, e.friend_slug ASC
      LIMIT 40
    `,
    sql`
      SELECT
        e.id,
        e.event,
        e.friend_slug,
        f.nickname,
        e.path,
        e.device,
        e.city,
        e.country,
        e.meta,
        e.created_at
      FROM good_company_events e
      LEFT JOIN friends f ON f.slug = e.friend_slug
      WHERE e.created_at > NOW() - make_interval(days => ${window})
      ORDER BY e.created_at DESC
      LIMIT 50
    `,
  ]);

  return {
    days: window,
    totals7,
    totals30,
    topFriends: (topRows as Array<Record<string, unknown>>)
      .map((row) => ({
        friendSlug: String(row.friend_slug),
        nickname: row.nickname ? String(row.nickname) : null,
        views: Number(row.views ?? 0),
        bagAdds: Number(row.bag_adds ?? 0),
        checkouts: Number(row.checkouts ?? 0),
      }))
      .filter((row) => row.views || row.bagAdds || row.checkouts),
    recent: (recentRows as Array<Record<string, unknown>>)
      .map((row) => {
        const event = String(row.event);
        if (!isShopEvent(event)) return null;
        const meta =
          row.meta && typeof row.meta === "object" && !Array.isArray(row.meta)
            ? (row.meta as Record<string, unknown>)
            : null;
        return {
          id: String(row.id),
          event,
          friendSlug: row.friend_slug ? String(row.friend_slug) : null,
          nickname: row.nickname ? String(row.nickname) : null,
          path: String(row.path ?? ""),
          device: String(row.device ?? "desktop"),
          city: row.city ? String(row.city) : null,
          country: row.country ? String(row.country) : null,
          meta,
          createdAt: iso(row.created_at),
        } satisfies ShopActivityItem;
      })
      .filter((row): row is ShopActivityItem => Boolean(row)),
  };
}
