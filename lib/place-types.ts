// Shared by the server (lib/places.ts) and the map itself, so nothing here may
// touch the database.

export type PlaceKind = "visited" | "hometown" | "current";

export type Place = {
  id: string;
  name: string;
  country: string;
  lat: number;
  lng: number;
  kind: PlaceKind;
  month: number | null;
  year: number | null;
  reason: string;
};

export type PlaceInput = {
  name: string;
  country: string;
  lat: number;
  lng: number;
  kind: PlaceKind;
  month: number | null;
  year: number | null;
  reason: string;
};

export type PlaceMatch = {
  name: string;
  /** "Region of Waterloo, Ontario, Canada": enough to tell two Waterloos apart. */
  context: string;
  /** "Ontario, Canada": the same, short enough for one line on a phone. */
  short: string;
  country: string;
  lat: number;
  lng: number;
};

/** What "add many" sends for each place: a spot, a name, and whatever she filled in. */
export type PlaceBatchInput = Omit<PlaceInput, "kind">;

// A region she has been to without naming a town in it. A US state goes by
// its ISO 3166-2 code ("US-CA"); a country by its code in /places/world.json
// ("FRA", or "FRA-OS" for overseas France).
export const REGION_ID = /^(?:US-[A-Z]{2}|[A-Z0-9]{3}(?:-[A-Z0-9]{2})?)$/;
export const REGION_MAX = 400;
export const UNITED_STATES = "USA";
/** Washington, D.C. can be checked off, but it is not one of the fifty. */
export const FEDERAL_DISTRICT = "US-DC";
export const STATE_COUNT = 50;

export function isStateId(id: string) {
  return id.startsWith("US-");
}

/** How many names "add many" looks up in one go. */
export const PLACE_BATCH_MAX = 30;

export const PLACE_KINDS: PlaceKind[] = ["visited", "hometown", "current"];
export const PLACE_NAME_MAX = 80;
export const PLACE_COUNTRY_MAX = 80;
export const PLACE_REASON_MAX = 280;
export const PLACE_YEAR_MIN = 1900;
export const PLACE_YEAR_MAX = 2100;

export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export const KIND_LABELS: Record<PlaceKind, string> = {
  hometown: "Where I’m from",
  current: "Where I am now",
  visited: "Where I’ve been",
};

function seed(
  id: string,
  name: string,
  country: string,
  lat: number,
  lng: number,
  kind: PlaceKind = "visited",
): Place {
  return { id: `seed-${id}`, name, country, lat, lng, kind, month: null, year: null, reason: "" };
}

// Seeded once (see ensureTable in lib/places.ts) and shown as they are when
// the database cannot be reached.
export const SEED_PLACES: Place[] = [
  seed("diamond-bar", "Diamond Bar, California", "United States", 34.0286, -117.8103, "hometown"),
  seed(
    "chateau-oak",
    "Chateau Oak, the Panhandle, San Francisco",
    "United States",
    37.7722,
    -122.446,
    "current",
  ),
  seed("beijing", "Beijing", "China", 39.9042, 116.4074),
  seed("xian", "Xi’an", "China", 34.261, 108.9423),
  seed("chengdu", "Chengdu", "China", 30.6599, 104.0633),
  seed("copenhagen", "Copenhagen", "Denmark", 55.6761, 12.5683),
  seed("seoul", "Seoul", "South Korea", 37.5665, 126.978),
  seed("tokyo", "Tokyo", "Japan", 35.6762, 139.6503),
  seed("kyoto", "Kyoto", "Japan", 35.0116, 135.7681),
  seed("nozawa-onsen", "Nozawa Onsen", "Japan", 36.923, 138.4406),
  seed("sydney", "Sydney", "Australia", -33.8688, 151.2093),
  seed("lisbon", "Lisbon", "Portugal", 38.7223, -9.1393),
  seed("porto", "Porto", "Portugal", 41.1579, -8.6291),
  seed("paris", "Paris", "France", 48.8566, 2.3522),
  seed("brittany", "Brittany", "France", 48.202, -2.9326),
  seed("banff", "Banff, Alberta", "Canada", 51.1784, -115.5708),
  seed("waterloo", "Waterloo, Ontario", "Canada", 43.4643, -80.5204),
];

/** "Waterloo, Banff\nOaxaca" becomes three names, in order, each once. */
export function splitPlaceNames(text: string) {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const part of text.split(/[\n,;]+/)) {
    const name = part.replace(/\s+/g, " ").trim().slice(0, PLACE_NAME_MAX);
    const key = name.toLowerCase();
    if (name.length < 2 || seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names;
}

/** "Chateau Oak, the Panhandle, San Francisco" reads as a title and a line under it. */
export function splitPlaceName(name: string) {
  const [title, ...rest] = name.split(",").map((part) => part.trim()).filter(Boolean);
  return { title: title ?? name.trim(), rest: rest.join(", ") };
}

/** "March 2019", "2019", "March", or nothing at all. */
export function formatPlaceDate(place: Pick<Place, "month" | "year">) {
  const month = place.month ? MONTHS[place.month - 1] : "";
  return [month, place.year ? String(place.year) : ""].filter(Boolean).join(" ");
}

export function placeHasDetails(place: Pick<Place, "month" | "year" | "reason">) {
  return Boolean(place.month || place.year || place.reason);
}

export function formatCoordinates(lat: number, lng: number) {
  const part = (value: number, positive: string, negative: string) =>
    `${Math.abs(value).toFixed(2)}° ${value >= 0 ? positive : negative}`;
  return `${part(lat, "N", "S")}, ${part(lng, "E", "W")}`;
}
