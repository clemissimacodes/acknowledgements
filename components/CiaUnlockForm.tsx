"use client";

import { useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { safeProtectedNext } from "@/lib/cia-gate";

export function CiaUnlockForm() {
  const search = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function showError() {
    setError("why would u even try");
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }

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
        showError();
        return;
      }

      window.location.assign(safeProtectedNext(search.get("next")));
    } catch {
      showError();
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
        ref={inputRef}
        id="cia-password"
        type="password"
        name="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        autoComplete="current-password"
        autoFocus
        placeholder="…"
        aria-invalid={Boolean(error)}
        aria-describedby="cia-unlock-feedback"
      />
      <button type="submit" disabled={busy}>
        open sesame
      </button>
      <p
        id="cia-unlock-feedback"
        className={error ? "cia-unlock-feedback cia-unlock-error" : "cia-unlock-feedback"}
        role={error ? "alert" : "status"}
        aria-live="polite"
      >
        {busy ? "…" : error}
      </p>
    </form>
  );
}
