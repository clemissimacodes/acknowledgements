export const SHOP_NAME = "Friends & Family";
export const SHOP_HANDLE = "friends-and-family";

/* Backroom only until Clementine says go. When false, every shop route
   and the checkout API 404 for anyone who is not the owner. */
export const SHOP_LIVE = false;

export const FRIEND_ERAS = [
  { handle: "childhood", label: "Childhood" },
  { handle: "vanderbilt", label: "Vanderbilt" },
  { handle: "san-francisco", label: "San Francisco" },
  { handle: "new-york-city", label: "New York City" },
  { handle: "new-arrivals", label: "New Arrivals" },
] as const;
export type FriendEra = (typeof FRIEND_ERAS)[number]["handle"];

export const FRIEND_BADGES = {
  none: "",
  "one-of-one": "One of One",
  "new-arrival": "New Arrival",
  "final-few": "Final Few",
  "back-in-stock": "Back in Stock",
} as const;
export type FriendBadge = keyof typeof FRIEND_BADGES;

export const MET_HOW = [
  "School",
  "Work",
  "The Internet",
  "Through a Friend",
  "Family",
  "Pure Chance",
] as const;

export type FriendColor = { name: string; hex: string };

export type Friend = {
  id: string;
  slug: string;
  nickname: string;
  productName: string;
  era: FriendEra;
  badge: FriendBadge;
  metOn: string; // YYYY-MM-DD
  metHow: string;
  hometown: string;
  madeOf: string[];
  care: string;
  description: string;
  relationship: string;
  relationshipOptions: string[];
  colors: FriendColor[];
  heroUrl: string | null;
  heroPathname: string | null;
  altUrl: string | null;
  altPathname: string | null;
  pairsWith: string[];
  visible: boolean;
  sortOrder: number;
  createdAt: string;
};

export type ReceiptItem = {
  slug: string;
  nickname: string;
  productName: string;
  price: string;
  heroUrl: string | null;
};

export type Receipt = {
  id: string;
  items: ReceiptItem[];
  note: string;
  createdAt: string;
};

export const FRIEND_IMAGE_MAX_BYTES = 12 * 1024 * 1024;
export const IMAGE_CONTENT_TYPES = ["image/png", "image/jpeg", "image/webp", "image/avif"];

export function isFriendEra(value: unknown): value is FriendEra {
  return FRIEND_ERAS.some((era) => era.handle === value);
}

export function isFriendBadge(value: unknown): value is FriendBadge {
  return typeof value === "string" && value in FRIEND_BADGES;
}

export function eraLabel(handle: string) {
  return FRIEND_ERAS.find((era) => era.handle === handle)?.label ?? handle;
}

/* The price is the date we met, in hundreds: Sep 15 -> $ 915, Dec 24 -> $ 1,224 */
export function friendPrice(metOn: string) {
  const [, month, day] = metOn.split("-").map(Number);
  if (!month || !day) return "0";
  return `${month}${String(day).padStart(2, "0")}`;
}

export function formatPrice(value: number | string) {
  return Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export function formatMetOn(metOn: string) {
  const [y, m, d] = metOn.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function daysKnown(metOn: string, now = new Date()) {
  const [y, m, d] = metOn.split("-").map(Number);
  const start = Date.UTC(y, m - 1, d);
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.max(0, Math.round((today - start) / 86_400_000));
}

/* Days until the next anniversary of the day we met (0 = today). */
export function daysToFriendiversary(metOn: string, now = new Date()) {
  const [, m, d] = metOn.split("-").map(Number);
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  let next = Date.UTC(now.getUTCFullYear(), m - 1, d);
  if (next < today) next = Date.UTC(now.getUTCFullYear() + 1, m - 1, d);
  return Math.round((next - today) / 86_400_000);
}

export function friendiversaryLabel(metOn: string) {
  const [, m, d] = metOn.split("-").map(Number);
  return new Date(Date.UTC(2000, m - 1, d)).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "long",
    day: "numeric",
  });
}

export function slugifyFriend(value: string) {
  return (
    value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "friend"
  );
}
