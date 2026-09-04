"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { safeAcknowledgementsNext } from "@/lib/ack-gate";

export function UnlockForm() {
  const search = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const response = await fetch("/api/acknowledgements/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!response.ok) {
      setBusy(false);
      setError("That is not the word.");
      return;
    }
    window.location.assign(safeAcknowledgementsNext(search.get("next")));
  }

  return (
    <form className="unlock-form" onSubmit={onSubmit}>
      <input
        type="password"
        name="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="password"
        autoComplete="current-password"
        autoFocus
      />
      <button type="submit" disabled={busy}>
        Open
      </button>
      {error ? <p className="unlock-error">{error}</p> : null}
    </form>
  );
}
