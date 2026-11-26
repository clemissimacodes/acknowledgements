"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { deleteFriendForm, toggleVisibleForm } from "@/app/(shop)/actions";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { FriendForm } from "@/components/friends/FriendForm";
import { ImageUploader } from "@/components/friends/ImageUploader";
import { FRIEND_ERAS, collectionLabel, eraLabel, formatBirthday, priceLabel, type Friend } from "@/lib/friend-types";

/* What a finished listing needs. Order = order of the dots in the list. */
const CHECKS = [
  { key: "hero", label: "Hero photo", test: (f: Friend) => Boolean(f.heroUrl) },
  { key: "alt", label: "Second photo", test: (f: Friend) => Boolean(f.altUrl) },
  { key: "birthday", label: "Birthday", test: (f: Friend) => Boolean(f.birthday) },
  { key: "collection", label: "Collection", test: (f: Friend) => Boolean(f.collection) },
  { key: "hometown", label: "Hometown", test: (f: Friend) => Boolean(f.hometown) },
  { key: "metHow", label: "How we met", test: (f: Friend) => Boolean(f.metHow) },
  { key: "trait", label: "Trait", test: (f: Friend) => Boolean(f.favoriteTrait) },
  { key: "memory", label: "Memory", test: (f: Friend) => Boolean(f.favoriteMemory) },
  { key: "poem", label: "Poem", test: (f: Friend) => Boolean(f.poemUrl) },
] as const;
type CheckKey = (typeof CHECKS)[number]["key"];

function missing(f: Friend) {
  return CHECKS.filter((c) => !c.test(f)).map((c) => c.key);
}

type Props = { friends: Friend[] };

export function FriendBrowser({ friends }: Props) {
  const [query, setQuery] = useState("");
  const [era, setEra] = useState("");
  const [need, setNeed] = useState<CheckKey | "">("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLOListElement>(null);

  /* Selection lives in the hash so it survives saves (router.refresh) and reloads. */
  useEffect(() => {
    const fromHash = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      setSelectedId(id && friends.some((f) => f.id === id) ? id : (friends[0]?.id ?? null));
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, [friends]);

  const select = (id: string) => {
    setSelectedId(id);
    history.replaceState(null, "", `#${id}`);
  };

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return friends.filter(
      (f) =>
        (!era || f.era === era) &&
        (!need || missing(f).includes(need)) &&
        (!q ||
          f.nickname.toLowerCase().includes(q) ||
          f.productName.toLowerCase().includes(q) ||
          f.hometown.toLowerCase().includes(q) ||
          f.notes.toLowerCase().includes(q)),
    );
  }, [friends, query, era, need]);

  const selected = friends.find((f) => f.id === selectedId) ?? null;
  const index = visible.findIndex((f) => f.id === selectedId);

  /* j/k or arrows move through the list; "/" focuses search; Esc clears it. */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
      if (event.key === "/" && !typing) {
        event.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (event.key === "Escape" && target === searchRef.current) {
        setQuery("");
        searchRef.current?.blur();
        return;
      }
      if (typing && target !== searchRef.current) return;
      const down = event.key === "ArrowDown" || (!typing && event.key === "j");
      const up = event.key === "ArrowUp" || (!typing && event.key === "k");
      if (!down && !up) return;
      event.preventDefault();
      const next = visible[Math.min(visible.length - 1, Math.max(0, (index < 0 ? -1 : index) + (down ? 1 : -1)))];
      if (next) select(next.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, index]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[aria-current="true"]')?.scrollIntoView({ block: "nearest" });
  }, [selectedId]);

  const done = friends.filter((f) => missing(f).length === 0).length;

  return (
    <div className="admin-browser">
      <aside className="admin-browser-side">
        <div className="admin-browser-tools">
          <input
            ref={searchRef}
            type="search"
            placeholder="Search  ( / )"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <select value={era} onChange={(event) => setEra(event.target.value)} aria-label="Era">
            <option value="">All eras</option>
            {FRIEND_ERAS.map((e) => (
              <option key={e.handle} value={e.handle}>
                {e.label}
              </option>
            ))}
          </select>
          <select value={need} onChange={(event) => setNeed(event.target.value as CheckKey | "")} aria-label="Missing">
            <option value="">Everyone</option>
            {CHECKS.map((c) => (
              <option key={c.key} value={c.key}>
                Missing {c.label.toLowerCase()} ({friends.filter((f) => !c.test(f)).length})
              </option>
            ))}
          </select>
        </div>
        <p className="admin-muted admin-browser-count">
          {visible.length} of {friends.length} · {done} complete · ↑↓ or j/k to move
        </p>
        <ol ref={listRef} className="admin-browser-list">
          {visible.map((f) => {
            const gaps = missing(f);
            return (
              <li key={f.id}>
                <button
                  type="button"
                  aria-current={f.id === selectedId ? "true" : undefined}
                  onClick={() => select(f.id)}
                  title={gaps.length ? `Missing: ${gaps.join(", ")}` : "Complete"}
                >
                  <span className="admin-browser-thumb">{f.heroUrl ? <img src={f.heroUrl} alt="" /> : null}</span>
                  <span className="admin-browser-name">
                    <strong>{f.nickname}</strong>
                    <small>
                      {eraLabel(f.era)}
                      {f.visible ? "" : " · hidden"}
                    </small>
                  </span>
                  <span className="admin-browser-dots" aria-hidden="true">
                    {CHECKS.map((c) => (
                      <i key={c.key} className={c.test(f) ? "is-ok" : undefined} />
                    ))}
                  </span>
                </button>
              </li>
            );
          })}
          {visible.length === 0 ? <li className="admin-muted">No one matches.</li> : null}
        </ol>
      </aside>

      <section className="admin-browser-main">
        {selected ? (
          <FriendPanel key={selected.id} friend={selected} />
        ) : (
          <p className="admin-muted">Pick someone on the left.</p>
        )}
      </section>
    </div>
  );
}

function FriendPanel({ friend }: { friend: Friend }) {
  const gaps = missing(friend);
  return (
    <div className="admin-friend-panel">
      <header className="admin-friend-head">
        <div>
          <h3>
            {friend.nickname} {friend.productName ? <small>{friend.productName}</small> : null}
          </h3>
          <p className="admin-muted">
            {priceLabel(friend.birthday)}
            {friend.birthday ? ` (${formatBirthday(friend.birthday)})` : ""} · {eraLabel(friend.era)}
            {friend.collection ? ` · ${collectionLabel(friend.collection)}` : ""} · {friend.visible ? "visible" : "hidden"} ·{" "}
            <Link href={`/products/${friend.slug}`} target="_blank">
              open page
            </Link>
          </p>
          {gaps.length ? (
            <p className="admin-friend-gaps">
              Missing: {CHECKS.filter((c) => gaps.includes(c.key)).map((c) => c.label.toLowerCase()).join(", ")}
            </p>
          ) : (
            <p className="admin-friend-gaps is-ok">Complete.</p>
          )}
        </div>
        <div className="admin-roll-actions">
          <form action={toggleVisibleForm}>
            <input type="hidden" name="id" value={friend.id} />
            <input type="hidden" name="visible" value={friend.visible ? "false" : "true"} />
            <button type="submit">{friend.visible ? "Hide from shop" : "Show in shop"}</button>
          </form>
          <form action={deleteFriendForm}>
            <input type="hidden" name="id" value={friend.id} />
            <ConfirmButton className="admin-danger" message={`Delete ${friend.nickname} and their photos? This cannot be undone.`}>
              Delete
            </ConfirmButton>
          </form>
        </div>
      </header>

      <div className="admin-friend-images">
        <ImageUploader
          id={friend.id}
          which="hero"
          label={friend.heroUrl ? "Hero" : "Hero (none yet)"}
          hint="Cutout on cream, about 2:3"
          currentUrl={friend.heroUrl}
          pasteTarget
        />
        <ImageUploader
          id={friend.id}
          which="alt"
          label={friend.altUrl ? "Second image" : "Second image (none yet)"}
          hint="Object or candid; shows on hover"
          currentUrl={friend.altUrl}
        />
      </div>

      <FriendForm friend={friend} />
    </div>
  );
}
