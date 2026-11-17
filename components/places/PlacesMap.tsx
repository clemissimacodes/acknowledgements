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
import Link from "next/link";
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
  MONTHS,
  PLACE_BATCH_MAX,
  PLACE_COUNTRY_MAX,
  PLACE_KINDS,
  PLACE_NAME_MAX,
  PLACE_REASON_MAX,
  PLACE_YEAR_MAX,
  PLACE_YEAR_MIN,
  STATE_COUNT,
  UNITED_STATES,
  formatCoordinates,
  formatPlaceDate,
  isStateId,
  placeHasDetails,
  splitPlaceName,
  splitPlaceNames,
  type Place,
  type PlaceKind,
  type PlaceMatch,
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
  month: string;
  year: string;
  reason: string;
  open: boolean;
};

type Stage = "write" | "rows" | "done";

/** It can be checked off with the states, but it is not one of the fifty. */
const DISTRICT_NAME = "Washington, D.C.";

/** Two spots this close are the same place. */
const SAME_PLACE_MILES = 2;

type Draft = {
  name: string;
  country: string;
  kind: PlaceKind;
  month: string;
  year: string;
  reason: string;
};

const EMPTY_DRAFT: Draft = { name: "", country: "", kind: "visited", month: "", year: "", reason: "" };

function draftOf(place: Place): Draft {
  return {
    name: place.name,
    country: place.country,
    kind: place.kind,
    month: place.month ? String(place.month) : "",
    year: place.year ? String(place.year) : "",
    reason: place.reason,
  };
}

function detailsOf(draft: Draft) {
  return {
    name: draft.name,
    country: draft.country,
    kind: draft.kind,
    month: draft.month ? Number(draft.month) : null,
    year: draft.year.trim() ? Number(draft.year) : null,
    reason: draft.reason,
  };
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
  const atlasRef = useRef<Atlas | null>(null);

  const [places, setPlaces] = useState(initialPlaces);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("view");
  const [dark, setDark] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
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
    atlas.setInsets(measure());
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
  }, [measure, open]);

  useEffect(() => {
    atlasRef.current?.setPlaces(places);
  }, [places]);

  useEffect(() => {
    atlasRef.current?.setChecked(regions);
  }, [regions]);

  useLayoutEffect(() => {
    const atlas = atlasRef.current;
    if (!atlas) return;
    atlas.setInsets(measure());
    atlas.focus(selectedId);
  }, [selectedId, mode, listOpen, stage, measure]);

  useEffect(() => {
    const atlas = atlasRef.current;
    if (!atlas) return;
    atlas.setPinMode(mode === "add");
    atlas.setRegionMode(mode === "regions");
  }, [mode]);

  useEffect(() => {
    const onResize = () => atlasRef.current?.setInsets(measure());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [measure]);

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

  const beginEdit = () => {
    if (!selected) return;
    setDraft(draftOf(selected));
    setConfirming(false);
    setError("");
    setMode("edit");
  };

  const beginAdd = () => {
    open(null);
    setDraft(EMPTY_DRAFT);
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
        month: "",
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
    const wrong = fresh.find((row) => {
      const year = row.year.trim();
      return year && !(/^\d{4}$/.test(year) && +year >= PLACE_YEAR_MIN && +year <= PLACE_YEAR_MAX);
    });
    if (wrong) {
      patchRow(wrong.key, { open: true });
      setError(`${wrong.matches[wrong.pick].name}: that year looks wrong.`);
      return;
    }
    setError("");
    startTransition(async () => {
      try {
        const result = await addPlaces(
          fresh.map((row) => {
            const match = row.matches[row.pick];
            return {
              name: match.name,
              country: match.country,
              lat: match.lat,
              lng: match.lng,
              month: row.month ? Number(row.month) : null,
              year: row.year.trim() ? Number(row.year) : null,
              reason: row.reason,
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

  // The places just added that still have no month, year or reason.
  const bare = places.filter((place) => added.includes(place.id) && !placeHasDetails(place));

  const fillIn = () => {
    const first = tour.find((place) => bare.includes(place));
    if (!first) return;
    setDraft(draftOf(first));
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
    apply(
      () => savePlace(id, detailsOf(draft)),
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
        setDraft(draftOf(waiting));
        open(waiting.id);
      },
    );
  };

  const onAdd = (event: FormEvent) => {
    event.preventDefault();
    if (!pin) return;
    apply(
      () => addPlace({ ...detailsOf(draft), lat: pin.lat, lng: pin.lng }),
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

  const field = <K extends keyof Draft>(key: K) => ({
    value: draft[key],
    onChange: (
      event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
    ) => setDraft((current) => ({ ...current, [key]: event.target.value })),
  });

  const detailFields = (
    <>
      <div className={styles.pair}>
        <label className={styles.field}>
          <span>Month</span>
          <select {...field("month")}>
            <option value="">—</option>
            {MONTHS.map((month, index) => (
              <option key={month} value={index + 1}>
                {month}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span>Year</span>
          <input
            {...field("year")}
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
        <textarea {...field("reason")} rows={2} maxLength={PLACE_REASON_MAX} />
      </label>
    </>
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
                  atlasRef.current?.setInsets(measure());
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
                const when = formatPlaceDate({
                  month: row.month ? Number(row.month) : null,
                  year: row.year.trim() ? Number(row.year) : null,
                });
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
                            <span>Month</span>
                            <select
                              value={row.month}
                              onChange={(event) => patchRow(row.key, { month: event.target.value })}
                            >
                              <option value="">—</option>
                              {MONTHS.map((month, index) => (
                                <option key={month} value={index + 1}>
                                  {month}
                                </option>
                              ))}
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
            {detailFields}
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
        <ul className={styles.index}>
          {tour.map((place) => (
            <li key={place.id}>
              <button
                type="button"
                onClick={() => {
                  setMode("view");
                  open(place.id);
                }}
              >
                <Swatch kind={place.kind} />
                <strong>{splitPlaceName(place.name).title}</strong>
                <span>{place.country}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    );
  } else if (selected) {
    const { title, rest } = splitPlaceName(selected.name);
    const where = [rest, selected.country].filter(Boolean).join(", ");
    const when = formatPlaceDate(selected);
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
            {detailFields}
            {nameFields}
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
            {when ? <p className={styles.when}>{when}</p> : null}
            {selected.reason ? <p className={styles.reason}>{selected.reason}</p> : null}
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
            <button type="button" className={styles.action} onClick={beginEdit}>
              Edit
            </button>
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
        {canEdit ? (
          <p data-shown="">
            <Link href="/controlroom" className={styles.link}>
              Control room
            </Link>
            <Link href="/places" className={styles.link}>
              Public map
            </Link>
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
          <Swatch kind="visited" />
          where I’ve been
        </li>
        <li>
          <Swatch kind="thread" />
          threads from home
        </li>
      </ul>

      <div className={styles.zoom}>
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
