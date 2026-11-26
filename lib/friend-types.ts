export const SHOP_NAME = "Good Company";
export const SHOP_HANDLE = "good-company";
export const SALE_NAME = "Friends & Family Sale";
export const DIARY_PATH = "/blogs/studio-diary/good-company";

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

export const MET_HOW = ["School", "Work", "Internet", "Mutuals", "Fate"] as const;

/* The "sizes". One is in stock per friend, the rest read as sold out. */
export const RELATIONSHIPS = ["Friend", "Family"] as const;

/* The "collection": the season we met, fashion-calendar style ("Fall 2024").
   Stored as "fall-2024", or just "2024" when the season is a blur. */
export const SEASONS = [
  { handle: "spring", label: "Spring" },
  { handle: "summer", label: "Summer" },
  { handle: "fall", label: "Fall" },
  { handle: "winter", label: "Winter" },
] as const;
export const COLLECTION_YEARS = Array.from({ length: 2026 - 2000 + 1 }, (_, i) => 2026 - i);

export function parseCollection(value: string): { year: number; season: number } | null {
  const m = /^(?:(spring|summer|fall|winter)-)?(\d{4})$/.exec(value || "");
  if (!m) return null;
  const year = Number(m[2]);
  if (year < 1900 || year > 2100) return null;
  const season = m[1] ? SEASONS.findIndex((s) => s.handle === m[1]) + 1 : 0;
  return { year, season };
}

export function isCollection(value: unknown): value is string {
  return typeof value === "string" && parseCollection(value) !== null;
}

export function collectionLabel(value: string) {
  const c = parseCollection(value);
  if (!c) return "";
  return c.season ? `${SEASONS[c.season - 1].label} ${c.year}` : String(c.year);
}

/* Sortable: earlier collections sort first; a year without a season sorts before its seasons. */
export function collectionOrder(value: string) {
  const c = parseCollection(value);
  return c ? c.year * 10 + c.season : Number.POSITIVE_INFINITY;
}

/* Rough season for a YYYY-MM-DD, used once to backfill from exact dates. */
export function collectionFromDate(date: string) {
  const [y, m] = date.split("-").map(Number);
  if (!y || !m) return "";
  const season = m <= 2 || m === 12 ? "winter" : m <= 5 ? "spring" : m <= 8 ? "summer" : "fall";
  return `${season}-${y}`;
}

export type FriendColor = { name: string; hex: string };

export type Friend = {
  id: string;
  slug: string;
  nickname: string;
  productName: string;
  era: FriendEra;
  badge: FriendBadge;
  metOn: string; // YYYY-MM-DD (exact date when known; still sets the price)
  collection: string; // "fall-2024" | "2024" | ""
  metHow: string;
  hometown: string;
  madeOf: string[];
  care: string;
  description: string;
  favoriteMemory: string;
  favoriteTrait: string;
  notes: string; // backroom only
  poemTitle: string; // a poem from elsewhere that reminds me of them
  poemPoet: string;
  poemUrl: string;
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
