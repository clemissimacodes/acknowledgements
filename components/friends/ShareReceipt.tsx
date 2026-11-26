"use client";

import { useState } from "react";

export function ShareReceipt({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const url = `${window.location.origin}/receipt/${id}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: `Receipt FF-${id}`, url });
        return;
      } catch {
        /* fall through to copy */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("Copy this link", url);
    }
  };

  return (
    <div className="ff-receipt-actions">
      <button type="button" className="ff-pill ff-pill-dark" onClick={share}>
        {copied ? "Link copied" : "Share receipt"}
      </button>
      <button type="button" className="ff-pill" onClick={() => window.print()}>
        Print
      </button>
    </div>
  );
}
