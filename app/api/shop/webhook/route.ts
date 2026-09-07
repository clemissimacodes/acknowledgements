import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { releaseStoreReservationBySession } from "@/lib/store-db";
import { fulfillPaidStoreSession } from "@/lib/store-fulfillment";
import { stripeClient } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) {
    return NextResponse.json(
      { error: "Webhook is not configured." },
      { status: 503 },
    );
  }

  let event: Stripe.Event;
  try {
    const body = await request.text();
    event = stripeClient().webhooks.constructEvent(
      body,
      signature,
      webhookSecret,
    );
  } catch {
    return NextResponse.json(
      { error: "Invalid webhook signature." },
      { status: 400 },
    );
  }

  try {
    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      await fulfillPaidStoreSession(event.data.object);
    }

    if (
      event.type === "checkout.session.expired" ||
      event.type === "checkout.session.async_payment_failed"
    ) {
      await releaseStoreReservationBySession(event.data.object.id);
    }
  } catch (error) {
    console.error("Clemi Store webhook fulfillment failed", error);
    return NextResponse.json({ error: "Fulfillment failed." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
