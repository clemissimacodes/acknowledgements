"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function VisitTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (
      !pathname ||
      pathname.startsWith("/admin") ||
      pathname.startsWith("/controlroom")
    ) {
      return;
    }
    const key = `visit:${pathname}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // Tracking still works when session storage is unavailable.
    }

    const body = JSON.stringify({
      path: pathname,
      referrer: document.referrer,
    });
    if (navigator.sendBeacon) {
      navigator.sendBeacon(
        "/api/visit",
        new Blob([body], { type: "application/json" }),
      );
      return;
    }
    void fetch("/api/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    });
  }, [pathname]);

  return null;
}
