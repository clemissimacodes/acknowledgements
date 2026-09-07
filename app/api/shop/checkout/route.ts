import { NextResponse } from "next/server";
import { getStoreProductById } from "@/lib/store-catalog";
import {
  attachStoreCheckoutSession,
  releaseStoreReservation,
  reserveStoreProduct,
} from "@/lib/store-db";
import { stripeClient } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let productId = "";
  try {
    const body = (await request.json()) as { productId?: unknown };
    productId = typeof body.productId === "string" ? body.productId : "";
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const product = getStoreProductById(productId);
  if (!product) {
    return NextResponse.json({ error: "Secret not found." }, { status: 404 });
  }
  if (
    product.testOnly &&
    !process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_")
  ) {
    return NextResponse.json(
      { error: "Draft secrets cannot be purchased in live mode." },
      { status: 503 },
    );
  }

  let reservationToken: string | null = null;
  try {
    reservationToken = await reserveStoreProduct(product.id);
    if (!reservationToken) {
      return NextResponse.json(
        { error: "Someone else has already reserved this secret." },
        { status: 409 },
      );
    }

    const origin = new URL(request.url).origin;
    const session = await stripeClient().checkout.sessions.create({
      mode: "payment",
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
      success_url: `${origin}/secrets/shop/reveal?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/secrets/shop/${product.slug}?cancelled=1`,
      client_reference_id: product.id,
      metadata: {
        productId: product.id,
        reservationToken,
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: product.priceInCents,
            product_data: {
              name: product.title,
              description: `${product.tease} Edition ${product.edition}.`,
              metadata: { productId: product.id },
            },
          },
        },
      ],
    });

    if (!session.url) throw new Error("Stripe did not return a checkout URL.");

    const attached = await attachStoreCheckoutSession(
      product.id,
      reservationToken,
      session.id,
    );
    if (!attached) {
      await stripeClient().checkout.sessions.expire(session.id);
      throw new Error("The reservation could not be attached.");
    }

    return NextResponse.json({ checkoutUrl: session.url });
  } catch (error) {
    if (reservationToken) {
      await releaseStoreReservation(product.id, reservationToken).catch(
        () => undefined,
      );
    }
    console.error("Clemi Store checkout failed", error);
    return NextResponse.json(
      { error: "Checkout is temporarily unavailable." },
      { status: 500 },
    );
  }
}
