"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  FRIEND_BADGES,
  MET_HOW,
  RELATIONSHIPS,
  SHOP_HANDLE,
  collectionOrder,
  priceLabel,
  type FriendCard,
} from "@/lib/friend-types";

type Sort = "featured" | "longest" | "newest" | "family" | "hometown" | "az" | "fate";

const SORTS: Array<[Sort, string]> = [
  ["featured", "Featured"],
  ["longest", "Longest Known"],
  ["newest", "Most Recently Acquired"],
  ["family", "Family First"],
  ["hometown", "Hometown, A – Z"],
  ["az", "Alphabetically, A – Z"],
  ["fate", "Leave It to Fate"],
];

const HATE = "__hate__";
const HATE_LABEL = "Friends I Secretly Hate";

/* Deterministic shuffle so "fate" is stable across a visit. */
function fateOrder(seed: number) {
  let state = seed || 1;
  return () => {
    state = (state * 48271) % 2147483647;
    return state / 2147483647;
  };
}

function toggleValue(list: string[], value: string) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

type Props = {
  friends: FriendCard[];
  era: string | null;
  query: string;
};

export function CollectionGrid({ friends, era: lockedEra, query }: Props) {
  const era = lockedEra ?? "";
  const [metHow, setMetHow] = useState<string[]>([]);
  const [relationship, setRelationship] = useState<string[]>([]);
  const [badge, setBadge] = useState<string[]>([]);
  const [sort, setSort] = useState<Sort>("featured");
  const [open, setOpen] = useState<string | null>(null);
  const [fateSeed, setFateSeed] = useState(0);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => setFateSeed(Math.floor(Math.random() * 2147483646) + 1), []);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!barRef.current?.contains(event.target as Node)) setOpen(null);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);

  const hateSelected = relationship.includes(HATE);

  const visible = useMemo(() => {
    if (hateSelected) return [] as FriendCard[];
    const q = query.trim().toLowerCase();
    const realRelationships = relationship.filter((item) => item !== HATE);
    const list = friends.filter(
      (f) =>
        (!era || f.era === era) &&
        (!metHow.length || metHow.includes(f.metHow)) &&
        (!realRelationships.length || realRelationships.includes(f.relationship)) &&
        (!badge.length || badge.includes(f.badge)) &&
        (!q ||
          f.nickname.toLowerCase().includes(q) ||
          f.productName.toLowerCase().includes(q) ||
          f.hometown.toLowerCase().includes(q)),
    );
    const byDate = (a: FriendCard, b: FriendCard) =>
      collectionOrder(a.collection) - collectionOrder(b.collection) || a.nickname.localeCompare(b.nickname);
    switch (sort) {
      case "longest":
        return list.sort(byDate);
      case "newest":
        return list.sort((a, b) => byDate(b, a));
      case "family":
        return list.sort(
          (a, b) => Number(b.relationship === "Family") - Number(a.relationship === "Family") || byDate(a, b),
        );
      case "hometown":
        return list.sort((a, b) => (a.hometown || "\uffff").localeCompare(b.hometown || "\uffff") || byDate(a, b));
      case "az":
        return list.sort((a, b) => a.nickname.localeCompare(b.nickname));
      case "fate": {
        const next = fateOrder(fateSeed);
        return list
          .map((f) => [next(), f] as const)
          .sort((a, b) => a[0] - b[0])
          .map(([, f]) => f);
      }
      default:
        return list;
    }
  }, [friends, era, metHow, relationship, badge, sort, query, fateSeed, hateSelected]);

  const metHowOptions = MET_HOW.filter((how) => friends.some((f) => f.metHow === how)).map(
    (how) => [how, how] as [string, string],
  );
  const relationshipOptions: Array<[string, string]> = [
    ...RELATIONSHIPS.filter((r) => friends.some((f) => f.relationship === r)).map(
      (r) => [r, r] as [string, string],
    ),
    [HATE, HATE_LABEL],
  ];
  const badgeOptions = (Object.keys(FRIEND_BADGES) as Array<keyof typeof FRIEND_BADGES>)
    .filter((key) => key !== "none" && friends.some((f) => f.badge === key))
    .map((key) => [key, FRIEND_BADGES[key]] as [string, string]);

  return (
    <>
      <div ref={barRef} className="ff-filterbar">
        <div className="ff-filterbar-left">
          <CheckFilter
            id="relationship"
            label="Relationship"
            selected={relationship}
            options={relationshipOptions}
            open={open}
            setOpen={setOpen}
            onToggle={(value) => setRelationship((prev) => toggleValue(prev, value))}
            onReset={() => setRelationship([])}
          />
          {metHowOptions.length ? (
            <CheckFilter
              id="how"
              label="How We Met"
              selected={metHow}
              options={metHowOptions}
              open={open}
              setOpen={setOpen}
              onToggle={(value) => setMetHow((prev) => toggleValue(prev, value))}
              onReset={() => setMetHow([])}
            />
          ) : null}
          {badgeOptions.length ? (
            <CheckFilter
              id="badge"
              label="Availability"
              selected={badge}
              options={badgeOptions}
              open={open}
              setOpen={setOpen}
              onToggle={(value) => setBadge((prev) => toggleValue(prev, value))}
              onReset={() => setBadge([])}
            />
          ) : null}
          {query ? (
            <Link
              href={lockedEra ? `/collections/${lockedEra}` : `/collections/${SHOP_HANDLE}`}
              className="ff-filter-clear"
            >
              “{query}” ×
            </Link>
          ) : null}
        </div>
        <div className="ff-filterbar-right">
          <div className={`ff-filter${open === "sort" ? " ff-filter-open" : ""}`}>
            <button
              type="button"
              className="ff-filter-trigger"
              aria-expanded={open === "sort"}
              onClick={() => setOpen(open === "sort" ? null : "sort")}
            >
              Sort by <Chevron />
            </button>
            <div className="ff-filter-panel ff-filter-panel-right" role="listbox" aria-label="Sort by">
              <div className="ff-filter-panel-head">
                <span>{SORTS.find(([v]) => v === sort)?.[1] ?? "Featured"}</span>
                <button type="button" className="ff-filter-reset" onClick={() => setSort("featured")}>
                  Reset
                </button>
              </div>
              <ul className="ff-filter-checks">
                {SORTS.map(([v, text]) => (
                  <li key={v}>
                    <button
                      type="button"
                      className="ff-filter-check"
                      aria-pressed={sort === v}
                      onClick={() => {
                        setSort(v);
                        setOpen(null);
                      }}
                    >
                      <span className={`ff-filter-box${sort === v ? " is-on" : ""}`} aria-hidden="true" />
                      <span>{text}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {visible.length ? (
        <ul className="ff-grid">
          {visible.map((f) => (
            <li key={f.id} className="ff-card">
              <Link href={`/products/${f.slug}`}>
                <span className="ff-card-media">
                  {f.heroUrl ? (
                    <img className="ff-card-hero" src={f.heroUrl} alt={f.nickname} loading="lazy" />
                  ) : (
                    <span className="ff-card-blank" aria-hidden="true" />
                  )}
                  {f.altUrl ? <img className="ff-card-alt" src={f.altUrl} alt="" loading="lazy" /> : null}
                  {f.badge !== "none" ? <span className="ff-badge">{FRIEND_BADGES[f.badge]}</span> : null}
                </span>
                <span className="ff-card-text">
                  <span className="ff-card-name">{f.nickname}</span>
                  <span className="ff-card-price">{priceLabel(f.birthday)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className={`ff-empty${hateSelected ? " ff-empty-joke" : ""}`}>
          {hateSelected
            ? "nothing to see here (; good try"
            : friends.length
              ? "Nothing matches. Try fewer filters."
              : "The shelves are being stocked. Check back tomorrow morning."}
        </p>
      )}
    </>
  );
}

function CheckFilter({
  id,
  label,
  selected,
  options,
  open,
  setOpen,
  onToggle,
  onReset,
}: {
  id: string;
  label: string;
  selected: string[];
  options: Array<[string, string]>;
  open: string | null;
  setOpen: (id: string | null) => void;
  onToggle: (value: string) => void;
  onReset: () => void;
}) {
  const isOpen = open === id;
  return (
    <div className={`ff-filter${isOpen ? " ff-filter-open" : ""}`}>
      <button
        type="button"
        className={`ff-filter-trigger${selected.length ? " ff-filter-active" : ""}`}
        aria-expanded={isOpen}
        onClick={() => setOpen(isOpen ? null : id)}
      >
        {label} <Chevron />
      </button>
      <div className="ff-filter-panel" role="group" aria-label={label}>
        <div className="ff-filter-panel-head">
          <span>
            {selected.length} selected
          </span>
          <button type="button" className="ff-filter-reset" onClick={onReset} disabled={!selected.length}>
            Reset
          </button>
        </div>
        <ul className="ff-filter-checks">
          {options.map(([value, text]) => {
            const on = selected.includes(value);
            return (
              <li key={value}>
                <button
                  type="button"
                  className="ff-filter-check"
                  aria-pressed={on}
                  onClick={() => onToggle(value)}
                >
                  <span className={`ff-filter-box${on ? " is-on" : ""}`} aria-hidden="true" />
                  <span>{text}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function Chevron() {
  return (
    <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true">
      <path d="M1 2.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}
