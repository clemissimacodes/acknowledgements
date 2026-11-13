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
  findPlaces,
  removePlace,
  savePlace,
  type PlacesResult,
} from "@/app/(volume)/places/actions";
import {
  KIND_LABELS,
  MONTHS,
  PLACE_COUNTRY_MAX,
  PLACE_KINDS,
  PLACE_NAME_MAX,
  PLACE_REASON_MAX,
  formatCoordinates,
  formatPlaceDate,
  placeHasDetails,
  splitPlaceName,
  type Place,
  type PlaceKind,
  type PlaceMatch,
} from "@/lib/place-types";
import { milesBetween, wrapLongitude } from "./atlas";
import { Atlas, type Insets, type Spot } from "./engine";
import styles from "./Places.module.css";

type Mode = "view" | "index" | "edit" | "add";

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
  canEdit,
}: {
  initialPlaces: Place[];
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
  const countries = new Set(places.map((place) => place.country).filter(Boolean)).size;

  const state = useRef({ mode, places });
  state.current = { mode, places };

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
      },
      ground,
    );
    atlasRef.current = atlas;
    setDark(atlas.dark);
    atlas.setInsets(measure());
    atlas.setPlaces(state.current.places);

    let cancelled = false;
    fetch("/places/world.json")
      .then((response) => response.json())
      .then((world) => {
        if (!cancelled) atlas.setWorld(world);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      atlas.destroy();
      atlasRef.current = null;
    };
  }, [measure, open]);

  useEffect(() => {
    atlasRef.current?.setPlaces(places);
  }, [places]);

  useLayoutEffect(() => {
    const atlas = atlasRef.current;
    if (!atlas) return;
    atlas.setInsets(measure());
    atlas.focus(selectedId);
  }, [selectedId, mode, measure]);

  useEffect(() => {
    const atlas = atlasRef.current;
    if (!atlas) return;
    atlas.setPinMode(mode === "add");
  }, [mode]);

  useEffect(() => {
    const onResize = () => atlasRef.current?.setInsets(measure());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [measure]);

  const close = useCallback(() => {
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
        const waiting = [...order.slice(from + 1), ...order.slice(0, from)].find(
          (place) => !placeHasDetails(place),
        );
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

  if (mode === "add" && canEdit) {
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
        <p>
          <button
            type="button"
            className={styles.link}
            onClick={() => (mode === "index" ? close() : (open(null), setMode("index")))}
            aria-expanded={mode === "index"}
          >
            {plural(places.length, "place", "places")}, {plural(countries, "country", "countries")}
          </button>
          {canEdit ? (
            <button type="button" className={styles.link} onClick={beginAdd}>
              Add a place
            </button>
          ) : null}
        </p>
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
