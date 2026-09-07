import "server-only";

import type { StoreProductId } from "@/lib/store-catalog";

const STORE_SECRETS: Record<StoreProductId, string> = {
  "secret-001":
    "DRAFT SECRET — Clementine must replace this text before live checkout is enabled.",
  "secret-002":
    "DRAFT SECRET — Clementine must replace this text before live checkout is enabled.",
  "secret-003":
    "DRAFT SECRET — Clementine must replace this text before live checkout is enabled.",
  "secret-004":
    "DRAFT SECRET — Clementine must replace this text before live checkout is enabled.",
  "secret-005":
    "DRAFT SECRET — Clementine must replace this text before live checkout is enabled.",
  "secret-006":
    "DRAFT SECRET — Clementine must replace this text before live checkout is enabled.",
};

export function getStoreSecret(productId: StoreProductId) {
  return STORE_SECRETS[productId];
}
