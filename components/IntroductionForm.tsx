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
        name: form.get("name"),
        location: form.get("location"),
        foundVia: form.get("foundVia"),
        tinyThing: form.get("tinyThing"),
        consent: form.get("consent") === "yes",
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
        <span>what should I call you?</span>
        <input
          name="name"
          required
          minLength={2}
          maxLength={80}
          autoComplete="name"
          placeholder="a name or alias"
        />
      </label>

      <label>
        <span>where in the world are you?</span>
        <input
          name="location"
          required
          minLength={2}
          maxLength={120}
          autoComplete="address-level2"
          placeholder="city, country"
        />
      </label>

      <label>
        <span>how did you find me?</span>
        <input
          name="foundVia"
          required
          minLength={3}
          maxLength={240}
          placeholder="a friend, the internet, real life…"
        />
      </label>

      <label>
        <span>tell me one teeny tiny thing about you</span>
        <textarea
          name="tinyThing"
          required
          minLength={3}
          maxLength={400}
          rows={3}
        />
      </label>

      <label className="intro-consent">
        <input name="consent" type="checkbox" value="yes" required />
        <span>
          Clementine may privately store this introduction to understand who
          visits her work.
        </span>
      </label>

      <label className="intro-honey" aria-hidden="true">
        Website
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>

      <button type="submit" disabled={sending}>
        {sending ? "opening…" : "let me in"}
      </button>
      {error ? <p className="unlock-error">{error}</p> : null}
    </form>
  );
}
