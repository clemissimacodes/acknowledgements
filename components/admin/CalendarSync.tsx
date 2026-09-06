"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { syncCalendarNow } from "@/app/admin/actions";

export function CalendarSync({
  connected,
  lastSyncedAt,
  lastSyncError,
}: {
  connected: boolean;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
}) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState(lastSyncError ?? "");

  async function sync() {
    setSyncing(true);
    setMessage("Reading city-level Calendar locations…");
    const result = await syncCalendarNow();
    setSyncing(false);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    setMessage(
      `Calendar synced. ${result.processed} location${result.processed === 1 ? "" : "s"} added or refreshed as private drafts.`,
    );
    router.refresh();
  }

  return (
    <div className="admin-calendar-sync">
      <button type="button" onClick={sync} disabled={syncing}>
        {syncing ? "Syncing GCal…" : connected ? "Sync GCal now" : "Connect GCal"}
      </button>
      <p aria-live="polite">{message}</p>
      {lastSyncedAt ? (
        <small>Last sync: {new Date(lastSyncedAt).toLocaleString()}</small>
      ) : null}
      <small>
        If Google asks for access, open your profile and reconnect Google with
        Calendar read-only permission. Event titles, attendees, and exact
        addresses are not stored.
      </small>
    </div>
  );
}
