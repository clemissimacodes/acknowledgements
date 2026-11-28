"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

export type EnemyCard = {
  slug: string;
  nickname: string;
  productName: string;
  badgeLabel: string;
  relationship: string;
  hometown: string;
  priceLabel: string;
  heroUrl: string | null;
};

type Sort = "featured" | "az" | "za";

const SORTS: Array<[Sort, string]> = [
  ["featured", "Most Unforgivable"],
  ["az", "Alphabetically, A – Z"],
  ["za", "Alphabetically, Z – A (they hate that)"],
];

const MISS = "__miss__";
const MISS_LABEL = "People I Secretly Miss";

export function BadGrid({ enemies, query }: { enemies: EnemyCard[]; query: string }) {
  const [relationship, setRelationship] = useState<string[]>([]);
  const [sort, setSort] = useState<Sort>("featured");
  const [open, setOpen] = useState<"rel" | "sort" | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!barRef.current?.contains(event.target as Node)) setOpen(null);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);

  const missSelected = relationship.includes(MISS);

  const visible = useMemo(() => {
    if (missSelected) return [];
    const q = query.trim().toLowerCase();
    const list = enemies.filter(
      (e) =>
        (!relationship.length || relationship.includes(e.relationship)) &&
        (!q ||
          e.nickname.toLowerCase().includes(q) ||
          e.productName.toLowerCase().includes(q) ||
          e.hometown.toLowerCase().includes(q)),
    );
    if (sort === "az") return [...list].sort((a, b) => a.nickname.localeCompare(b.nickname));
    if (sort === "za") return [...list].sort((a, b) => b.nickname.localeCompare(a.nickname));
    return list;
  }, [enemies, relationship, sort, query, missSelected]);

  const relationshipOptions: Array<[string, string]> = [
    ...Array.from(new Set(enemies.map((e) => e.relationship).filter(Boolean))).map(
      (r) => [r, r] as [string, string],
    ),
    [MISS, MISS_LABEL],
  ];
  const toggle = (value: string) =>
    setRelationship((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  const sortLabel = SORTS.find(([v]) => v === sort)?.[1] ?? SORTS[0][1];

  return (
    <>
      <div ref={barRef} className="ff-filterbar">
        <div className="ff-filterbar-left">
          <span className="ff-filter-label">Filter:</span>
          <div className={`ff-filter${open === "rel" ? " ff-filter-open" : ""}`}>
            <button
              type="button"
              className={`ff-filter-trigger${relationship.length ? " ff-filter-active" : ""}`}
              aria-expanded={open === "rel"}
              onClick={() => setOpen(open === "rel" ? null : "rel")}
            >
              Relationship <Chevron />
            </button>
            <div className="ff-filter-panel" role="group" aria-label="Relationship">
              <div className="ff-filter-panel-head">
                <span>{relationship.length} selected</span>
                <button
                  type="button"
                  className="ff-filter-reset"
                  onClick={() => setRelationship([])}
                  disabled={!relationship.length}
                >
                  Reset
                </button>
              </div>
              <ul className="ff-filter-checks">
                {relationshipOptions.map(([value, text]) => {
                  const on = relationship.includes(value);
                  return (
                    <li key={value}>
                      <button
                        type="button"
                        className="ff-filter-check"
                        aria-pressed={on}
                        onClick={() => toggle(value)}
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
          {query ? (
            <Link href="/bad-company" className="ff-filter-clear">
              “{query}” ×
            </Link>
          ) : null}
        </div>
        <div className="ff-filterbar-right">
          <span className="ff-filter-label">Sort by:</span>
          <div className={`ff-filter${open === "sort" ? " ff-filter-open" : ""}`}>
            <button
              type="button"
              className="ff-filter-trigger"
              aria-expanded={open === "sort"}
              onClick={() => setOpen(open === "sort" ? null : "sort")}
            >
              {sortLabel} <Chevron />
            </button>
            <div className="ff-filter-panel ff-filter-panel-right" role="listbox" aria-label="Sort by">
              <div className="ff-filter-panel-head">
                <span>{sortLabel}</span>
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
          {visible.map((e, index) => (
            <li key={e.slug} className="ff-card">
              <Link href={`/bad-company/${e.slug}`} prefetch={index < 8}>
                <span className="ff-card-media bc-card-media">
                  {e.heroUrl ? (
                    <img
                      className="ff-card-hero"
                      src={e.heroUrl}
                      alt={e.nickname}
                      loading={index < 4 ? "eager" : "lazy"}
                      decoding="async"
                    />
                  ) : (
                    <>
                      <span className="ff-card-blank" aria-hidden="true" />
                      <span className="bc-card-initial" aria-hidden="true">
                        {initial(e.nickname)}
                      </span>
                    </>
                  )}
                  {e.badgeLabel ? <span className="ff-badge">{e.badgeLabel}</span> : null}
                </span>
                <span className="ff-card-text">
                  <span className="ff-card-name">{e.nickname}</span>
                  {e.productName ? <span className="ff-card-sub">{e.productName}</span> : null}
                  <span className="ff-card-price bc-now">{e.priceLabel}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className={`ff-empty${missSelected ? " ff-empty-joke" : ""}`}>
          {missSelected
            ? "lol. no."
            : enemies.length
              ? "Nobody matches. Unbelievable, given the selection."
              : "The rack is empty. Either I have grown as a person or I haven't stocked it yet."}
        </p>
      )}
    </>
  );
}

function initial(name: string) {
  return name.replace(/[^\p{L}\p{N}]/gu, "").charAt(0).toUpperCase() || "?";
}

function Chevron() {
  return (
    <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true">
      <path d="M1 2.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}
