"use client";

import { useEffect, useState } from "react";

function remainingLabel(milliseconds: number) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

export function SecretReveal({
  secret,
  expiresAt,
}: {
  secret: string;
  expiresAt: string;
}) {
  const expiry = new Date(expiresAt).getTime();
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    setRemaining(Math.max(0, expiry - Date.now()));
    const interval = window.setInterval(() => {
      setRemaining(Math.max(0, expiry - Date.now()));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [expiry]);

  if (remaining !== null && remaining <= 0) {
    return (
      <div className="store-secret-expired">
        <p>REVEAL EXPIRED</p>
        <p>The fifteen-minute disclosure window has closed.</p>
      </div>
    );
  }

  return (
    <>
      <p className="store-reveal-timer" aria-live="polite">
        {remaining === null
          ? "PRIVATE VIEW ACTIVE"
          : `PRIVATE VIEW EXPIRES IN ${remainingLabel(remaining)}`}
      </p>
      <div className="store-secret" aria-label="Purchased secret">
        <p>{secret}</p>
      </div>
      <p className="store-reveal-warning">
        Read carefully. This page will not display the secret after the timer
        reaches zero.
      </p>
    </>
  );
}
