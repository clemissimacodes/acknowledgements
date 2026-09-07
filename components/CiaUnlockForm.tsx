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
        setError("why would u even try");
        return;
      }

      window.location.assign(safeProtectedNext(search.get("next")));
    } catch {
      setError("why would u even try");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="cia-unlock-form" onSubmit={onSubmit}>
      <label className="visually-hidden" htmlFor="cia-password">
        Password
      </label>
      <input
        id="cia-password"
        type="password"
        name="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        autoComplete="current-password"
        autoFocus
      />
      <button type="submit" disabled={busy}>
        open sesame
      </button>
      {error ? (
        <p className="cia-unlock-error" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
