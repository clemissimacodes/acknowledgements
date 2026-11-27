import "server-only";

import { createHmac, randomUUID } from "crypto";
import { neon } from "@neondatabase/serverless";
import { visitorHash } from "@/lib/recording-visitor";

export const SHOP_EVENTS = [
  "shop_view",
  "product_view",
  "add_to_bag",
  "remove_from_bag",
  "checkout",
] as const;

export type ShopEvent = (typeof SHOP_EVENTS)[number];

export type ShopEventRow = {
  id: string;
  event: ShopEvent;
  friendSlug: string | null;
  path: string;
  device: string;
  city: string | null;
  country: string | null;
  createdAt: string;
  meta: Record<string, unknown>;
};

export type ShopFriendRank = {
  slug: string;
  nickname: string;
  productName: string;
  views: number;
  bagAdds: number;
  checkouts: number;
};

export type ShopAnalytics = {
  days: number;
  totals: {
    shopViews: number;
    productViews: number;
    bagAdds: number;
    bagRemoves: number;
    checkouts: number;
    uniqueVisitors: number;
  };
  popular: ShopFriendRank[];
  recent: ShopEventRow[];
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

function cleanSlug(value: unknown) {
  const slug = cleanLine(value, 80).toLowerCase();
  if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;
  return slug;
}

function cleanPath(value: unknown) {
  const path = cleanLine(value, 180);
  if (!path.startsWith("/")) return "";
  if (path.startsWith("/admin") || path.startsWith("/controlroom")) return "";
  return path;
}

function cleanMeta(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>).slice(0, 12)) {
    const k = cleanLine(key, 40);
    if (!k) continue;
    if (typeof raw === "string") out[k] = cleanLine(raw, 120);
    else if (typeof raw === "number" && Number.isFinite(raw)) out[k] = raw;
    else if (typeof raw === "boolean") out[k] = raw;
  }
  return out;
}

function iso(value: string | Date) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

let ready: Promise<void> | null = null;

function ensureTable() {
  ready ??= (async () => {
    const sql = db();
    await sql`
      CREATE TABLE IF NOT EXISTS good_company_events (
        id TEXT PRIMARY KEY,
        event TEXT NOT NULL,
        friend_slug TEXT,
        path TEXT NOT NULL DEFAULT '',
        device TEXT NOT NULL DEFAULT 'desktop',
        city TEXT,
        country TEXT,
        ip_hash TEXT,
        visitor_hash TEXT,
        meta JSONB NOT NULL DEFAULT '{}'::jsonb,
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
      CREATE INDEX IF NOT EXISTS good_company_events_event_created_idx
      ON good_company_events (event, created_at DESC)
    `;
  })().catch((error) => {
    ready = null;
    throw error;
  });
  return ready;
}

export async function removeShopEventsFromRequest(request: Request) {
  const url = databaseUrl();
  const ipHash = hashIp(requestIp(request));
  if (!url || !ipHash) return;
  await ensureTable();
  await db()`DELETE FROM good_company_events WHERE ip_hash = ${ipHash}`;
}

export async function recordShopEvent(
  request: Request,
  payload: {
    event?: unknown;
    friendSlug?: unknown;
    path?: unknown;
    meta?: unknown;
  },
) {
  const url = databaseUrl();
  if (!url) return false;

  if (!isShopEvent(payload.event)) return false;
  const event = payload.event;
  const path = cleanPath(payload.path) || "/";
  const friendSlug =
    event === "shop_view" ? null : cleanSlug(payload.friendSlug);
  if (
    (event === "product_view" ||
      event === "add_to_bag" ||
      event === "remove_from_bag" ||
      event === "checkout") &&
    !friendSlug
  ) {
    return false;
  }

  const ip = requestIp(request);
  const city = cleanLine(decodedHeader(request.headers.get("x-vercel-ip-city")), 80);
  const country = cleanLine(request.headers.get("x-vercel-ip-country"), 8);
  const device = deviceFromAgent(request.headers.get("user-agent") ?? "");
  const meta = cleanMeta(payload.meta);
  let visitor: string | null = null;
  try {
    visitor = await visitorHash({ create: true });
  } catch {
    visitor = null;
  }

  await ensureTable();
  const sql = db();
  await sql`
    DELETE FROM good_company_events
    WHERE created_at < NOW() - INTERVAL '90 days'
  `;
  await sql`
    INSERT INTO good_company_events (
      id, event, friend_slug, path, device, city, country, ip_hash, visitor_hash, meta
    )
    VALUES (
      ${randomUUID()},
      ${event},
      ${friendSlug},
      ${path},
      ${device},
      ${city || null},
      ${country || null},
      ${hashIp(ip)},
      ${visitor},
      ${JSON.stringify(meta)}
    )
  `;
  return true;
}

/** Server-side checkout logging (one row per line item). */
export async function recordCheckoutEvents(
  request: Request,
  lines: Array<{ slug: string; colorName?: string }>,
  receiptId: string,
) {
  const unique = [...new Map(lines.map((l) => [cleanSlug(l.slug), l])).entries()].filter(
    ([slug]) => Boolean(slug),
  ) as Array<[string, { slug: string; colorName?: string }]>;
  for (const [slug, line] of unique) {
    try {
      await recordShopEvent(request, {
        event: "checkout",
        friendSlug: slug,
        path: "/api/friends/checkout",
        meta: {
          receiptId: cleanLine(receiptId, 20),
          colorName: line.colorName ?? "",
          itemCount: unique.length,
        },
      });
    } catch {
      // Analytics must never fail checkout.
    }
  }
}

export async function getShopAnalytics(options: { days?: number } = {}): Promise<ShopAnalytics> {
  const days = Math.min(90, Math.max(1, Math.trunc(options.days ?? 30)));
  await ensureTable();
  const sql = db();

  const [totalsRows, popularRows, recentRows] = await Promise.all([
    sql`
      SELECT
        COUNT(*) FILTER (WHERE event = 'shop_view')::int AS shop_views,
        COUNT(*) FILTER (WHERE event = 'product_view')::int AS product_views,
        COUNT(*) FILTER (WHERE event = 'add_to_bag')::int AS bag_adds,
        COUNT(*) FILTER (WHERE event = 'remove_from_bag')::int AS bag_removes,
        COUNT(*) FILTER (WHERE event = 'checkout')::int AS checkouts,
        COUNT(DISTINCT COALESCE(NULLIF(visitor_hash, ''), NULLIF(ip_hash, '')))::int AS unique_visitors
      FROM good_company_events
      WHERE created_at > NOW() - (${days} * INTERVAL '1 day')
    `,
    sql`
      SELECT
        e.friend_slug AS slug,
        COALESCE(MAX(f.nickname), e.friend_slug) AS nickname,
        COALESCE(MAX(f.product_name), '') AS product_name,
        COUNT(*) FILTER (WHERE e.event = 'product_view')::int AS views,
        COUNT(*) FILTER (WHERE e.event = 'add_to_bag')::int AS bag_adds,
        COUNT(*) FILTER (WHERE e.event = 'checkout')::int AS checkouts
      FROM good_company_events e
      LEFT JOIN friends f ON f.slug = e.friend_slug
      WHERE e.friend_slug IS NOT NULL
        AND e.created_at > NOW() - (${days} * INTERVAL '1 day')
        AND e.event IN ('product_view', 'add_to_bag', 'checkout')
      GROUP BY e.friend_slug
      ORDER BY views DESC, bag_adds DESC, checkouts DESC, nickname ASC
      LIMIT 40
    `,
    sql`
      SELECT id, event, friend_slug, path, device, city, country, meta, created_at
      FROM good_company_events
      WHERE created_at > NOW() - (${days} * INTERVAL '1 day')
      ORDER BY created_at DESC
      LIMIT 50
    `,
  ]);

  const totals = totalsRows[0] ?? {};
  return {
    days,
    totals: {
      shopViews: Number(totals.shop_views ?? 0),
      productViews: Number(totals.product_views ?? 0),
      bagAdds: Number(totals.bag_adds ?? 0),
      bagRemoves: Number(totals.bag_removes ?? 0),
      checkouts: Number(totals.checkouts ?? 0),
      uniqueVisitors: Number(totals.unique_visitors ?? 0),
    },
    popular: popularRows.map((row) => ({
      slug: String(row.slug),
      nickname: String(row.nickname ?? row.slug),
      productName: String(row.product_name ?? ""),
      views: Number(row.views ?? 0),
      bagAdds: Number(row.bag_adds ?? 0),
      checkouts: Number(row.checkouts ?? 0),
    })),
    recent: recentRows.map((row) => ({
      id: String(row.id),
      event: (SHOP_EVENTS.includes(row.event as ShopEvent)
        ? row.event
        : "shop_view") as ShopEvent,
      friendSlug: row.friend_slug ? String(row.friend_slug) : null,
      path: String(row.path ?? ""),
      device: String(row.device ?? "desktop"),
      city: row.city ? String(row.city) : null,
      country: row.country ? String(row.country) : null,
      createdAt: iso(row.created_at as string | Date),
      meta:
        row.meta && typeof row.meta === "object" && !Array.isArray(row.meta)
          ? (row.meta as Record<string, unknown>)
          : {},
    })),
  };
}
