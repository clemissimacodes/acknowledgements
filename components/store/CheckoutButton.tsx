"use client";

import { useState } from "react";

export function CheckoutButton({
  productId,
  disabled,
  label,
}: {
  productId: string;
  disabled: boolean;
  label: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function checkout() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/shop/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ productId }),
      });
      const data = (await response.json()) as {
        checkoutUrl?: string;
        error?: string;
      };

      if (!response.ok || !data.checkoutUrl) {
        throw new Error(data.error ?? "Checkout could not be opened.");
      }

      window.location.assign(data.checkoutUrl);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Checkout could not be opened.",
      );
      setLoading(false);
    }
  }

  return (
    <div className="store-checkout">
      <button type="button" onClick={checkout} disabled={disabled || loading}>
        {loading ? "RESERVING SECRET…" : label}
      </button>
      {error ? (
        <p className="store-checkout-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
