// Shared by the server (lib/places.ts) and the map itself, so nothing here may
// touch the database.

export type PlaceKind = "visited" | "lived" | "hometown" | "current";

export type Season = "winter" | "spring" | "summer" | "fall";

/** One visit: a season and a year. Old entries may have only the year. */
export type Trip = {
  id: string;
  season: Season | null;
  /**
   * A winter trip at the very end of its year. Winter is counted in the
   * calendar year it falls in, so the same word covers the start of a year
   * and its last weeks; this is what puts those last weeks after the fall.
   */
  late: boolean;
  year: number;
  reason: string;
};

export type TripInput = {
  /** Present when the trip is already on the map. */
  id?: string;
  season: Season | null;
  late: boolean;
  year: number | null;
  reason: string;
};

export type Place = {
  id: string;
  name: string;
  country: string;
  lat: number;
  lng: number;
  kind: PlaceKind;
  /** A line about the place itself, whenever she was there. */
  note: string;
  /** Oldest first. */
  trips: Trip[];
};

export type PlaceInput = {
  name: string;
  country: string;
  lat: number;
  lng: number;
  kind: PlaceKind;
  note: string;
  trips: TripInput[];
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

/** What "add many" sends for each place: a spot, a name, and the trip she filled in, if any. */
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

export const PLACE_KINDS: PlaceKind[] = ["visited", "lived", "hometown", "current"];
export const PLACE_NAME_MAX = 80;
export const PLACE_COUNTRY_MAX = 80;
export const PLACE_REASON_MAX = 280;
export const PLACE_YEAR_MIN = 1900;
export const PLACE_YEAR_MAX = 2100;
export const PLACE_TRIPS_MAX = 60;

export const SEASONS: Season[] = ["winter", "spring", "summer", "fall"];

export const SEASON_LABELS: Record<Season, string> = {
  winter: "Winter",
  spring: "Spring",
  summer: "Summer",
  fall: "Fall",
};

/** What the owner picks from, in the order of a year. The value is what a form holds. */
export const SEASON_CHOICES: Array<{ value: string; label: string }> = [
  { value: "winter", label: "Winter" },
  { value: "spring", label: "Spring" },
  { value: "summer", label: "Summer" },
  { value: "fall", label: "Fall" },
  { value: "winter-late", label: "Winter, year’s end" },
];

export function seasonChoice(trip: Pick<Trip, "season" | "late">) {
  if (!trip.season) return "";
  return trip.season === "winter" && trip.late ? "winter-late" : trip.season;
}

export function seasonOfChoice(value: string): Pick<Trip, "season" | "late"> {
  if (value === "winter-late") return { season: "winter", late: true };
  return { season: SEASONS.includes(value as Season) ? (value as Season) : null, late: false };
}

export const KIND_LABELS: Record<PlaceKind, string> = {
  hometown: "Where I’m from",
  current: "Where I am now",
  lived: "Where I’ve lived",
  visited: "Where I’ve been",
};

/** Where a trip falls within its year. */
function tripSlot(trip: Pick<Trip, "season" | "late">) {
  if (!trip.season) return -1;
  return trip.season === "winter" && trip.late ? SEASONS.length : SEASONS.indexOf(trip.season);
}

/** Oldest first; trips in the same season keep the order they were given in. */
export function sortTrips<T extends Pick<Trip, "season" | "late" | "year">>(trips: T[]) {
  return trips
    .map((trip, index) => ({ trip, index }))
    .sort((a, b) => a.trip.year - b.trip.year || tripSlot(a.trip) - tripSlot(b.trip) || a.index - b.index)
    .map(({ trip }) => trip);
}

/** "Summer 2024", or "2024" for a trip with no season. */
export function formatTrip(trip: Pick<Trip, "season" | "year">) {
  return trip.season ? `${SEASON_LABELS[trip.season]} ${trip.year}` : String(trip.year);
}

type SeedOptions = {
  kind?: PlaceKind;
  /** "summer 2024", oldest first; "winter 2024 late" for the last weeks of 2024. */
  trips?: string[];
};

function seed(
  id: string,
  name: string,
  country: string,
  lat: number,
  lng: number,
  { kind = "visited", trips = [] }: SeedOptions = {},
): Place {
  const place = `seed-${id}`;
  return {
    id: place,
    name,
    country,
    lat,
    lng,
    kind,
    note: "",
    trips: sortTrips(
      trips.map((entry): Trip => {
        const [season, year, late] = entry.split(" ");
        return {
          id: `${place}-${year}-${season}`,
          season: season as Season,
          late: late === "late",
          year: Number(year),
          reason: "",
        };
      }),
    ),
  };
}

const US = "United States";

// Planted once (see ensureTable in lib/places.ts), places and trips alike, and
// shown as they are when the database cannot be reached. New places go at the
// end: the order here is the order they are planted in.
export const SEED_PLACES: Place[] = [
  seed("diamond-bar", "Diamond Bar, California", US, 34.0286, -117.8103, { kind: "hometown" }),
  seed("chateau-oak", "Chateau Oak, the Panhandle, San Francisco", US, 37.7722, -122.446, {
    kind: "current",
    trips: ["fall 2024", "winter 2025", "spring 2025"],
  }),
  seed("beijing", "Beijing", "China", 39.9042, 116.4074),
  seed("xian", "Xi’an", "China", 34.261, 108.9423),
  seed("chengdu", "Chengdu", "China", 30.6599, 104.0633),
  seed("copenhagen", "Copenhagen", "Denmark", 55.6761, 12.5683, { trips: ["summer 2026"] }),
  seed("seoul", "Seoul", "South Korea", 37.5665, 126.978, { trips: ["summer 2026"] }),
  seed("tokyo", "Tokyo", "Japan", 35.6762, 139.6503, { trips: ["winter 2026"] }),
  seed("kyoto", "Kyoto", "Japan", 35.0116, 135.7681, { trips: ["winter 2026"] }),
  seed("nozawa-onsen", "Nozawa Onsen", "Japan", 36.923, 138.4406, { trips: ["winter 2026"] }),
  seed("sydney", "Sydney", "Australia", -33.8688, 151.2093),
  seed("lisbon", "Lisbon", "Portugal", 38.7223, -9.1393, { trips: ["summer 2024", "fall 2026"] }),
  seed("porto", "Porto", "Portugal", 41.1579, -8.6291, { trips: ["summer 2024"] }),
  seed("paris", "Paris", "France", 48.8566, 2.3522, { trips: ["fall 2026"] }),
  seed("brittany", "Brittany", "France", 48.202, -2.9326),
  seed("banff", "Banff, Alberta", "Canada", 51.1784, -115.5708),
  seed("waterloo", "Waterloo, Ontario", "Canada", 43.4643, -80.5204),

  seed("chicago", "Chicago, Illinois", US, 41.8756, -87.6244, { kind: "lived", trips: ["spring 2024"] }),
  seed("vanderbilt", "Vanderbilt University, Nashville, Tennessee", US, 36.1438, -86.8028, {
    kind: "lived",
    trips: ["spring 2025"],
  }),
  seed("los-feliz", "Los Feliz, Los Angeles", US, 34.1077, -118.2875, { kind: "lived" }),
  seed("los-angeles", "Los Angeles, California", US, 34.0537, -118.2428, {
    trips: ["fall 2024", "winter 2024 late", "summer 2025", "spring 2026", "summer 2026"],
  }),
  seed("las-vegas", "Las Vegas, Nevada", US, 36.1674, -115.1484, { trips: ["spring 2024"] }),
  seed("ontario-california", "Ontario, California", US, 34.0309, -117.6107, {
    trips: ["spring 2024"],
  }),
  seed("saratoga-springs", "Saratoga Springs, New York", US, 43.0822, -73.7854, {
    trips: ["summer 2024"],
  }),
  seed("atlanta", "Atlanta, Georgia", US, 33.7545, -84.3898, { trips: ["winter 2025"] }),
  seed("flagstaff", "Flagstaff, Arizona", US, 35.1988, -111.6518, { trips: ["fall 2025"] }),
  seed("coronado", "Coronado, San Diego", US, 32.6915, -117.1767, { trips: ["winter 2025 late"] }),
  seed("half-moon-bay", "Half Moon Bay, California", US, 37.4636, -122.4286, {
    trips: ["winter 2026"],
  }),
  seed("mendocino", "Mendocino, California", US, 39.3077, -123.7995, { trips: ["winter 2026"] }),
  seed("monterey", "Monterey, California", US, 36.6003, -121.8946, { trips: ["winter 2026"] }),
  seed("petaluma", "Petaluma, California", US, 38.2326, -122.6365, { trips: ["winter 2026"] }),
  seed("calistoga", "Calistoga, California", US, 38.5788, -122.5797, { trips: ["spring 2026"] }),
  seed("hacienda-heights", "Hacienda Heights, California", US, 34.0004, -117.9753, {
    trips: ["spring 2026"],
  }),
  seed("new-york-city", "New York City, New York", US, 40.7127, -74.006, {
    trips: ["spring 2026", "summer 2026", "fall 2026"],
  }),
  seed("boston", "Boston, Massachusetts", US, 42.3588, -71.0578, {
    trips: ["summer 2026", "fall 2026"],
  }),
  seed("cambridge", "Cambridge, Massachusetts", US, 42.3656, -71.104, {
    trips: ["summer 2026", "fall 2026"],
  }),
  seed("castine", "Castine, Maine", US, 44.3878, -68.7966, { trips: ["summer 2026"] }),
  seed("portland-maine", "Portland, Maine", US, 43.6574, -70.2587, { trips: ["summer 2026"] }),
  seed("seaside-heights", "Seaside Heights, New Jersey", US, 39.9428, -74.0736, {
    trips: ["fall 2026"],
  }),
  seed("charlottesville", "Charlottesville, Virginia", US, 38.0293, -78.4767, {
    trips: ["fall 2026"],
  }),
  seed("washington-dc", "Washington, D.C.", US, 38.8951, -77.0364, { trips: ["fall 2026"] }),

  seed("marseille", "Marseille", "France", 43.2964, 5.3778, { trips: ["summer 2024"] }),
  seed("tbilisi", "Tbilisi", "Georgia", 41.6935, 44.8014, { trips: ["summer 2024"] }),
  seed("montreal", "Montreal, Quebec", "Canada", 45.5032, -73.5698, { trips: ["fall 2025"] }),
  seed("florence", "Florence", "Italy", 43.7698, 11.2556, { trips: ["winter 2026"] }),
  seed("milan", "Milan", "Italy", 45.4642, 9.1896, { trips: ["winter 2026"] }),
  seed("rome", "Rome", "Italy", 41.8933, 12.4829, { trips: ["winter 2026"] }),
  seed("verona", "Verona", "Italy", 45.4425, 10.9857, { trips: ["winter 2026"] }),
  seed("tulum", "Tulum", "Mexico", 20.2112, -87.4628, { trips: ["summer 2026"] }),
  seed("sanya", "Sanya", "China", 18.2535, 109.5034, { trips: ["summer 2026"] }),
  seed("aegiali", "Aegiali, Amorgos", "Greece", 36.9007, 25.9769, { trips: ["fall 2026"] }),
  seed("athens", "Athens", "Greece", 37.9756, 23.7348, { trips: ["fall 2026"] }),
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

/** Whether there is anything on the card beyond the name and the spot. */
export function placeHasDetails(place: Pick<Place, "trips" | "note">) {
  return place.trips.length > 0 || Boolean(place.note);
}

export function formatCoordinates(lat: number, lng: number) {
  const part = (value: number, positive: string, negative: string) =>
    `${Math.abs(value).toFixed(2)}° ${value >= 0 ? positive : negative}`;
  return `${part(lat, "N", "S")}, ${part(lng, "E", "W")}`;
}
