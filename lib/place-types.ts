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
  context: string;
  country: string;
  lat: number;
  lng: number;
};

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
];

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
