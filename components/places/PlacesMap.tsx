"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import {
  addPlace,
  addPlaces,
  findPlaces,
  markRegion,
  removePlace,
  savePlace,
  type PlacesResult,
} from "@/app/(volume)/places/actions";
import {
  FEDERAL_DISTRICT,
  KIND_LABELS,
  PLACE_BATCH_MAX,
  PLACE_COUNTRY_MAX,
  PLACE_KINDS,
  PLACE_NAME_MAX,
  PLACE_REASON_MAX,
  PLACE_TRIPS_MAX,
  PLACE_YEAR_MAX,
  PLACE_YEAR_MIN,
  SEASON_CHOICES,
  STATE_COUNT,
  UNITED_STATES,
  formatCoordinates,
  formatTrip,
  isStateId,
  placeHasDetails,
  seasonChoice,
  seasonOfChoice,
  splitPlaceName,
  splitPlaceNames,
  type Place,
  type PlaceKind,
  type PlaceMatch,
  type TripInput,
} from "@/lib/place-types";
import { milesBetween, wrapLongitude, type RawStates, type RawWorld } from "./atlas";
import { Atlas, type Insets, type Region, type Spot } from "./engine";
import styles from "./Places.module.css";

type Mode = "view" | "index" | "edit" | "add" | "many" | "regions";

/** One name from a pasted list, and what the search made of it. */
type Row = {
  key: number;
  query: string;
  status: "waiting" | "looking" | "found" | "none" | "failed";
  matches: PlaceMatch[];
  pick: number;
  season: string;
  year: string;
  reason: string;
  open: boolean;
};

type Stage = "write" | "rows" | "done";

/** It can be checked off with the states, but it is not one of the fifty. */
const DISTRICT_NAME = "Washington, D.C.";

/** Two spots this close are the same place. */
const SAME_PLACE_MILES = 2;

/** A trip as the form holds it: the season is one of SEASON_CHOICES, or "". */
type TripDraft = {
  key: number;
  /** Set when the trip is already on the map. */
  id?: string;
  season: string;
  year: string;
  reason: string;
  /** Whether its reason is showing. */
  open: boolean;
};

type Draft = {
  name: string;
  country: string;
  kind: PlaceKind;
  note: string;
  trips: TripDraft[];
};

let tripKeys = 0;

function blankTrip(): TripDraft {
  return { key: (tripKeys += 1), season: "", year: "", reason: "", open: false };
}

/** A place still to be added, with room for one trip. */
function emptyDraft(): Draft {
  return { name: "", country: "", kind: "visited", note: "", trips: [blankTrip()] };
}

function draftOf(place: Place, another = false): Draft {
  const trips = place.trips.map(
    (trip): TripDraft => ({
      key: (tripKeys += 1),
      id: trip.id,
      season: seasonChoice(trip),
      year: String(trip.year),
      reason: trip.reason,
      open: Boolean(trip.reason),
    }),
  );
  return {
    name: place.name,
    country: place.country,
    kind: place.kind,
    note: place.note,
    trips: another ? [...trips, blankTrip()] : trips,
  };
}

type TripFields = Pick<TripDraft, "id" | "season" | "year" | "reason">;

/** What she typed, as trips. A row left wholly blank is no trip at all. */
function readTrips(rows: TripFields[]): { trips: TripInput[]; error: string } {
  const trips: TripInput[] = [];
  for (const row of rows) {
    const year = row.year.trim();
    if (!year && !row.season && !row.reason.trim()) continue;
    if (!year) return { trips, error: "A trip needs a year." };
    if (!/^\d{4}$/.test(year) || +year < PLACE_YEAR_MIN || +year > PLACE_YEAR_MAX) {
      return { trips, error: "That year looks wrong." };
    }
    trips.push({ id: row.id, ...seasonOfChoice(row.season), year: Number(year), reason: row.reason });
  }
  return { trips, error: "" };
}

/** For a new place: one trip at most. A reason given with no season or year is about the place. */
function readFirst(row: TripFields) {
  if (!row.year.trim() && !row.season && row.reason.trim()) {
    return { trips: [], note: row.reason, error: "" };
  }
  return { ...readTrips([row]), note: "" };
}

/** "Summer 2024", "2024", "Summer", or nothing, as a row is being filled in. */
function tripLabel(row: Pick<TripDraft, "season" | "year">) {
  const season = SEASON_CHOICES.find((choice) => choice.value === row.season)?.label.split(",")[0];
  return [season, row.year.trim()].filter(Boolean).join(" ");
}

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

const byName = (a: Region, b: Region) => a.name.localeCompare(b.name, "en");

/** What tells this match from the others of the same name. */
function matchLabel(match: PlaceMatch, typed: string) {
  const where = match.short || match.context || match.country;
  if (!where) return match.name;
  return match.name.toLowerCase() === typed.toLowerCase() ? where : `${match.name}, ${where}`;
}

const seasonOptions = (
  <>
    <option value="">—</option>
    {SEASON_CHOICES.map((choice) => (
      <option key={choice.value} value={choice.value}>
        {choice.label}
      </option>
    ))}
  </>
);

function Swatch({ kind }: { kind: PlaceKind | "thread" }) {
  if (kind === "thread") {
    return (
      <svg className={styles.threadSwatch} viewBox="0 0 26 12" aria-hidden="true">
        <path d="M1 8 C7 1 12 12 25 3" />
        <path d="M1 8 C8 4 14 9 25 3" />
        <path d="M1 8 C6 9 16 3 25 3" />
      </svg>
    );
  }
  return <span className={styles.swatch} data-kind={kind} aria-hidden="true" />;
}

export function PlacesMap({
  initialPlaces,
  initialRegions,
  canEdit,
}: {
  initialPlaces: Place[];
  initialRegions: string[];
  canEdit: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLCanvasElement>(null);
  const topRef = useRef<HTMLCanvasElement>(null);
  const headRef = useRef<HTMLElement>(null);
  const keyRef = useRef<HTMLUListElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const zoomRef = useRef<HTMLDivElement>(null);
  const atlasRef = useRef<Atlas | null>(null);

  const [places, setPlaces] = useState(initialPlaces);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("view");
  const [dark, setDark] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [pin, setPin] = useState<Spot | null>(null);
  const [placing, setPlacing] = useState(false);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<PlaceMatch[] | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const [searching, startSearch] = useTransition();
  const andNext = useRef(false);
  const guess = useRef("");

  // States and countries checked off by hand.
  const [regions, setRegions] = useState(initialRegions);
  // 0 until the country and state shapes arrive; -1 if they never do.
  const [shapes, setShapes] = useState(0);
  const [listOpen, setListOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [note, setNote] = useState("");

  // Adding many at once.
  const [stage, setStage] = useState<Stage>("write");
  const [listText, setListText] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [looking, setLooking] = useState(false);
  const [held, setHeld] = useState<string[]>([]);
  const [added, setAdded] = useState<string[]>([]);
  const lookup = useRef(0);
  const rowKey = useRef(0);

  const home = useMemo(
    () => places.find((place) => place.kind === "hometown") ?? null,
    [places],
  );

  // The order of a trip around the map: west of home first, then east.
  const tour = useMemo(() => {
    const origin = home?.lng ?? places[0]?.lng ?? 0;
    return [...places].sort(
      (a, b) => wrapLongitude(a.lng - origin) - wrapLongitude(b.lng - origin) || a.lat - b.lat,
    );
  }, [places, home]);

  const selected = places.find((place) => place.id === selectedId) ?? null;

  // The list of places, a country at a time: her own first, then by name.
  const groups = useMemo(() => {
    const byCountry = new Map<string, Place[]>();
    for (const place of places) {
      const country = place.country || "Elsewhere";
      byCountry.set(country, [...(byCountry.get(country) ?? []), place]);
    }
    const title = (place: Place) => splitPlaceName(place.name).title;
    const first = home?.country ?? "";
    return [...byCountry.entries()]
      .map(([country, list]) => ({
        country,
        list: list.sort((a, b) => title(a).localeCompare(title(b), "en")),
      }))
      .sort(
        (a, b) =>
          Number(b.country === first) - Number(a.country === first) ||
          a.country.localeCompare(b.country, "en"),
      );
  }, [places, home]);

  // Which states and countries count as visited: the ones with a place in
  // them, and the ones checked off. The map's own shapes decide what is where.
  const tally = useMemo(() => {
    const atlas = atlasRef.current;
    if (!atlas || shapes <= 0) return null;
    const catalog = atlas.regions();
    const dots = new Map<string, number>();
    for (const place of places) {
      const { country, state: inState } = atlas.locate(place);
      if (country) dots.set(country.id, (dots.get(country.id) ?? 0) + 1);
      if (inState) dots.set(inState.id, (dots.get(inState.id) ?? 0) + 1);
    }
    const checked = new Set(regions);
    const byStates = catalog.states.length > 0;
    const visitedStates = catalog.states.filter((entry) => checked.has(entry.id) || dots.has(entry.id));
    const visited = (id: string) =>
      id === UNITED_STATES && byStates
        ? visitedStates.length > 0 || dots.has(id)
        : checked.has(id) || dots.has(id);
    const named = (entry: Region) =>
      entry.id === FEDERAL_DISTRICT ? { ...entry, name: DISTRICT_NAME } : entry;
    return {
      states: catalog.states.map(named).sort(byName),
      countries: [...catalog.countries].sort(byName),
      dots,
      byStates,
      visited,
      stateCount: visitedStates.filter((entry) => entry.id !== FEDERAL_DISTRICT).length,
      countryCount: catalog.countries.filter((entry) => visited(entry.id)).length,
    };
  }, [places, regions, shapes]);

  // Until the shapes arrive the line is not shown, so it never changes its mind.
  const countLine = [
    plural(places.length, "place", "places"),
    tally
      ? plural(tally.countryCount, "country", "countries")
      : plural(new Set(places.map((place) => place.country).filter(Boolean)).size, "country", "countries"),
    tally?.stateCount ? plural(tally.stateCount, "state", "states") : "",
  ]
    .filter(Boolean)
    .join(", ");

  const state = useRef({ mode, places, regions, tally });
  state.current = { mode, places, regions, tally };
  const onRegionRef = useRef<(region: Region) => void>(() => {});

  const measure = useCallback((): Insets => {
    const host = hostRef.current?.getBoundingClientRect();
    if (!host) return { top: 0, right: 0, bottom: 0, left: 0 };
    const narrow = host.width < 720;
    const head = headRef.current?.getBoundingClientRect();
    const key = keyRef.current?.getBoundingClientRect();
    const card = cardRef.current;
    const insets = {
      top: narrow && head ? head.bottom - host.top + 6 : 28,
      right: 0,
      bottom: narrow && key ? host.bottom - key.top + 6 : 28,
      left: 0,
    };
    // The list of places is a pause, not a destination: the map stays put.
    if (!card || card.dataset.index !== undefined) return insets;
    if (narrow && card.dataset.list !== undefined) return insets;
    const box = card.getBoundingClientRect();
    if (!narrow) insets.right = host.right - box.left + 10;
    else if (box.top - host.top < host.height * 0.3) insets.top = box.bottom - host.top + 8;
    else insets.bottom = host.bottom - box.top + 8;
    return insets;
  }, []);

  // Where the words are, so the map writes no name underneath them.
  const settle = useCallback(
    (atlas: Atlas) => {
      atlas.setInsets(measure());
      const host = hostRef.current?.getBoundingClientRect();
      if (!host) return;
      const narrow = host.width < 720;
      const boxes: Array<[number, number, number, number]> = [];
      const head = headRef.current?.getBoundingClientRect();
      // The site's own name stands above the title, so everything up to the title's foot is spoken for.
      if (head) boxes.push([0, 0, narrow ? host.width : head.right - host.left + 12, head.bottom - host.top + 4]);
      const covered = narrow && cardRef.current;
      for (const element of covered ? [] : [keyRef.current, zoomRef.current]) {
        const box = element?.getBoundingClientRect();
        if (box) boxes.push([box.left - host.left - 8, box.top - host.top - 6, box.right - host.left + 8, box.bottom - host.top + 6]);
      }
      atlas.keepClear(boxes);
    },
    [measure],
  );

  const open = useCallback((id: string | null) => {
    setSelectedId(id);
    setConfirming(false);
    setError("");
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    const base = baseRef.current;
    const top = topRef.current;
    if (!host || !base || !top) return;
    const ground = getComputedStyle(host).getPropertyValue("--places-ground").trim() || "#f3f4f1";
    const atlas = new Atlas(
      host,
      base,
      top,
      {
        onSelect(id) {
          const { mode: current, places: all } = state.current;
          if (current === "edit") {
            // A stray tap on open water should not throw away what she typed.
            const place = all.find((entry) => entry.id === id);
            if (!place) return;
            setDraft(draftOf(place));
          } else {
            setMode("view");
          }
          open(id);
        },
        onPin(spot) {
          setPin(spot);
          setPlacing(true);
          const found = atlas.countryName(spot);
          const guessed = guess.current;
          guess.current = found;
          setDraft((current) =>
            current.country && current.country !== guessed ? current : { ...current, country: found },
          );
          atlas.setPin(spot, false);
        },
        onRegion(region) {
          onRegionRef.current(region);
        },
        onShapes() {
          setShapes((count) => Math.max(count, 0) + 1);
        },
      },
      ground,
    );
    atlasRef.current = atlas;
    setDark(atlas.dark);
    settle(atlas);
    atlas.setChecked(state.current.regions);
    atlas.setPlaces(state.current.places);

    let cancelled = false;
    const load = <T,>(file: string) =>
      fetch(file).then((response) => {
        if (!response.ok) throw new Error(file);
        return response.json() as Promise<T>;
      });
    // Both arrive before either is drawn, so the land fades in once, whole.
    Promise.allSettled([
      load<RawWorld>("/places/world.json"),
      load<RawStates>("/places/us-states.json"),
    ]).then(([world, states]) => {
      if (cancelled) return;
      if (world.status === "fulfilled") {
        atlas.setShapes(world.value, states.status === "fulfilled" ? states.value : null);
      } else {
        setShapes(-1);
      }
    });

    return () => {
      cancelled = true;
      atlas.destroy();
      atlasRef.current = null;
    };
  }, [settle, open]);

  useEffect(() => {
    atlasRef.current?.setPlaces(places);
  }, [places]);

  useEffect(() => {
    atlasRef.current?.setChecked(regions);
  }, [regions]);

  useLayoutEffect(() => {
    const atlas = atlasRef.current;
    if (!atlas) return;
    settle(atlas);
    atlas.focus(selectedId);
  }, [selectedId, mode, listOpen, stage, settle]);

  useEffect(() => {
    const atlas = atlasRef.current;
    if (!atlas) return;
    atlas.setPinMode(mode === "add");
    atlas.setRegionMode(mode === "regions");
  }, [mode]);

  useEffect(() => {
    const onResize = () => atlasRef.current && settle(atlasRef.current);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [settle]);

  const close = useCallback(() => {
    lookup.current += 1;
    setLooking(false);
    setMode("view");
    setPin(null);
    setMatches(null);
    setQuery("");
    open(null);
  }, [open]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  const step = (direction: 1 | -1) => {
    if (!tour.length) return;
    const at = tour.findIndex((place) => place.id === selectedId);
    const next = tour[(at + direction + tour.length) % tour.length];
    if (mode === "edit") setDraft(draftOf(next));
    open(next.id);
  };

  const apply = (
    work: () => Promise<PlacesResult>,
    after: (next: Place[], id?: string) => void,
  ) => {
    setError("");
    startTransition(async () => {
      try {
        const result = await work();
        if ("error" in result) {
          setError(result.error);
          return;
        }
        setPlaces(result.places);
        after(result.places, result.id);
      } catch {
        setError("That did not save. Try again in a moment.");
      }
    });
  };

  const beginEdit = (another = false) => {
    if (!selected) return;
    setDraft(draftOf(selected, another));
    setConfirming(false);
    setError("");
    setMode("edit");
  };

  const beginAdd = () => {
    open(null);
    setDraft(emptyDraft());
    guess.current = "";
    setPin(null);
    setMatches(null);
    setQuery("");
    setMode("add");
  };

  // —— Checking off states and countries ——

  const beginRegions = () => {
    open(null);
    setNote("");
    setFilter("");
    // On a phone the list would cover the map she is about to tap.
    setListOpen((hostRef.current?.clientWidth ?? 0) >= 720);
    setMode("regions");
  };

  // The map shows the tick at once; the server is told afterwards, and the
  // tick is taken back if the server says no.
  const toggleRegion = ({ id, name: given }: Region) => {
    const region = { id, name: id === FEDERAL_DISTRICT ? DISTRICT_NAME : given };
    const { regions: now, tally: known } = state.current;
    atlasRef.current?.flashRegion(region.id);
    if (region.id === UNITED_STATES && known?.byStates) {
      setNote("The US goes state by state.");
      return;
    }
    const here = known?.dots.get(region.id) ?? 0;
    if (here) {
      setNote(`${region.name} has ${plural(here, "place", "places")}, so it stays.`);
      return;
    }
    const on = !now.includes(region.id);
    const next = on ? [...now, region.id] : now.filter((id) => id !== region.id);
    state.current.regions = next;
    setRegions(next);
    setNote(`${region.name} is ${on ? "checked" : "unchecked"}.`);
    const undo = (message: string) => {
      setRegions((current) =>
        on
          ? current.filter((id) => id !== region.id)
          : current.includes(region.id)
            ? current
            : [...current, region.id],
      );
      setNote(message);
    };
    markRegion(region.id, on).then(
      (result) => {
        if ("error" in result) undo(`${region.name} did not save. ${result.error}`);
      },
      () => undo(`${region.name} did not save. Try again in a moment.`),
    );
  };
  onRegionRef.current = toggleRegion;

  // —— Adding many at once ——

  const beginMany = () => {
    open(null);
    lookup.current += 1;
    setLooking(false);
    setStage("write");
    setRows([]);
    setHeld([]);
    setAdded([]);
    setError("");
    setMode("many");
  };

  const onMap = (match: PlaceMatch) =>
    places.some((place) => milesBetween(place, match) < SAME_PLACE_MILES);

  const patchRow = (key: number, patch: Partial<Row>) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  // One name at a time: the search allows a request a second, and the server
  // keeps to that however quickly it is asked.
  const lookUp = async (list: Array<Pick<Row, "key" | "query">>) => {
    const run = (lookup.current += 1);
    setLooking(true);
    for (const { key, query: name } of list) {
      if (lookup.current !== run) return;
      patchRow(key, { status: "looking" });
      let result: Awaited<ReturnType<typeof findPlaces>> | null = null;
      try {
        result = await findPlaces(name);
      } catch {
        result = null;
      }
      if (lookup.current !== run) return;
      if (!result || "error" in result) {
        patchRow(key, { status: "failed", matches: [], pick: 0 });
      } else if (!result.matches.length) {
        patchRow(key, { status: "none", matches: [], pick: 0 });
      } else {
        // A name that is already on the map most likely means that place.
        const known = result.matches.findIndex((match) =>
          state.current.places.some((place) => milesBetween(place, match) < SAME_PLACE_MILES),
        );
        patchRow(key, { status: "found", matches: result.matches, pick: Math.max(known, 0) });
      }
    }
    if (lookup.current === run) setLooking(false);
  };

  const onLookUp = (event: FormEvent) => {
    event.preventDefault();
    const names = splitPlaceNames(listText);
    if (!names.length) return;
    const list = names.slice(0, PLACE_BATCH_MAX).map(
      (name): Row => ({
        key: (rowKey.current += 1),
        query: name,
        status: "waiting",
        matches: [],
        pick: 0,
        season: "",
        year: "",
        reason: "",
        open: false,
      }),
    );
    setError("");
    setRows(list);
    setHeld(names.slice(PLACE_BATCH_MAX));
    setStage("rows");
    void lookUp(list);
  };

  // Names not reached yet go back in the box for another time.
  const stopLooking = () => {
    lookup.current += 1;
    setLooking(false);
    const unasked = rows.filter((row) => row.status === "waiting" || row.status === "looking");
    setHeld((current) => [...unasked.map((row) => row.query), ...current]);
    setRows((current) => current.filter((row) => !unasked.includes(row)));
  };

  const retry = (row: Row, name: string) => {
    const typed = name.replace(/\s+/g, " ").trim();
    if (typed.length < 2 || looking) return;
    patchRow(row.key, { query: typed, status: "waiting" });
    void lookUp([{ key: row.key, query: typed }]);
  };

  const fresh = rows.filter((row) => row.status === "found" && !onMap(row.matches[row.pick]));
  const leftover = [
    ...rows.filter((row) => row.status === "none" || row.status === "failed").map((row) => row.query),
    ...held,
  ];

  const onAddAll = (event: FormEvent) => {
    event.preventDefault();
    if (!fresh.length || looking) return;
    const wrong = fresh.find((row) => readFirst(row).error);
    if (wrong) {
      const message = readFirst(wrong).error;
      patchRow(wrong.key, { open: true });
      setError(`${wrong.matches[wrong.pick].name}: ${message.charAt(0).toLowerCase()}${message.slice(1)}`);
      return;
    }
    setError("");
    startTransition(async () => {
      try {
        const result = await addPlaces(
          fresh.map((row) => {
            const match = row.matches[row.pick];
            const { trips, note } = readFirst(row);
            return {
              name: match.name,
              country: match.country,
              lat: match.lat,
              lng: match.lng,
              note,
              trips,
            };
          }),
        );
        if ("error" in result) {
          setError(result.error);
          return;
        }
        setPlaces(result.places);
        setAdded(result.ids ?? []);
        setListText("");
        setStage("done");
        atlasRef.current?.resetView();
      } catch {
        setError("That did not save. Try again in a moment.");
      }
    });
  };

  // The places just added that still have no trip and no note.
  const bare = places.filter((place) => added.includes(place.id) && !placeHasDetails(place));

  const fillIn = () => {
    const first = tour.find((place) => bare.includes(place));
    if (!first) return;
    setDraft(draftOf(first, true));
    setMode("edit");
    open(first.id);
  };

  // Back from the rows keeps every name; after adding, only the ones still to find.
  const nextRound = (names: string[]) => {
    lookup.current += 1;
    setLooking(false);
    setListText(names.join("\n"));
    setRows([]);
    setHeld([]);
    setError("");
    setStage("write");
  };

  const onSave = (event: FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    const id = selected.id;
    const onward = andNext.current;
    andNext.current = false;
    const { trips, error: wrong } = readTrips(draft.trips);
    if (wrong) {
      setError(wrong);
      return;
    }
    const { name, country, kind, note } = draft;
    apply(
      () => savePlace(id, { name, country, kind, note, trips }),
      (next) => {
        if (!onward) {
          setMode("view");
          return;
        }
        const origin = next.find((place) => place.kind === "hometown")?.lng ?? 0;
        const order = [...next].sort(
          (a, b) => wrapLongitude(a.lng - origin) - wrapLongitude(b.lng - origin) || a.lat - b.lat,
        );
        const from = order.findIndex((place) => place.id === id);
        const blank = [...order.slice(from + 1), ...order.slice(0, from)].filter(
          (place) => !placeHasDetails(place),
        );
        // What she has just added in one go comes first, then anything else still blank.
        const waiting = blank.find((place) => added.includes(place.id)) ?? blank[0];
        if (!waiting) {
          setMode("view");
          return;
        }
        // It has nothing yet, so a trip is ready to be filled in.
        setDraft(draftOf(waiting, true));
        open(waiting.id);
      },
    );
  };

  const onAdd = (event: FormEvent) => {
    event.preventDefault();
    if (!pin) return;
    const { trips, note, error: wrong } = readFirst(draft.trips[0] ?? blankTrip());
    if (wrong) {
      setError(wrong);
      return;
    }
    const { name, country, kind } = draft;
    apply(
      () => addPlace({ name, country, kind, note, trips, lat: pin.lat, lng: pin.lng }),
      (_next, id) => {
        setMode("view");
        setPin(null);
        setMatches(null);
        setQuery("");
        open(id ?? null);
      },
    );
  };

  const onDelete = () => {
    if (!selected) return;
    const id = selected.id;
    apply(
      () => removePlace(id),
      () => {
        setMode("view");
        open(null);
      },
    );
  };

  const onSearch = (event: FormEvent) => {
    event.preventDefault();
    const text = query.trim();
    if (text.length < 2) return;
    setError("");
    startSearch(async () => {
      try {
        const result = await findPlaces(text);
        if ("error" in result) {
          setMatches(null);
          setError(result.error);
        } else {
          setMatches(result.matches);
        }
      } catch {
        setMatches(null);
        setError("The search is not answering. Tap the map to drop the pin instead.");
      }
    });
  };

  const choose = (match: PlaceMatch) => {
    const spot = { lat: match.lat, lng: match.lng };
    setPin(spot);
    setPlacing(false);
    setMatches(null);
    guess.current = match.country;
    setDraft((current) => ({ ...current, name: match.name, country: match.country }));
    atlasRef.current?.setPin(spot, true);
  };

  const field = <K extends "name" | "country" | "kind" | "note">(key: K) => ({
    value: draft[key],
    onChange: (
      event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
    ) => setDraft((current) => ({ ...current, [key]: event.target.value })),
  });

  const patchTrip = (key: number, patch: Partial<TripDraft>) =>
    setDraft((current) => ({
      ...current,
      trips: current.trips.map((trip) => (trip.key === key ? { ...trip, ...patch } : trip)),
    }));

  // A new place: when she went, if she wants to say. More trips can follow once it is on the map.
  const first = draft.trips[0];
  const firstTripFields = first ? (
    <>
      <div className={styles.pair}>
        <label className={styles.field}>
          <span>Season</span>
          <select value={first.season} onChange={(event) => patchTrip(first.key, { season: event.target.value })}>
            {seasonOptions}
          </select>
        </label>
        <label className={styles.field}>
          <span>Year</span>
          <input
            value={first.year}
            onChange={(event) => patchTrip(first.key, { year: event.target.value })}
            inputMode="numeric"
            pattern="[0-9]{4}"
            title="Four digits, like 2019"
            maxLength={4}
            placeholder="—"
            autoComplete="off"
          />
        </label>
      </div>
      <label className={styles.field}>
        <span>Reason</span>
        <textarea
          value={first.reason}
          onChange={(event) => patchTrip(first.key, { reason: event.target.value })}
          rows={2}
          maxLength={PLACE_REASON_MAX}
        />
      </label>
    </>
  ) : null;

  // A place on the map: every trip on a line of its own, oldest first.
  const tripFields = (
    <div className={styles.trips} role="group" aria-label="Trips">
      <p className={styles.tripsHead}>
        <span>{draft.trips.length ? "Trips" : "No trips yet"}</span>
        <button
          type="button"
          className={styles.more}
          disabled={draft.trips.length >= PLACE_TRIPS_MAX}
          onClick={() => setDraft((current) => ({ ...current, trips: [...current.trips, blankTrip()] }))}
        >
          Add a trip
        </button>
      </p>
      {draft.trips.length ? (
        <ul>
          {draft.trips.map((trip, index) => {
            const label = tripLabel(trip) || `trip ${index + 1}`;
            return (
              <li key={trip.key} className={styles.trip}>
                <select
                  value={trip.season}
                  onChange={(event) => patchTrip(trip.key, { season: event.target.value })}
                  aria-label={`Season, ${label}`}
                >
                  {seasonOptions}
                </select>
                <input
                  value={trip.year}
                  onChange={(event) => patchTrip(trip.key, { year: event.target.value })}
                  inputMode="numeric"
                  pattern="[0-9]{4}"
                  title="Four digits, like 2019"
                  maxLength={4}
                  placeholder="Year"
                  autoComplete="off"
                  aria-label={`Year, ${label}`}
                />
                <button
                  type="button"
                  className={styles.why}
                  aria-expanded={trip.open}
                  aria-label={`Why, ${label}`}
                  onClick={() => patchTrip(trip.key, { open: !trip.open })}
                >
                  why
                </button>
                <button
                  type="button"
                  className={styles.drop}
                  aria-label={`Remove ${label}`}
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      trips: current.trips.filter((entry) => entry.key !== trip.key),
                    }))
                  }
                >
                  <CloseGlyph />
                </button>
                {trip.open ? (
                  <input
                    className={styles.tripWhy}
                    value={trip.reason}
                    onChange={(event) => patchTrip(trip.key, { reason: event.target.value })}
                    maxLength={PLACE_REASON_MAX}
                    placeholder="Why"
                    autoComplete="off"
                    aria-label={`Reason, ${label}`}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );

  const noteField = (
    <label className={styles.field}>
      <span>Note</span>
      <textarea {...field("note")} rows={2} maxLength={PLACE_REASON_MAX} />
    </label>
  );

  const nameFields = (
    <>
      <div className={styles.pair}>
        <label className={styles.field}>
          <span>Name</span>
          <input {...field("name")} required maxLength={PLACE_NAME_MAX} autoComplete="off" />
        </label>
        <label className={styles.field}>
          <span>Country</span>
          <input {...field("country")} maxLength={PLACE_COUNTRY_MAX} autoComplete="off" />
        </label>
      </div>
      <label className={styles.field}>
        <span>This is</span>
        <select {...field("kind")}>
          {PLACE_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {KIND_LABELS[kind].toLowerCase()}
            </option>
          ))}
        </select>
      </label>
    </>
  );

  let card: React.ReactNode = null;

  if (mode === "regions" && canEdit) {
    const needle = filter.trim().toLowerCase();
    const wanted = (region: Region) =>
      !needle ||
      region.name.toLowerCase().includes(needle) ||
      (isStateId(region.id) && region.id.slice(3).toLowerCase() === needle);
    const tick = (region: Region) => {
      const here = tally?.dots.get(region.id) ?? 0;
      const byStates = region.id === UNITED_STATES && tally?.byStates;
      const on = tally?.visited(region.id) ?? regions.includes(region.id);
      return (
        <li key={region.id}>
          <button
            type="button"
            role="checkbox"
            aria-checked={on}
            className={styles.tick}
            data-held={here || byStates ? "" : undefined}
            onClick={() => toggleRegion(region)}
          >
            <span className={styles.box} aria-hidden="true">
              <svg viewBox="0 0 16 16">
                <path d="M3.5 8.5l3 3 6-7" />
              </svg>
            </span>
            <strong>{region.name}</strong>
            {byStates ? <span>by its states</span> : here ? <span>{plural(here, "place", "places")}</span> : null}
          </button>
        </li>
      );
    };
    const stateTicks = tally?.states.filter(wanted) ?? [];
    const countryTicks = tally?.countries.filter(wanted) ?? [];
    card = (
      <section
        ref={cardRef}
        className={styles.card}
        data-top=""
        data-list={listOpen ? "" : undefined}
        aria-label="Check off where you have been"
      >
        <header className={styles.cardHead}>
          <p className={styles.kind}>Check off</p>
          <button type="button" className={styles.close} onClick={close} aria-label="Close">
            <CloseGlyph />
          </button>
        </header>
        <h2 className={styles.name}>
          {tally?.byStates
            ? `${tally.stateCount} of ${STATE_COUNT} states`
            : plural(tally?.countryCount ?? 0, "country", "countries")}
        </h2>
        {tally?.byStates ? (
          <p className={styles.where}>{plural(tally.countryCount, "country", "countries")}</p>
        ) : null}
        <p className={styles.status} role="status">
          {note || (listOpen ? "Tick a state or a country." : "Tap a state or a country on the map.")}
        </p>
        <div className={styles.actions}>
          {tally?.byStates ? (
            <button
              type="button"
              className={styles.action}
              onClick={() => {
                // On a phone the list steps aside, so the map is clear for tapping.
                if ((hostRef.current?.clientWidth ?? 0) < 720) setListOpen(false);
                requestAnimationFrame(() => {
                  const host = hostRef.current?.getBoundingClientRect();
                  const head = headRef.current?.getBoundingClientRect();
                  if (atlasRef.current) settle(atlasRef.current);
                  // On a wide screen the title sits on the map: the states start below it.
                  atlasRef.current?.showUnitedStates(host && head ? head.bottom - host.top + 10 : 0);
                });
              }}
            >
              Show the US
            </button>
          ) : null}
          <button
            type="button"
            className={styles.action}
            aria-expanded={listOpen}
            onClick={() => setListOpen((shown) => !shown)}
          >
            {listOpen ? "Hide the list" : "List"}
          </button>
          <button type="button" className={styles.action} data-strong="" data-end="" onClick={close}>
            Done
          </button>
        </div>
        {listOpen ? (
          <>
            <div className={styles.search}>
              <input
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder="Find a state or a country"
                aria-label="Find a state or a country"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="search"
              />
            </div>
            <div className={styles.checklist}>
              {stateTicks.length ? (
                <>
                  <h3>States</h3>
                  <ul>{stateTicks.map(tick)}</ul>
                </>
              ) : null}
              {countryTicks.length ? (
                <>
                  <h3>Countries</h3>
                  <ul>{countryTicks.map(tick)}</ul>
                </>
              ) : null}
              {!stateTicks.length && !countryTicks.length ? (
                <p className={styles.hint}>
                  {tally ? "Nothing by that name." : "The map is still arriving."}
                </p>
              ) : null}
            </div>
          </>
        ) : null}
      </section>
    );
  } else if (mode === "many" && canEdit) {
    const typed = splitPlaceNames(listText);
    const done = rows.filter((row) => row.status !== "waiting" && row.status !== "looking").length;
    card = (
      <section
        ref={cardRef}
        className={styles.card}
        data-form=""
        data-list={stage === "rows" ? "" : undefined}
        aria-label="Add many places"
      >
        <header className={styles.cardHead}>
          <p className={styles.kind}>Add many</p>
          <button type="button" className={styles.close} onClick={close} aria-label="Close">
            <CloseGlyph />
          </button>
        </header>
        {stage === "write" ? (
          <form className={styles.form} onSubmit={onLookUp}>
            <label className={styles.field}>
              <span>Places</span>
              <textarea
                value={listText}
                onChange={(event) => setListText(event.target.value)}
                rows={5}
                placeholder={"Waterloo, Banff, Vancouver\nOaxaca"}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="words"
                spellCheck={false}
              />
            </label>
            <p className={styles.hint}>
              {typed.length > PLACE_BATCH_MAX
                ? `${typed.length} names. The first ${PLACE_BATCH_MAX} go now, the rest wait here.`
                : typed.length
                  ? `${plural(typed.length, "name", "names")}, about ${plural(Math.max(1, Math.round(typed.length * 1.2)), "second", "seconds")} to look up.`
                  : "One to a line, or with commas between."}
            </p>
            <div className={styles.actions}>
              <button type="submit" className={styles.action} data-strong="" disabled={!typed.length}>
                Look them up
              </button>
            </div>
          </form>
        ) : stage === "rows" ? (
          <form className={styles.form} onSubmit={onAddAll}>
            <ul className={styles.rows}>
              {rows.map((row) => {
                const match = row.matches[row.pick];
                const drop = (
                  <button
                    type="button"
                    className={styles.drop}
                    onClick={() => setRows((current) => current.filter((entry) => entry !== row))}
                    aria-label={`Leave out ${match?.name ?? row.query}`}
                  >
                    <CloseGlyph />
                  </button>
                );
                if (row.status === "none" || row.status === "failed") {
                  return (
                    <li key={row.key} className={styles.row} data-lost="">
                      <div className={styles.rowHead}>
                        <input
                          defaultValue={row.query}
                          aria-label="Try another spelling"
                          autoComplete="off"
                          autoCorrect="off"
                          spellCheck={false}
                          enterKeyHint="search"
                          onKeyDown={(event) => {
                            if (event.key !== "Enter") return;
                            event.preventDefault();
                            retry(row, event.currentTarget.value);
                          }}
                        />
                        <button
                          type="button"
                          className={styles.action}
                          disabled={looking}
                          onClick={(event) => {
                            const input = event.currentTarget.previousElementSibling as HTMLInputElement;
                            retry(row, input.value);
                          }}
                        >
                          Find
                        </button>
                        {drop}
                      </div>
                      <p className={styles.rowNote}>
                        {row.status === "none"
                          ? "Nothing by that name. The rest can still go."
                          : "The search did not answer. Try it again."}
                      </p>
                    </li>
                  );
                }
                if (!match) {
                  return (
                    <li key={row.key} className={styles.row} data-waiting="">
                      <div className={styles.rowHead}>
                        <strong>{row.query}</strong>
                        <span>{row.status === "looking" ? "looking" : "waiting"}</span>
                      </div>
                    </li>
                  );
                }
                const known = onMap(match);
                const when = tripLabel(row);
                return (
                  <li key={row.key} className={styles.row} data-known={known ? "" : undefined}>
                    <div className={styles.rowHead}>
                      <strong>{match.name}</strong>
                      <span>
                        {known
                          ? "already on the map"
                          : row.matches.length > 1
                            ? ""
                            : matchLabel(match, match.name)}
                      </span>
                      {drop}
                    </div>
                    {row.matches.length > 1 ? (
                      <select
                        className={styles.choice}
                        value={row.pick}
                        onChange={(event) => patchRow(row.key, { pick: Number(event.target.value) })}
                        aria-label={`Which ${row.query}`}
                      >
                        {row.matches.map((option, at) => (
                          <option key={`${option.lat},${option.lng}`} value={at}>
                            {matchLabel(option, row.query)}
                          </option>
                        ))}
                      </select>
                    ) : null}
                    {known ? null : (
                      <button
                        type="button"
                        className={styles.more}
                        aria-expanded={row.open}
                        onClick={() =>
                          setRows((current) =>
                            current.map((entry) => ({ ...entry, open: entry === row && !row.open })),
                          )
                        }
                      >
                        {[when, row.reason.trim()].filter(Boolean).join(", ") || "When and why"}
                      </button>
                    )}
                    {row.open && !known ? (
                      <div className={styles.rowMore}>
                        <div className={styles.pair}>
                          <label className={styles.field}>
                            <span>Season</span>
                            <select
                              value={row.season}
                              onChange={(event) => patchRow(row.key, { season: event.target.value })}
                            >
                              {seasonOptions}
                            </select>
                          </label>
                          <label className={styles.field}>
                            <span>Year</span>
                            <input
                              value={row.year}
                              onChange={(event) => patchRow(row.key, { year: event.target.value })}
                              inputMode="numeric"
                              maxLength={4}
                              placeholder="—"
                              autoComplete="off"
                            />
                          </label>
                        </div>
                        <label className={styles.field}>
                          <span>Reason</span>
                          <textarea
                            value={row.reason}
                            onChange={(event) => patchRow(row.key, { reason: event.target.value })}
                            rows={2}
                            maxLength={PLACE_REASON_MAX}
                          />
                        </label>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            <div className={styles.rowsFoot}>
              {held.length ? (
                <p className={styles.rowNote}>
                  {plural(held.length, "more name waits", "more names wait")} for the next round.
                </p>
              ) : null}
              {error ? <p className={styles.error}>{error}</p> : null}
              {looking ? (
                <div className={styles.actions}>
                  <span className={styles.ask} role="status">
                    Looking up {Math.min(done + 1, rows.length)} of {rows.length}
                  </span>
                  <button type="button" className={styles.action} onClick={stopLooking}>
                    Stop
                  </button>
                </div>
              ) : (
                <div className={styles.actions}>
                  <button
                    type="submit"
                    className={styles.action}
                    data-strong=""
                    disabled={pending || !fresh.length}
                  >
                    {pending ? "Adding" : fresh.length ? `Add all ${fresh.length}` : "Nothing to add"}
                  </button>
                  <button
                    type="button"
                    className={styles.action}
                    data-end=""
                    onClick={() => nextRound([...rows.map((row) => row.query), ...held])}
                  >
                    Back
                  </button>
                </div>
              )}
              {looking ? (
                <span className={styles.meter} aria-hidden="true">
                  <span style={{ width: `${(done / Math.max(1, rows.length)) * 100}%` }} />
                </span>
              ) : null}
            </div>
          </form>
        ) : (
          <>
            <h2 className={styles.name}>{plural(added.length, "place", "places")} added</h2>
            <p className={styles.status}>
              {leftover.length
                ? `${plural(leftover.length, "name is", "names are")} still to find.`
                : "They are on the map."}
            </p>
            <div className={styles.actions}>
              {bare.length ? (
                <button type="button" className={styles.action} data-strong="" onClick={fillIn}>
                  Add when and why
                </button>
              ) : null}
              {leftover.length ? (
                <button type="button" className={styles.action} onClick={() => nextRound(leftover)}>
                  The next {leftover.length}
                </button>
              ) : null}
              <button
                type="button"
                className={styles.action}
                data-strong={bare.length ? undefined : ""}
                data-end=""
                onClick={close}
              >
                Done
              </button>
            </div>
          </>
        )}
      </section>
    );
  } else if (mode === "add" && canEdit) {
    card = (
      <section ref={cardRef} className={styles.card} data-form="" aria-label="Add a place">
        <header className={styles.cardHead}>
          <p className={styles.kind}>Add a place</p>
          <button type="button" className={styles.close} onClick={close} aria-label="Close">
            <CloseGlyph />
          </button>
        </header>
        <form className={styles.search} onSubmit={onSearch} role="search">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Type a city or a place"
            aria-label="Find a place by name"
            autoComplete="off"
            enterKeyHint="search"
          />
          <button type="submit" className={styles.action} disabled={searching}>
            {searching ? "Looking" : "Find"}
          </button>
        </form>
        {matches ? (
          matches.length ? (
            <ul className={styles.matches}>
              {matches.map((match) => (
                <li key={`${match.lat},${match.lng}`}>
                  <button type="button" onClick={() => choose(match)}>
                    <strong>{match.name}</strong>
                    <span>{match.context}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.hint}>Nothing by that name. Tap the map to drop the pin.</p>
          )
        ) : null}
        {pin && placing ? (
          <div className={styles.form}>
            <p className={styles.coordinates}>
              <span>Pin at {formatCoordinates(pin.lat, pin.lng)}</span>
              <span>Tap the map to move it</span>
            </p>
            <div className={styles.actions}>
              <button type="button" className={styles.action} data-strong="" onClick={() => setPlacing(false)}>
                Use this spot
              </button>
            </div>
          </div>
        ) : pin ? (
          <form className={styles.form} onSubmit={onAdd}>
            <p className={styles.coordinates}>
              <span>Pin at {formatCoordinates(pin.lat, pin.lng)}</span>
              <button type="button" onClick={() => setPlacing(true)}>
                Move the pin
              </button>
            </p>
            {nameFields}
            {firstTripFields}
            {error ? <p className={styles.error}>{error}</p> : null}
            <div className={styles.actions}>
              <button type="submit" className={styles.action} data-strong="" disabled={pending}>
                {pending ? "Adding" : "Add to the map"}
              </button>
            </div>
          </form>
        ) : (
          <>
            {matches ? null : <p className={styles.hint}>Or tap the map to drop a pin.</p>}
            {error ? <p className={styles.error}>{error}</p> : null}
          </>
        )}
      </section>
    );
  } else if (mode === "index") {
    card = (
      <section ref={cardRef} className={styles.card} data-index="" aria-label="All places">
        <header className={styles.cardHead}>
          <p className={styles.kind}>{plural(places.length, "place", "places")}</p>
          <button type="button" className={styles.close} onClick={close} aria-label="Close">
            <CloseGlyph />
          </button>
        </header>
        <div className={styles.index}>
          {groups.map(({ country, list }) => (
            <section key={country} aria-label={country}>
              <h3>
                {country}
                <span>{list.length}</span>
              </h3>
              <ul>
                {list.map((place) => {
                  const { title, rest } = splitPlaceName(place.name);
                  return (
                    <li key={place.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setMode("view");
                          open(place.id);
                        }}
                      >
                        <Swatch kind={place.kind} />
                        <strong>{title}</strong>
                        <span>{rest}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      </section>
    );
  } else if (selected) {
    const { title, rest } = splitPlaceName(selected.name);
    const where = [rest, selected.country].filter(Boolean).join(", ");
    const told = selected.trips.filter((trip) => trip.reason);
    const away =
      home && home.id !== selected.id
        ? `${Math.round(milesBetween(home, selected)).toLocaleString("en-US")} mi from ${splitPlaceName(home.name).title}`
        : "";
    const at = tour.findIndex((place) => place.id === selected.id);
    card = (
      <section
        ref={cardRef}
        className={styles.card}
        data-form={mode === "edit" ? "" : undefined}
        aria-live="polite"
        aria-label={title}
      >
        <header className={styles.cardHead}>
          <p className={styles.kind}>
            <Swatch kind={selected.kind} />
            {KIND_LABELS[selected.kind]}
          </p>
          <button type="button" className={styles.close} onClick={close} aria-label="Close">
            <CloseGlyph />
          </button>
        </header>
        <h2 className={styles.name}>{title}</h2>
        {where ? <p className={styles.where}>{where}</p> : null}

        {mode === "edit" && canEdit ? (
          <form className={styles.form} onSubmit={onSave}>
            {tripFields}
            {nameFields}
            {noteField}
            {error ? <p className={styles.error}>{error}</p> : null}
            {confirming ? (
              <div className={styles.actions}>
                <span className={styles.ask}>Take {title} off the map?</span>
                <button
                  type="button"
                  className={styles.action}
                  data-danger=""
                  onClick={onDelete}
                  disabled={pending}
                >
                  Delete
                </button>
                <button type="button" className={styles.action} onClick={() => setConfirming(false)}>
                  Keep
                </button>
              </div>
            ) : (
              <div className={styles.actions}>
                <button type="submit" className={styles.action} data-strong="" disabled={pending}>
                  {pending ? "Saving" : "Save"}
                </button>
                <button
                  type="submit"
                  className={styles.action}
                  disabled={pending}
                  onClick={() => (andNext.current = true)}
                >
                  Save, next
                </button>
                <button
                  type="button"
                  className={styles.action}
                  data-quiet=""
                  onClick={() => setConfirming(true)}
                >
                  Delete
                </button>
              </div>
            )}
          </form>
        ) : (
          <>
            {selected.trips.length ? (
              <ul className={styles.when} aria-label="Trips">
                {selected.trips.map((trip, index) => (
                  <li key={trip.id}>
                    <span>{formatTrip(trip)}</span>
                    {index < selected.trips.length - 1 ? "\u00a0· " : null}
                  </li>
                ))}
              </ul>
            ) : null}
            {told.map((trip) => (
              <p key={trip.id} className={styles.reason}>
                {selected.trips.length > 1 ? <span className={styles.tag}>{formatTrip(trip)}</span> : null}
                {trip.reason}
              </p>
            ))}
            {selected.note ? <p className={styles.reason}>{selected.note}</p> : null}
            <p className={styles.coordinates}>
              <span>{formatCoordinates(selected.lat, selected.lng)}</span>
              {away ? <span>{away}</span> : null}
            </p>
          </>
        )}

        <footer className={styles.cardFoot}>
          <button type="button" className={styles.step} onClick={() => step(-1)} aria-label="Previous place">
            <ArrowGlyph flip />
          </button>
          <span className={styles.count}>
            {at + 1} / {tour.length}
          </span>
          <button type="button" className={styles.step} onClick={() => step(1)} aria-label="Next place">
            <ArrowGlyph />
          </button>
          {canEdit && mode !== "edit" ? (
            <>
              <button type="button" className={styles.action} onClick={() => beginEdit(true)}>
                Add a trip
              </button>
              <button type="button" className={styles.action} onClick={() => beginEdit()}>
                Edit
              </button>
            </>
          ) : null}
          {mode === "edit" ? (
            <button type="button" className={styles.action} onClick={() => setMode("view")}>
              Done
            </button>
          ) : null}
        </footer>
      </section>
    );
  }

  return (
    <main
      className={`places-page ${styles.root}`}
      data-tone={dark ? "dark" : "light"}
      data-open={card ? "" : undefined}
    >
      <div
        ref={hostRef}
        className={styles.stage}
        tabIndex={0}
        role="application"
        aria-label="World map. Drag to move, pinch or scroll to zoom."
      >
        <canvas ref={baseRef} />
        <canvas ref={topRef} />
      </div>

      <header ref={headRef} className={styles.head}>
        <h1>Places</h1>
        <p data-shown={shapes ? "" : undefined}>
          <button
            type="button"
            className={styles.link}
            onClick={() => (mode === "index" ? close() : (open(null), setMode("index")))}
            aria-expanded={mode === "index"}
          >
            {countLine}
          </button>
        </p>
        {canEdit ? (
          <p data-shown="">
            <button type="button" className={styles.link} onClick={beginAdd}>
              Add a place
            </button>
            <button type="button" className={styles.link} onClick={beginMany}>
              Add many
            </button>
            <button type="button" className={styles.link} onClick={beginRegions}>
              Check off
            </button>
          </p>
        ) : null}
      </header>

      <ul ref={keyRef} className={styles.key} aria-label="What the colors mean">
        <li>
          <Swatch kind="hometown" />
          where I’m from
        </li>
        <li>
          <Swatch kind="current" />
          where I am now
        </li>
        <li>
          <Swatch kind="lived" />
          where I’ve lived
        </li>
        <li>
          <Swatch kind="visited" />
          where I’ve been
        </li>
        <li>
          <Swatch kind="thread" />
          threads from home
        </li>
      </ul>

      <div ref={zoomRef} className={styles.zoom}>
        <button type="button" onClick={() => atlasRef.current?.zoomBy(1.7)} aria-label="Zoom in">
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M8 2.5v11M2.5 8h11" />
          </svg>
        </button>
        <button type="button" onClick={() => atlasRef.current?.zoomBy(1 / 1.7)} aria-label="Zoom out">
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M2.5 8h11" />
          </svg>
        </button>
        <button type="button" onClick={() => atlasRef.current?.resetView()} aria-label="Show the whole map">
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M3.2 8a4.8 4.8 0 1 0 1.5-3.5M3 2.6v2.6h2.6" />
          </svg>
        </button>
      </div>

      {card}
    </main>
  );
}

function CloseGlyph() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
    </svg>
  );
}

function ArrowGlyph({ flip }: { flip?: boolean }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" style={flip ? { transform: "scaleX(-1)" } : undefined}>
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  );
}
