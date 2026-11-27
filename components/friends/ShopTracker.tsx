"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

function beacon(body: Record<string, unknown>) {
  const payload = JSON.stringify(body);
  if (navigator.sendBeacon) {
    navigator.sendBeacon(
      "/api/friends/track",
      new Blob([payload], { type: "application/json" }),
    );
    return;
  }
  void fetch("/api/friends/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  });
}

export function trackShopEvent(
  event: "add_to_bag" | "remove_from_bag",
  friendSlug: string,
  path = typeof window !== "undefined" ? window.location.pathname : "/",
) {
  if (!friendSlug) return;
  beacon({ event, friendSlug, path });
}

export function ShopTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin") || pathname.startsWith("/controlroom")) {
      return;
    }

    const key = `gc:track:v1:${pathname}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // Tracking still works when session storage is unavailable.
    }

    const product = pathname.match(/^\/products\/([^/]+)\/?$/);
    if (product?.[1]) {
      beacon({
        event: "product_view",
        friendSlug: decodeURIComponent(product[1]),
        path: pathname,
      });
      return;
    }

    beacon({
      event: "shop_view",
      path: pathname,
    });
  }, [pathname]);

  return null;
}
