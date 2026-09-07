import type { Metadata } from "next";
import { SecretReveal } from "@/components/store/SecretReveal";
import { getStoreProductById } from "@/lib/store-catalog";
import { getStorePurchase } from "@/lib/store-db";
import { fulfillPaidStoreSession } from "@/lib/store-fulfillment";
import { getStoreSecret } from "@/lib/store-secrets";
import { stripeClient } from "@/lib/stripe";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Private Reveal — Clemi Store",
  robots: { index: false, follow: false, noarchive: true },
  referrer: "no-referrer",
};

function RevealMessage({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className="store-page store-reveal-page">
      <p className="store-wordmark">CLEMI STORE / PRIVATE DELIVERY</p>
      <section className="store-receipt">
        <p className="store-eyebrow">ORDER STATUS</p>
        <h1>{title}</h1>
        <div className="store-receipt-message">{children}</div>
      </section>
    </main>
  );
}

export default async function StoreRevealPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string | string[] }>;
}) {
  const rawSessionId = (await searchParams).session_id;
  const sessionId = typeof rawSessionId === "string" ? rawSessionId : "";
  if (!sessionId.startsWith("cs_") || sessionId.length > 255) {
    return (
      <RevealMessage title="Receipt not found">
        <p>This private delivery link is invalid.</p>
      </RevealMessage>
    );
  }

  try {
    const session = await stripeClient().checkout.sessions.retrieve(sessionId);
    if (
      session.payment_status !== "paid" &&
      session.payment_status !== "no_payment_required"
    ) {
      return (
        <RevealMessage title="Payment pending">
          <p>The secret will appear only after Stripe confirms payment.</p>
        </RevealMessage>
      );
    }

    await fulfillPaidStoreSession(session);
    const purchase = await getStorePurchase(session.id);
    const product = purchase
      ? getStoreProductById(purchase.productId)
      : undefined;

    if (!purchase || !product) {
      return (
        <RevealMessage title="Delivery unavailable">
          <p>
            Payment was received, but the secret could not be matched. Contact
            Clementine with the receipt ID shown by Stripe.
          </p>
        </RevealMessage>
      );
    }

    if (purchase.revealExpiresAt.getTime() <= Date.now()) {
      return (
        <RevealMessage title="Reveal expired">
          <p>The fifteen-minute disclosure window has closed.</p>
        </RevealMessage>
      );
    }

    return (
      <main className="store-page store-reveal-page">
        <header className="store-reveal-header">
          <p className="store-wordmark">CLEMI STORE / PRIVATE DELIVERY</p>
          <p>ORDER {session.id.slice(-10).toUpperCase()}</p>
        </header>
        <article className="store-receipt">
          <p className="store-eyebrow">SOLD / EDITION {product.edition}</p>
          <h1>{product.title}</h1>
          <SecretReveal
            secret={getStoreSecret(product.id)}
            expiresAt={purchase.revealExpiresAt.toISOString()}
          />
        </article>
      </main>
    );
  } catch (error) {
    console.error("Clemi Store reveal failed", error);
    return (
      <RevealMessage title="Delivery unavailable">
        <p>This receipt could not be verified. Please try again shortly.</p>
      </RevealMessage>
    );
  }
}
