"use client";

import { useRef, useState } from "react";
import styles from "./SecretsUnlockForm.module.css";

function napLength(seconds: number) {
  if (seconds < 90) return "a minute";
  if (seconds < 3600) return `${Math.ceil(seconds / 60)} minutes`;
  const hours = Math.ceil(seconds / 3600);
  return hours === 1 ? "an hour" : `${hours} hours`;
}

export function SecretsUnlockForm() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [password, setPassword] = useState("");
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);

  function fail(message: string) {
    setFeedback(message);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setFeedback("");

    try {
      const response = await fetch("/api/secrets/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (response.ok) {
        window.location.assign("/secrets");
        return;
      }

      if (response.status === 429) {
        const body = (await response.json().catch(() => ({}))) as {
          retryAfterSeconds?: number;
        };
        fail(
          `too many guesses. the door is napping for ${napLength(
            Number(body.retryAfterSeconds) || 60,
          )}.`,
        );
        return;
      }

      fail("why would u even try");
    } catch {
      fail("why would u even try");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={onSubmit}>
      <label className="visually-hidden" htmlFor="secrets-password">
        Password
      </label>
      <input
        ref={inputRef}
        id="secrets-password"
        className={styles.input}
        type="password"
        name="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        maxLength={200}
        autoFocus
        placeholder="…"
        aria-invalid={Boolean(feedback)}
        aria-describedby="secrets-feedback"
      />
      <button className={styles.button} type="submit" disabled={busy}>
        {busy ? "…" : "open sesame"}
      </button>
      <p
        id="secrets-feedback"
        className={styles.feedback}
        role={feedback ? "alert" : "status"}
        aria-live="polite"
      >
        {feedback}
      </p>
    </form>
  );
}
