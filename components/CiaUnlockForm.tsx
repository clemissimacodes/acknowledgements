"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { safeProtectedNext } from "@/lib/cia-gate";

export function CiaUnlockForm() {
  const search = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/secrets/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        setError("Clearance denied.");
        return;
      }

      window.location.assign(safeProtectedNext(search.get("next")));
    } catch {
      setError("The clearance desk is unavailable.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="cia-unlock-form" onSubmit={onSubmit}>
      <label htmlFor="cia-password">Clearance phrase</label>
      <input
        id="cia-password"
        type="password"
        name="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="enter phrase"
        autoComplete="current-password"
        autoFocus
      />
      <button type="submit" disabled={busy}>
        {busy ? "Checking…" : "Request access"}
      </button>
      {error ? (
        <p className="cia-unlock-error" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
