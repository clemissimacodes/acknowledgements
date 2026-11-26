"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  FRIEND_BADGES,
  FRIEND_ERAS,
  MET_HOW,
  eraLabel,
  friendPrice,
  formatPrice,
  type Friend,
} from "@/lib/friend-types";

type Sort = "featured" | "longest" | "newest" | "az" | "price-asc" | "price-desc";

const SORTS: Array<[Sort, string]> = [
  ["featured", "Featured"],
  ["longest", "Longest Known"],
  ["newest", "New Arrivals"],
  ["az", "A – Z"],
  ["price-asc", "Price, Low to High"],
  ["price-desc", "Price, High to Low"],
];

type Props = {
  friends: Friend[];
  era: string | null;
  query: string;
};

export function CollectionGrid({ friends, era: lockedEra, query }: Props) {
  const [era, setEra] = useState<string>(lockedEra ?? "");
  const [metHow, setMetHow] = useState("");
  const [badge, setBadge] = useState("");
  const [sort, setSort] = useState<Sort>("featured");
  const [open, setOpen] = useState<string | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => setEra(lockedEra ?? ""), [lockedEra]);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!barRef.current?.contains(event.target as Node)) setOpen(null);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = friends.filter(
      (f) =>
        (!era || f.era === era) &&
        (!metHow || f.metHow === metHow) &&
        (!badge || f.badge === badge) &&
        (!q ||
          f.nickname.toLowerCase().includes(q) ||
          f.productName.toLowerCase().includes(q) ||
          f.hometown.toLowerCase().includes(q)),
    );
    const byDate = (a: Friend, b: Friend) => a.metOn.localeCompare(b.metOn);
    switch (sort) {
      case "longest":
        return list.sort(byDate);
      case "newest":
        return list.sort((a, b) => byDate(b, a));
      case "az":
        return list.sort((a, b) => a.nickname.localeCompare(b.nickname));
      case "price-asc":
        return list.sort((a, b) => Number(friendPrice(a.metOn)) - Number(friendPrice(b.metOn)));
      case "price-desc":
        return list.sort((a, b) => Number(friendPrice(b.metOn)) - Number(friendPrice(a.metOn)));
      default:
        return list;
    }
  }, [friends, era, metHow, badge, sort, query]);

  const metHowOptions = MET_HOW.filter((how) => friends.some((f) => f.metHow === how));
  const badgeOptions = (Object.keys(FRIEND_BADGES) as Array<keyof typeof FRIEND_BADGES>).filter(
    (key) => key !== "none" && friends.some((f) => f.badge === key),
  );

  const Filter = ({
    id,
    label,
    value,
    options,
    onPick,
  }: {
    id: string;
    label: string;
    value: string;
    options: Array<[string, string]>;
    onPick: (value: string) => void;
  }) => (
    <div className={`ff-filter${open === id ? " ff-filter-open" : ""}`}>
      <button
        type="button"
        aria-expanded={open === id}
        className={value ? "ff-filter-active" : undefined}
        onClick={() => setOpen(open === id ? null : id)}
      >
        {value ? options.find(([v]) => v === value)?.[1] ?? label : label} <Chevron />
      </button>
      <ul className="ff-filter-menu">
        <li>
          <button type="button" onClick={() => (onPick(""), setOpen(null))}>
            All
          </button>
        </li>
        {options.map(([v, text]) => (
          <li key={v}>
            <button
              type="button"
              aria-current={value === v}
              onClick={() => (onPick(v), setOpen(null))}
            >
              {text}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <>
      <div ref={barRef} className="ff-filterbar">
        <div className="ff-filterbar-left">
          <span className="ff-filter-label">Filter:</span>
          {!lockedEra ? (
            <Filter
              id="era"
              label="Era"
              value={era}
              options={FRIEND_ERAS.map((e) => [e.handle, e.label])}
              onPick={setEra}
            />
          ) : null}
          {metHowOptions.length ? (
            <Filter
              id="how"
              label="How We Met"
              value={metHow}
              options={metHowOptions.map((how) => [how, how])}
              onPick={setMetHow}
            />
          ) : null}
          {badgeOptions.length ? (
            <Filter
              id="badge"
              label="Availability"
              value={badge}
              options={badgeOptions.map((key) => [key, FRIEND_BADGES[key]])}
              onPick={setBadge}
            />
          ) : null}
          {query ? (
            <Link href={lockedEra ? `/collections/${lockedEra}` : "/collections/friends-and-family"} className="ff-filter-clear">
              “{query}” ×
            </Link>
          ) : null}
        </div>
        <div className="ff-filterbar-right">
          <span className="ff-filter-label">Sort by:</span>
          <div className={`ff-filter${open === "sort" ? " ff-filter-open" : ""}`}>
            <button type="button" aria-expanded={open === "sort"} onClick={() => setOpen(open === "sort" ? null : "sort")}>
              {SORTS.find(([v]) => v === sort)?.[1]} <Chevron />
            </button>
            <ul className="ff-filter-menu ff-filter-menu-right">
              {SORTS.map(([v, text]) => (
                <li key={v}>
                  <button type="button" aria-current={sort === v} onClick={() => (setSort(v), setOpen(null))}>
                    {text}
                  </button>
                </li>
              ))}
            </ul>
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
                  <span className="ff-card-price">$ {formatPrice(friendPrice(f.metOn))} USD</span>
                  <span className="ff-card-era">{eraLabel(f.era)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="ff-empty">
          {friends.length ? "Nothing matches. Try fewer filters." : "The shelves are being stocked. Check back tomorrow morning."}
        </p>
      )}
    </>
  );
}

function Chevron() {
  return (
    <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true">
      <path d="M1 2.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}
