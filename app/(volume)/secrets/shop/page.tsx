import type { Metadata } from "next";
import Link from "next/link";
import { STORE_PRODUCTS, formatStorePrice } from "@/lib/store-catalog";
import { listStoreInventory } from "@/lib/store-db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Clemi Store",
  description: "One secret. One buyer. No restocks.",
};

export default async function StorePage() {
  const inventory = await listStoreInventory();

  return (
    <main className="store-page">
      <header className="store-header">
        <p className="store-wordmark">CLEMI STORE</p>
        <p className="store-test-label">STRIPE TEST STORE — NO REAL CHARGES</p>
      </header>

      <section className="store-intro" aria-labelledby="store-title">
        <p className="store-eyebrow">PRIVATE INFORMATION / EDITION 01</p>
        <h1 id="store-title">Secrets about me that no one else knows.</h1>
        <p>
          Every item is one of one. After purchase, the secret is shown to its
          owner for fifteen minutes and the listing is never stocked again.
        </p>
      </section>

      <ol className="store-grid">
        {STORE_PRODUCTS.map((product, index) => {
          const status = inventory.get(product.id) ?? "available";
          const sold = status === "sold";
          const reserved = status === "reserved";

          return (
            <li className="store-card" key={product.id}>
              <Link href={`/secrets/shop/${product.slug}`}>
                <span className="store-card-number">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="store-card-category">{product.category}</span>
                <h2>{product.title}</h2>
                <span className="store-card-tease">{product.tease}</span>
                <span className="store-card-bottom">
                  <span>{product.edition}</span>
                  <span>
                    {sold
                      ? "SOLD"
                      : reserved
                        ? "IN CHECKOUT"
                        : formatStorePrice(product.priceInCents)}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>

      <footer className="store-footer">
        <p>All sales are final because all disclosures are irreversible.</p>
        <Link href="/privacy">Privacy</Link>
      </footer>
    </main>
  );
}
