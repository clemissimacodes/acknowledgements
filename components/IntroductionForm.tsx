"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { safeIntroductionNext } from "@/lib/intro-gate";

export function IntroductionForm() {
  const search = useSearchParams();
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSending(true);

    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/introduction", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tinyThing: form.get("tinyThing"),
        website: form.get("website"),
      }),
    }).catch(() => null);

    setSending(false);
    if (!response) {
      setError("The little door could not be reached.");
      return;
    }

    const result = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    if (!response.ok) {
      setError(result.error ?? "Your introduction could not be saved.");
      return;
    }

    window.location.assign(safeIntroductionNext(search.get("next")));
  }

  return (
    <form className="intro-form" onSubmit={submit}>
      <label>
        <textarea
          name="tinyThing"
          required
          minLength={3}
          maxLength={400}
          rows={3}
          placeholder="something small, strange, sweet, or true…"
          autoFocus
        />
      </label>

      <p className="intro-privacy">kept private, just for Clementine.</p>

      <label className="intro-honey" aria-hidden="true">
        Website
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>

      <button type="submit" disabled={sending}>
        {sending ? "opening…" : "discover"}
      </button>
      {error ? <p className="unlock-error">{error}</p> : null}
    </form>
  );
}
