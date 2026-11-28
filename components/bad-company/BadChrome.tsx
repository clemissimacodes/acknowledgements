"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const PATH = "/bad-company";
const DIARY = "/bad-company/diary";
const NAME = "Bad Company";

const MARQUEE =
  "you are not in good company. you know what you did. happy thanksgiving to everyone except the following.";

export function BadHeader() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => setMobileOpen(false), [pathname]);

  return (
    <header className="ff-header">
      <Link href={DIARY} className="ff-marquee" aria-label="About the clearance">
        <span className="ff-marquee-track" aria-hidden="true">
          <span>{MARQUEE} →</span>
          <span>{MARQUEE} →</span>
        </span>
        <span className="ff-sr">{MARQUEE}</span>
      </Link>

      <nav className="ff-nav" aria-label="Shop">
        <button
          type="button"
          className="ff-nav-burger"
          aria-label="Menu"
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((value) => !value)}
        >
          <span />
          <span />
        </button>

        <ul className={`ff-nav-left${mobileOpen ? " ff-nav-left-open" : ""}`}>
          <li>
            <Link href={PATH}>Clearance</Link>
          </li>
          <li>
            <Link href={DIARY}>Studio Diary</Link>
          </li>
          <li>
            <Link href="/collections/good-company">Good Company</Link>
          </li>
        </ul>

        <Link href={PATH} className="ff-logo">
          <span className="ff-logo-mark">{NAME.toUpperCase()}</span>
          <span className="ff-logo-sub">
            CLEMISSIMA<span className="bc-logo-extra"> · ALL SALES FINAL</span>
          </span>
        </Link>

        <div className="ff-nav-right">
          <span className="ff-bag-link bc-bag-off">Bag (not allowed)</span>
          <SearchForm />
        </div>
      </nav>
    </header>
  );
}

function SearchForm() {
  const router = useRouter();
  const [q, setQ] = useState("");
  return (
    <form
      className="ff-search"
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        const query = q.trim();
        router.push(query ? `${PATH}?q=${encodeURIComponent(query)}` : PATH);
      }}
    >
      <input
        type="search"
        name="q"
        value={q}
        onChange={(event) => setQ(event.target.value)}
        placeholder="SEARCH GRUDGES"
        aria-label="Search"
        autoComplete="off"
      />
      <button type="submit">Enter</button>
    </form>
  );
}

export function BadFooter() {
  return (
    <footer className="ff-footer">
      <div className="ff-footer-cols">
        <div>
          <p className="ff-footer-head">{NAME}</p>
          <p>
            The clearance rack behind Good Company. Every item is a person I am not grateful for, listed the way a
            store lists the things it is trying to get rid of. Nothing is for sale because nobody wants it.
          </p>
        </div>
        <div>
          <p className="ff-footer-head">How it works</p>
          <p>Every item is final sale. Every item is one of one, thank god.</p>
          <p>There is no bag. You may not take them home. I am not responsible if you already did.</p>
        </div>
        <div>
          <p className="ff-footer-head">Customer Complaints</p>
          <Link href={DIARY}>Studio Diary</Link>
          <span className="bc-footer-dead">Speak to a Manager (unavailable)</span>
        </div>
        <div>
          <p className="ff-footer-head">Somewhere nicer</p>
          <Link href="/collections/good-company">Good Company</Link>
          <Link href="/">Clemissima.com</Link>
        </div>
      </div>
      <p className="ff-footer-legal">
        © {new Date().getFullYear()} {NAME} · A Clemissima production · Made with spite, not inventory.
      </p>
    </footer>
  );
}

export function BadChatPill() {
  return (
    <Link href={DIARY} className="ff-chat">
      <span className="ff-chat-dot" aria-hidden="true">
        !
      </span>
      Why is this?
    </Link>
  );
}
