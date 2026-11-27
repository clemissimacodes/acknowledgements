"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

function beacon(body: Record<string, unknown>) {
  const payload = JSON.stringify(body);
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon(
        "/api/friends/track",
        new Blob([payload], { type: "application/json" }),
      );
      return;
    }
  } catch {
    // fall through to fetch
  }
  void fetch("/api/friends/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => {
    /* ignore */
  });
}

/** Fire a Good Company analytics event from the shop UI. Fail-open. */
export function trackShopEvent(
  event: "add_to_bag" | "remove_from_bag",
  friendSlug: string,
  meta?: Record<string, unknown>,
) {
  if (!friendSlug) return;
  beacon({
    event,
    friendSlug,
    path: typeof window !== "undefined" ? window.location.pathname : "/",
    meta: meta ?? {},
  });
}

export function ShopTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;

    const product = pathname.match(/^\/products\/([a-z0-9]+(?:-[a-z0-9]+)*)$/i);
    const event = product ? "product_view" : "shop_view";
    const friendSlug = product ? product[1].toLowerCase() : undefined;
    const key = `gc:v1:${event}:${friendSlug ?? pathname}`;

    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // Still track when session storage is unavailable.
    }

    beacon({
      event,
      friendSlug,
      path: pathname,
    });
  }, [pathname]);

  return null;
}
