"use client";

import { useState } from "react";

export function PostiesForm() {
  const [platform, setPlatform] = useState<"instagram" | "x">("instagram");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSending(true);

    const form = new FormData(event.currentTarget);
    const mailingAddress = [
      form.get("streetAddress"),
      form.get("cityRegionPostal"),
      form.get("country"),
    ]
      .map((line) => String(line ?? "").trim())
      .filter(Boolean)
      .join("\n");
    const response = await fetch("/api/sunday-posties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        platform,
        social: form.get("social"),
        mailingAddress,
        consent: form.get("consent") === "yes",
        website: form.get("website"),
      }),
    }).catch(() => null);

    setSending(false);
    if (!response) {
      setError("The postbox could not be reached.");
      return;
    }

    const result = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    if (!response.ok) {
      setError(result.error ?? "The postie could not be sent.");
      return;
    }

    setSent(true);
  }

  if (sent) {
    return (
      <p className="posties-thanks">
        You are in the postbox. Keep watch for a doodle or caboodle. ♡
      </p>
    );
  }

  return (
    <form className="posties-form" onSubmit={submit}>
      <label>
        <span>your name</span>
        <input
          name="name"
          required
          minLength={2}
          maxLength={80}
          autoComplete="name"
        />
      </label>

      <fieldset>
        <legend>prove you are a real friendly</legend>
        <div className="posties-platforms">
          <label>
            <input
              type="radio"
              name="platform"
              value="instagram"
              checked={platform === "instagram"}
              onChange={() => setPlatform("instagram")}
            />
            Instagram
          </label>
          <label>
            <input
              type="radio"
              name="platform"
              value="x"
              checked={platform === "x"}
              onChange={() => setPlatform("x")}
            />
            X
          </label>
        </div>
        <input
          name="social"
          required
          maxLength={200}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder={platform === "instagram" ? "@instagram" : "@xhandle"}
          aria-label={`${platform === "instagram" ? "Instagram" : "X"} handle or profile link`}
        />
      </fieldset>

      <fieldset className="posties-address">
        <legend>where should the postie go?</legend>
        <div className="posties-address-lines">
          <input
            name="streetAddress"
            required
            maxLength={200}
            autoComplete="address-line1"
            placeholder="Street address"
            aria-label="Street address"
          />
          <input
            name="cityRegionPostal"
            required
            maxLength={200}
            autoComplete="off"
            placeholder="City, state, postal code"
            aria-label="City, state, and postal code"
          />
          <input
            name="country"
            required
            maxLength={100}
            autoComplete="country-name"
            placeholder="Country"
            aria-label="Country"
          />
        </div>
      </fieldset>

      <label className="posties-consent">
        <input name="consent" type="checkbox" value="yes" required />
        <span>
          I will doodle or caboodle back. Clementine may privately use this
          address only to send me posties.
        </span>
      </label>

      <label className="posties-honey" aria-hidden="true">
        Website
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>

      <button type="submit" disabled={sending}>
        {sending ? "walking to the postbox…" : "send me a Sunday Postie"}
      </button>
      {error ? <p className="unlock-error">{error}</p> : null}
    </form>
  );
}
