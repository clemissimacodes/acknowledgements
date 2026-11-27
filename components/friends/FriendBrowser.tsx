"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { deleteFriendForm, toggleVisibleForm } from "@/app/(shop)/actions";
import type { SaveStatus } from "@/components/admin/AutoSaveForm";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { FORM_TABS, FriendForm, type FormTab } from "@/components/friends/FriendForm";
import { ImageUploader } from "@/components/friends/ImageUploader";
import { VoiceUploader } from "@/components/friends/VoiceUploader";
import { FRIEND_ERAS, collectionLabel, eraLabel, formatBirthday, priceLabel, type Friend } from "@/lib/friend-types";

/* What a finished listing needs, and which tab fixes it. Order = order of the dots in the list. */
const CHECKS = [
  { key: "hero", label: "Hero photo", tab: "photos", test: (f: Friend) => Boolean(f.heroUrl) },
  { key: "alt", label: "Second photo", tab: "photos", test: (f: Friend) => Boolean(f.altUrl) },
  { key: "extra", label: "Third photo", tab: "photos", test: (f: Friend) => Boolean(f.extraUrl) },
  { key: "birthday", label: "Birthday", tab: "details", test: (f: Friend) => Boolean(f.birthday) },
  { key: "collection", label: "Collection", tab: "details", test: (f: Friend) => Boolean(f.collection) },
  { key: "hometown", label: "Hometown", tab: "details", test: (f: Friend) => Boolean(f.hometown) },
  { key: "metHow", label: "How we met", tab: "details", test: (f: Friend) => Boolean(f.metHow) },
  { key: "memory", label: "Memory", tab: "words", test: (f: Friend) => Boolean(f.favoriteMemory) },
  { key: "poem", label: "Poem", tab: "poem", test: (f: Friend) => Boolean(f.poemUrl) },
  { key: "madeOf", label: "Made of", tab: "madeOf", test: (f: Friend) => f.madeOf.length >= 2 },
  { key: "voice", label: "Voice note", tab: "photos", test: (f: Friend) => Boolean(f.voiceUrl) },
  { key: "anthem", label: "Anthem", tab: "words", test: (f: Friend) => Boolean(f.anthemUrl) },
] as const satisfies readonly { key: string; label: string; tab: FormTab; test: (f: Friend) => boolean }[];
type CheckKey = (typeof CHECKS)[number]["key"];

function missing(f: Friend) {
  return CHECKS.filter((c) => !c.test(f));
}

const TAB_KEY = "ff-tab";
const isTab = (v: string | null): v is FormTab => FORM_TABS.some((t) => t.key === v);

type Props = { friends: Friend[] };

export function FriendBrowser({ friends }: Props) {
  const [query, setQuery] = useState("");
  const [era, setEra] = useState("");
  const [need, setNeed] = useState<CheckKey | "">("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTabState] = useState<FormTab>("details");
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLOListElement>(null);

  /* Selection lives in the hash so it survives saves (router.refresh) and reloads.
     The tab lives in localStorage so "Made of" stays open while you walk the list. */
  useEffect(() => {
    const fromHash = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      setSelectedId(id && friends.some((f) => f.id === id) ? id : (friends[0]?.id ?? null));
    };
    fromHash();
    const saved = window.localStorage.getItem(TAB_KEY);
    if (isTab(saved)) setTabState(saved);
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, [friends]);

  const setTab = (next: FormTab) => {
    setTabState(next);
    window.localStorage.setItem(TAB_KEY, next);
  };

  const select = (id: string) => {
    setSelectedId(id);
    history.replaceState(null, "", `#${id}`);
  };

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return friends.filter(
      (f) =>
        (!era || f.era === era) &&
        (!need || missing(f).some((c) => c.key === need)) &&
        (!q ||
          f.nickname.toLowerCase().includes(q) ||
          f.productName.toLowerCase().includes(q) ||
          f.hometown.toLowerCase().includes(q) ||
          f.notes.toLowerCase().includes(q)),
    );
  }, [friends, query, era, need]);

  const selected = friends.find((f) => f.id === selectedId) ?? null;
  const index = visible.findIndex((f) => f.id === selectedId);
  const step = (dir: 1 | -1) => {
    const next = visible[Math.min(visible.length - 1, Math.max(0, (index < 0 ? (dir > 0 ? -1 : 0) : index) + dir))];
    if (next) select(next.id);
  };
  const prev = index > 0 ? visible[index - 1] : null;
  const next = index >= 0 && index < visible.length - 1 ? visible[index + 1] : index < 0 ? (visible[0] ?? null) : null;

  /* Keys: ↑↓ / j k move (j k only outside inputs); Alt+↑↓ moves from anywhere;
     1–5 switch tabs outside inputs; "/" focuses search; Esc clears it. */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = Boolean(target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
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
      if (!typing && /^[1-5]$/.test(event.key) && !event.metaKey && !event.ctrlKey && !event.altKey) {
        const t = FORM_TABS[Number(event.key) - 1];
        if (t) setTab(t.key);
        return;
      }
      const inSearch = target === searchRef.current;
      const arrowDown = event.key === "ArrowDown";
      const arrowUp = event.key === "ArrowUp";
      if (event.altKey && (arrowDown || arrowUp)) {
        event.preventDefault();
        (target as HTMLElement | null)?.blur?.();
        step(arrowDown ? 1 : -1);
        return;
      }
      if (typing && !inSearch) return;
      const down = arrowDown || (!typing && event.key === "j");
      const up = arrowUp || (!typing && event.key === "k");
      if (!down && !up) return;
      event.preventDefault();
      step(down ? 1 : -1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[aria-current="true"]')?.scrollIntoView({ block: "nearest" });
  }, [selectedId]);

  const done = friends.filter((f) => missing(f).length === 0).length;

  return (
    <div className="admin-studio">
      <aside className="admin-studio-side">
        <div className="admin-browser-tools">
          <input
            ref={searchRef}
            type="search"
            placeholder="Search  ( / )"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="admin-browser-tools-row">
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
        </div>
        <p className="admin-muted admin-browser-count">
          {visible.length} of {friends.length} · {done} complete
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
                  title={gaps.length ? `Missing: ${gaps.map((c) => c.label.toLowerCase()).join(", ")}` : "Complete"}
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
        <p className="admin-muted admin-browser-keys">
          ↑↓ or j k to move · ⌥↑↓ while typing · 1–5 for tabs · / to search
        </p>
      </aside>

      <section className="admin-studio-main">
        {selected ? (
          <FriendPanel
            key={selected.id}
            friend={selected}
            tab={tab}
            setTab={setTab}
            prev={prev}
            next={next}
            position={index >= 0 ? `${index + 1} / ${visible.length}` : ""}
            onStep={step}
          />
        ) : (
          <p className="admin-muted">Pick someone on the left.</p>
        )}
      </section>
    </div>
  );
}

type PanelProps = {
  friend: Friend;
  tab: FormTab;
  setTab: (tab: FormTab) => void;
  prev: Friend | null;
  next: Friend | null;
  position: string;
  onStep: (dir: 1 | -1) => void;
};

function FriendPanel({ friend, tab, setTab, prev, next, position, onStep }: PanelProps) {
  const gaps = missing(friend);
  const [status, setStatus] = useState<SaveStatus>({ state: "idle", text: "" });
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
  }, [tab]);

  return (
    <div className="admin-studio-panel">
      <header className="admin-studio-head">
        <div className="admin-studio-nav">
          <button type="button" onClick={() => onStep(-1)} disabled={!prev} title={prev ? `← ${prev.nickname}` : undefined}>
            ←
          </button>
          <button type="button" onClick={() => onStep(1)} disabled={!next} title={next ? `${next.nickname} →` : undefined}>
            →
          </button>
          {position ? <small>{position}</small> : null}
        </div>
        <div className="admin-studio-title">
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
        </div>
        <div className="admin-studio-side-actions">
          <span className={`admin-autosave admin-autosave-${status.state}`} aria-live="polite">
            {status.text}
          </span>
          <div className="admin-roll-actions">
            <form action={toggleVisibleForm}>
              <input type="hidden" name="id" value={friend.id} />
              <input type="hidden" name="visible" value={friend.visible ? "false" : "true"} />
              <button type="submit">{friend.visible ? "Hide" : "Show"}</button>
            </form>
            <form action={deleteFriendForm}>
              <input type="hidden" name="id" value={friend.id} />
              <ConfirmButton className="admin-danger" message={`Delete ${friend.nickname} and their photos? This cannot be undone.`}>
                Delete
              </ConfirmButton>
            </form>
          </div>
        </div>
      </header>

      <nav className="admin-tabs" aria-label="Sections">
        {FORM_TABS.map((t, i) => {
          const todo = gaps.filter((c) => c.tab === t.key).length;
          return (
            <button
              key={t.key}
              type="button"
              className={t.key === tab ? "is-on" : undefined}
              aria-current={t.key === tab ? "page" : undefined}
              onClick={() => setTab(t.key)}
              title={`${i + 1}`}
            >
              {t.label}
              {todo ? <i className="admin-tabs-dot" aria-label={`${todo} missing`} /> : null}
            </button>
          );
        })}
        <span className={`admin-tabs-gaps${gaps.length ? "" : " is-ok"}`}>
          {gaps.length ? `Missing: ${gaps.map((c) => c.label.toLowerCase()).join(", ")}` : "Complete."}
        </span>
      </nav>

      <div ref={bodyRef} className="admin-studio-body">
        <div className="admin-friend-images" hidden={tab !== "photos"}>
          <ImageUploader
            id={friend.id}
            which="hero"
            label={friend.heroUrl ? "Hero" : "Hero (none yet)"}
            hint="Auto-cropped to 4:5, anchored at the feet. Cutouts keep their transparency."
            currentUrl={friend.heroUrl}
            pasteTarget
          />
          <ImageUploader
            id={friend.id}
            which="alt"
            label={friend.altUrl ? "Second image" : "Second image (none yet)"}
            hint="Auto-cropped to 4:5, centred. Shows on hover / as photo 2."
            currentUrl={friend.altUrl}
          />
          <ImageUploader
            id={friend.id}
            which="extra"
            label={friend.extraUrl ? "Third image" : "Third image (none yet)"}
            hint="Auto-cropped to 4:5, centred. Photo 3 on the product page."
            currentUrl={friend.extraUrl}
          />
          <VoiceUploader
            id={friend.id}
            currentUrl={friend.voiceUrl}
            currentDurationMs={friend.voiceDurationMs}
          />
        </div>
        <FriendForm friend={friend} tab={tab} onStatus={setStatus} />
      </div>
    </div>
  );
}
