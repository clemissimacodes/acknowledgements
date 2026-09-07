import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckoutButton } from "@/components/store/CheckoutButton";
import {
  STORE_PRODUCTS,
  formatStorePrice,
  getStoreProductBySlug,
} from "@/lib/store-catalog";
import { listStoreInventory } from "@/lib/store-db";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return STORE_PRODUCTS.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const product = getStoreProductBySlug((await params).slug);
  return {
    title: product ? `${product.title} — Clemi Store` : "Clemi Store",
    robots: { index: false, follow: false },
  };
}

export default async function StoreProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ cancelled?: string }>;
}) {
  const product = getStoreProductBySlug((await params).slug);
  if (!product) notFound();

  const inventory = await listStoreInventory();
  const status = inventory.get(product.id) ?? "available";
  const sold = status === "sold";
  const reserved = status === "reserved";
  const cancelled = (await searchParams).cancelled === "1";

  return (
    <main className="store-page store-product-page">
      <header className="store-header">
        <Link className="store-wordmark" href="/secrets/shop">
          CLEMI STORE
        </Link>
        <p className="store-test-label">STRIPE TEST STORE — NO REAL CHARGES</p>
      </header>

      <article className="store-product">
        <div className="store-product-register" aria-hidden="true">
          <span>{product.id.toUpperCase()}</span>
          <span>{product.category.toUpperCase()}</span>
        </div>

        <div className="store-product-copy">
          <p className="store-eyebrow">PRIVATE INFORMATION</p>
          <h1>{product.title}</h1>
          <p className="store-product-tease">{product.tease}</p>
        </div>

        <aside className="store-product-purchase">
          <dl>
            <div>
              <dt>Price</dt>
              <dd>{formatStorePrice(product.priceInCents)}</dd>
            </div>
            <div>
              <dt>Edition</dt>
              <dd>{product.edition}</dd>
            </div>
            <div>
              <dt>Availability</dt>
              <dd>{sold ? "Sold" : reserved ? "In checkout" : "Available"}</dd>
            </div>
            <div>
              <dt>Delivery</dt>
              <dd>15-minute private reveal</dd>
            </div>
          </dl>

          {cancelled ? (
            <p className="store-cancelled">
              Checkout cancelled. The secret will return to stock when its
              reservation expires.
            </p>
          ) : null}

          <CheckoutButton
            productId={product.id}
            disabled={sold || reserved}
            label={
              sold
                ? "SOLD — SECRET OWNED"
                : reserved
                  ? "CURRENTLY RESERVED"
                  : "TEST PURCHASE"
            }
          />

          <div className="store-terms">
            <p>
              This is a Stripe sandbox. Test cards only; no real money is
              charged and this draft does not transfer ownership.
            </p>
            <p>
              For live items, the paid answer remains visible for 15 minutes.
              Stripe processes payment. Digital disclosures cannot be returned.
            </p>
            <p>
              Exclusivity means Clementine will not intentionally sell or
              disclose the secret again. A website cannot prevent its buyer
              from copying or sharing it.
            </p>
          </div>
        </aside>
      </article>
    </main>
  );
}
