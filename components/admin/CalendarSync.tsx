"use client";

import { useUser } from "@clerk/nextjs";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { syncCalendarNow } from "@/app/admin/actions";

const CALENDAR_SCOPE =
  "https://www.googleapis.com/auth/calendar.readonly";

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
  const { isLoaded, user } = useUser();
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState(lastSyncError ?? "");
  const googleAccount = user?.externalAccounts.find(
    (account) => account.provider === "google",
  );
  const hasCalendarAccess =
    googleAccount?.approvedScopes
      .split(" ")
      .includes(CALENDAR_SCOPE) ?? false;

  async function sync() {
    setSyncing(true);
    setMessage("");

    try {
      if (!isLoaded) {
        setMessage("Loading your Google connection…");
        return;
      }

      if (!googleAccount) {
        setMessage("Sign in with Google before connecting Calendar.");
        return;
      }

      if (!hasCalendarAccess) {
        setMessage("Opening Google to approve Calendar read access…");
        const account = await googleAccount.reauthorize({
          additionalScopes: [CALENDAR_SCOPE],
          redirectUrl: `${window.location.origin}/controlroom`,
        });
        const redirectUrl =
          account.verification?.externalVerificationRedirectURL;
        if (!redirectUrl) {
          throw new Error("Google authorization could not be opened.");
        }
        window.location.assign(redirectUrl.href);
        return;
      }

      setMessage("Reading city-level Calendar locations…");
      const result = await syncCalendarNow();
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setMessage(
        `Calendar synced. ${result.processed} location${result.processed === 1 ? "" : "s"} added or refreshed as private drafts.`,
      );
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Calendar sync failed.",
      );
    } finally {
      setSyncing(false);
    }
  }

  const canSync = isLoaded ? hasCalendarAccess : connected;

  return (
    <div className="admin-calendar-sync">
      <button type="button" onClick={sync} disabled={syncing}>
        {syncing ? "Working…" : canSync ? "Sync GCal now" : "Connect GCal"}
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
