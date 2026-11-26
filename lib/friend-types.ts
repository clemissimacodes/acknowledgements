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

/* "Made of": the composition label. Pick two or three per person. */
export const MADE_OF = [
  "Loyalty", "Warmth", "Mischief", "Dry wit", "Chaos", "Calm", "Curiosity", "Stubbornness",
  "Generosity", "Nerve", "Patience", "Hustle", "Softness", "Grit", "Sunshine", "Deadpan",
  "Earnestness", "Whimsy", "Steadiness", "Spontaneity", "Tenderness", "Ambition", "Honesty",
  "Nonsense", "Restraint", "Backbone", "Gentleness", "Drama", "Competitiveness", "Wonder",
  "Charm", "Brains", "Taste", "Volume", "Quiet", "Discipline", "Romance", "Skepticism",
  "Optimism", "Appetite", "Courage", "Goofiness", "Precision", "Depth", "Swagger", "Kindness",
  /* Materials. The kind of thing a fabric label would say if it were about a person. */
  "Moonlight", "Honey", "Thunder", "Velvet", "Sea salt", "Cinnamon", "Starlight", "Wildflowers",
  "Birdsong", "Old gold", "Warm rain", "Embers", "Linen", "Driftwood", "Clover", "Marmalade",
  "Fireflies", "Stardust", "Candlelight", "Dandelion fluff", "Peach fuzz", "Sunday mornings",
  "Saltwater", "Lightning", "Amber", "Petrichor", "Lavender", "Fresh bread", "Porch light",
  "Soft wool", "Harbor light", "Quartz", "Lullabies", "Apricot", "Hearth fire", "Wintergreen",
  "Cold brew", "Summer dusk", "River stones", "Good bones", "Late-night laughter", "Bergamot",
  "Open windows", "First snow", "Clementine peel", "Train-window light", "Pocket change", "Iron",
  "Silk thread", "Morning fog", "Blue hour", "Tide pools", "Sparklers", "Pressed flowers",
  "Long summers", "Mixtapes", "Butter", "Handwritten notes", "Sunlit dust", "Cedar", "Spring thaw",
  "Loud music", "Deep water", "Held doors", "Unhurried afternoons", "Campfire smoke", "Nectar",
  "Brown sugar", "Sea glass", "Tangerine", "Wet paint", "Orchard air", "Rosewater", "Maple",
  "Quiet thunder", "Second helpings", "Pine needles", "Ocean floor", "Lemon zest", "Firelight",
  "Night swimming", "Tall grass", "Riverbank", "Half-moons", "Warm bread", "Rooftop air",
  "Parade confetti", "Clean sheets", "Late trains", "Red wine", "Rain on tin", "Window seats",
  "Hot tea", "Cardamom", "Snow light", "Loose change", "Ripe figs", "Feathers", "Oak",
  "Coral", "Thunderclaps", "Sunday pancakes", "Cloudbreak", "Salt air", "Pocket warmth",
  "Lantern glow", "Good gossip", "Dog-eared pages", "Slow dances", "Lake water", "Wild honey",
  "Soft landings", "Fresh ink", "Golden hour", "Jasmine", "Bare feet", "Last light", "Road trips",
  "Birthday candles", "Garden dirt", "Summer rain", "Blown kisses", "Polaroids", "Lilac",
  "Loud laughter", "Kitchen dancing", "Spilled sugar", "Saffron", "Meteor showers", "Moss",
  "Paper lanterns", "Belly laughs", "Open roads", "Cherry stems", "Still water", "Lemonade",
  "Shared umbrellas", "Puppy fat", "Nutmeg", "Bonfire", "Seafoam", "Warm hands", "Fig jam",
  "Kite string", "Crickets", "Dawn chorus", "Gold leaf", "Comfortable silence", "Cocoa",
] as const;
export const MADE_OF_MAX = 3;

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


export type FriendColor = { name: string; hex: string };

export type Friend = {
  id: string;
  slug: string;
  nickname: string;
  productName: string;
  era: FriendEra;
  badge: FriendBadge;
  birthday: string; // "MM-DD"; the price
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

/* Every frame on the public site is 4:5 (grid card, product page, bag drawer).
   Uploads are cropped to this in the browser before they reach Blob, so what
   you see in the control room is exactly what the shop will show.
   Hero cutouts anchor to the bottom (feet stay in); candids anchor to the centre. */
export const IMAGE_SLOTS = {
  hero: { width: 1200, height: 1500, anchor: "bottom" },
  alt: { width: 1200, height: 1500, anchor: "center" },
} as const satisfies Record<string, { width: number; height: number; anchor: "bottom" | "center" }>;
export type ImageSlot = keyof typeof IMAGE_SLOTS;
/* What Blob is allowed to store. HEIC is accepted at the drop zone and converted to JPEG first. */
export const IMAGE_CONTENT_TYPES = ["image/png", "image/jpeg", "image/webp", "image/avif"];
export const HEIC_CONTENT_TYPES = ["image/heic", "image/heif", "image/heic-sequence", "image/heif-sequence"];
export const IMAGE_ACCEPT = [...IMAGE_CONTENT_TYPES, ...HEIC_CONTENT_TYPES, ".heic", ".heif"].join(",");

/* Browsers often leave `type` empty for HEIC, so the extension counts too. */
export function isHeicFile(file: File) {
  return HEIC_CONTENT_TYPES.includes(file.type) || /\.hei[cf]$/i.test(file.name);
}

export function isFriendEra(value: unknown): value is FriendEra {
  return FRIEND_ERAS.some((era) => era.handle === value);
}

export function isFriendBadge(value: unknown): value is FriendBadge {
  return typeof value === "string" && value in FRIEND_BADGES;
}

export function eraLabel(handle: string) {
  return FRIEND_ERAS.find((era) => era.handle === handle)?.label ?? handle;
}

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

export function isBirthday(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const m = /^(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const month = Number(m[1]);
  const day = Number(m[2]);
  return month >= 1 && month <= 12 && day >= 1 && day <= 31;
}

/* The price is their birthday, in hundreds: Sep 15 -> $ 915, Dec 24 -> $ 1,224.
   Empty when the birthday is not filled in yet. */
export function friendPrice(birthday: string) {
  if (!isBirthday(birthday)) return "";
  const [month, day] = birthday.split("-").map(Number);
  return `${month}${String(day).padStart(2, "0")}`;
}

export function formatPrice(value: number | string) {
  return Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: 0 });
}

/* "$ 915 USD", or the luxury-store shrug when the birthday is not filled in. */
export function priceLabel(birthday: string) {
  const price = friendPrice(birthday);
  return price ? `$ ${formatPrice(price)} USD` : "Price upon request";
}

export function formatBirthday(birthday: string) {
  if (!isBirthday(birthday)) return "";
  const [m, d] = birthday.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}`;
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
