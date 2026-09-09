"use client";

import { useState } from "react";
import { createShortcutToken } from "@/app/admin/actions";

export function ShortcutTokenManager() {
  const [token, setToken] = useState("");
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);

  async function create(formData: FormData) {
    setWorking(true);
    setToken("");
    setMessage("");
    try {
      const result = await createShortcutToken(formData);
      setToken(result.plaintext);
      setMessage("Copy this token now. It cannot be shown again.");
    } catch {
      setMessage("The token could not be created.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="admin-calendar-sync">
      <form action={create}>
        <label>
          Shortcut name
          <input name="label" defaultValue="Clemi’s iPhone" maxLength={80} />
        </label>
        <button type="submit" disabled={working}>
          {working ? "Creating…" : "Create Shortcut token"}
        </button>
      </form>
      <p aria-live="polite">{message}</p>
      {token ? (
        <label>
          One-time token
          <input value={token} readOnly onFocus={(event) => event.target.select()} />
        </label>
      ) : null}
      <small>
        In Shortcuts: Get Current Location, then POST JSON fields
        <code> latitude</code> and <code> longitude</code> to
        <code> /api/radar/shortcut</code>. Set the Authorization header to
        <code> Bearer TOKEN</code>, then run it from a Personal Automation every
        30 or 60 minutes.
      </small>
    </div>
  );
}
