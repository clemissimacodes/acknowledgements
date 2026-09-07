import "server-only";

import type Stripe from "stripe";
import { getStoreProductById } from "@/lib/store-catalog";
import { fulfillStorePurchase } from "@/lib/store-db";

export async function fulfillPaidStoreSession(
  session: Stripe.Checkout.Session,
) {
  if (
    session.payment_status !== "paid" &&
    session.payment_status !== "no_payment_required"
  ) {
    return null;
  }

  const product = getStoreProductById(session.metadata?.productId ?? "");
  const reservationToken = session.metadata?.reservationToken;
  if (!product || !reservationToken) return null;
  if (session.amount_total !== product.priceInCents) return null;
  if (session.currency?.toLowerCase() !== "usd") return null;

  return fulfillStorePurchase({
    sessionId: session.id,
    productId: product.id,
    reservationToken,
    amountTotal: session.amount_total,
    currency: session.currency,
  });
}
