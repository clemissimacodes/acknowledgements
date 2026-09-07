import "server-only";

import { randomUUID } from "crypto";
import { neon } from "@neondatabase/serverless";
import { STORE_PRODUCTS, type StoreProductId } from "@/lib/store-catalog";

export type StoreInventoryStatus = "available" | "reserved" | "sold";

export type StorePurchase = {
  sessionId: string;
  productId: StoreProductId;
  paidAt: Date;
  revealExpiresAt: Date;
};

function databaseUrl() {
  return process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? "";
}

function sql() {
  const url = databaseUrl();
  if (!url) throw new Error("Store database is not configured.");
  return neon(url);
}

async function ensureStoreTables() {
  const db = sql();
  await db`
    CREATE TABLE IF NOT EXISTS clemi_store_inventory (
      product_id TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'available'
        CHECK (status IN ('available', 'reserved', 'sold')),
      reservation_token TEXT,
      stripe_session_id TEXT UNIQUE,
      reserved_until TIMESTAMPTZ,
      sold_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await db`
    CREATE TABLE IF NOT EXISTS clemi_store_purchases (
      stripe_session_id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL UNIQUE,
      amount_total INTEGER,
      currency TEXT,
      paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      reveal_expires_at TIMESTAMPTZ NOT NULL
    )
  `;

  for (const product of STORE_PRODUCTS) {
    await db`
      INSERT INTO clemi_store_inventory (product_id)
      VALUES (${product.id})
      ON CONFLICT (product_id) DO NOTHING
    `;
  }
}

async function releaseStaleReservations() {
  await sql()`
    UPDATE clemi_store_inventory
    SET
      status = 'available',
      reservation_token = NULL,
      stripe_session_id = NULL,
      reserved_until = NULL,
      updated_at = NOW()
    WHERE status = 'reserved' AND reserved_until < NOW()
  `;
}

export async function listStoreInventory() {
  const fallback = new Map<StoreProductId, StoreInventoryStatus>(
    STORE_PRODUCTS.map((product) => [product.id, "available"]),
  );

  try {
    await ensureStoreTables();
    await releaseStaleReservations();
    const rows = (await sql()`
      SELECT product_id, status
      FROM clemi_store_inventory
    `) as Array<{ product_id: StoreProductId; status: StoreInventoryStatus }>;

    for (const row of rows) fallback.set(row.product_id, row.status);
  } catch {
    // The catalog can still render while its database is unavailable.
  }

  return fallback;
}

export async function reserveStoreProduct(productId: StoreProductId) {
  await ensureStoreTables();
  await releaseStaleReservations();
  const reservationToken = randomUUID();
  const rows = (await sql()`
    UPDATE clemi_store_inventory
    SET
      status = 'reserved',
      reservation_token = ${reservationToken},
      reserved_until = NOW() + INTERVAL '35 minutes',
      updated_at = NOW()
    WHERE product_id = ${productId} AND status = 'available'
    RETURNING product_id
  `) as Array<{ product_id: StoreProductId }>;

  return rows.length ? reservationToken : null;
}

export async function attachStoreCheckoutSession(
  productId: StoreProductId,
  reservationToken: string,
  sessionId: string,
) {
  const rows = (await sql()`
    UPDATE clemi_store_inventory
    SET stripe_session_id = ${sessionId}, updated_at = NOW()
    WHERE
      product_id = ${productId}
      AND status = 'reserved'
      AND reservation_token = ${reservationToken}
    RETURNING product_id
  `) as Array<{ product_id: StoreProductId }>;

  return rows.length === 1;
}

export async function releaseStoreReservation(
  productId: StoreProductId,
  reservationToken: string,
) {
  await sql()`
    UPDATE clemi_store_inventory
    SET
      status = 'available',
      reservation_token = NULL,
      stripe_session_id = NULL,
      reserved_until = NULL,
      updated_at = NOW()
    WHERE
      product_id = ${productId}
      AND status = 'reserved'
      AND reservation_token = ${reservationToken}
  `;
}

export async function releaseStoreReservationBySession(sessionId: string) {
  if (!databaseUrl()) return;
  await ensureStoreTables();
  await sql()`
    UPDATE clemi_store_inventory
    SET
      status = 'available',
      reservation_token = NULL,
      stripe_session_id = NULL,
      reserved_until = NULL,
      updated_at = NOW()
    WHERE status = 'reserved' AND stripe_session_id = ${sessionId}
  `;
}

export async function fulfillStorePurchase({
  sessionId,
  productId,
  reservationToken,
  amountTotal,
  currency,
}: {
  sessionId: string;
  productId: StoreProductId;
  reservationToken: string;
  amountTotal: number | null;
  currency: string | null;
}) {
  await ensureStoreTables();
  const claimed = (await sql()`
    UPDATE clemi_store_inventory
    SET
      status = 'sold',
      reserved_until = NULL,
      sold_at = COALESCE(sold_at, NOW()),
      updated_at = NOW()
    WHERE
      product_id = ${productId}
      AND (
        (
          status = 'reserved'
          AND reservation_token = ${reservationToken}
          AND stripe_session_id = ${sessionId}
        )
        OR (status = 'sold' AND stripe_session_id = ${sessionId})
      )
    RETURNING product_id
  `) as Array<{ product_id: StoreProductId }>;

  if (!claimed.length) return null;

  await sql()`
    INSERT INTO clemi_store_purchases (
      stripe_session_id,
      product_id,
      amount_total,
      currency,
      reveal_expires_at
    )
    VALUES (
      ${sessionId},
      ${productId},
      ${amountTotal},
      ${currency},
      NOW() + INTERVAL '15 minutes'
    )
    ON CONFLICT (stripe_session_id) DO NOTHING
  `;

  return getStorePurchase(sessionId);
}

export async function getStorePurchase(
  sessionId: string,
): Promise<StorePurchase | null> {
  if (!databaseUrl()) return null;
  await ensureStoreTables();
  const rows = (await sql()`
    SELECT stripe_session_id, product_id, paid_at, reveal_expires_at
    FROM clemi_store_purchases
    WHERE stripe_session_id = ${sessionId}
    LIMIT 1
  `) as Array<{
    stripe_session_id: string;
    product_id: StoreProductId;
    paid_at: string | Date;
    reveal_expires_at: string | Date;
  }>;
  const row = rows[0];
  if (!row) return null;

  return {
    sessionId: row.stripe_session_id,
    productId: row.product_id,
    paidAt: new Date(row.paid_at),
    revealExpiresAt: new Date(row.reveal_expires_at),
  };
}
