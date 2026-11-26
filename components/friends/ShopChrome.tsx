"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { DIARY_PATH, FRIEND_ERAS, SALE_NAME, SHOP_HANDLE, SHOP_NAME, formatPrice } from "@/lib/friend-types";
import { sumPrices, useBag } from "./bag";

const MARQUEE = `${SALE_NAME} ♡ 0% off everything ♡ Buy one, get nothing ♡ Prices only go up ♡ Nothing ships ♡ Doorbusters unavailable, we don't have a door`;

export function ShopHeader() {
  const bag = useBag();
  const pathname = usePathname();
  const [menu, setMenu] = useState<"shop" | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setMenu(null);
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menu) return;
    const close = (event: PointerEvent) => {
      if (!navRef.current?.contains(event.target as Node)) setMenu(null);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [menu]);

  return (
    <header className="ff-header">
      <Link href={DIARY_PATH} className="ff-marquee" aria-label="About the sale">
        <span className="ff-marquee-track" aria-hidden="true">
          <span>{MARQUEE} →</span>
          <span>{MARQUEE} →</span>
        </span>
        <span className="ff-sr">{MARQUEE}</span>
      </Link>

      <nav ref={navRef} className="ff-nav" aria-label="Shop">
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
            <Link href="/">Home</Link>
          </li>
          <li className="ff-nav-item">
            <button
              type="button"
              aria-expanded={menu === "shop"}
              onClick={() => setMenu(menu === "shop" ? null : "shop")}
            >
              Shop <Chevron />
            </button>
            <ul className={`ff-dropdown${menu === "shop" ? " ff-dropdown-open" : ""}`}>
              <li>
                <Link href={`/collections/${SHOP_HANDLE}`}>View All</Link>
              </li>
              {FRIEND_ERAS.map((era) => (
                <li key={era.handle}>
                  <Link href={`/collections/${era.handle}`}>{era.label}</Link>
                </li>
              ))}
            </ul>
          </li>
          <li>
            <Link href={DIARY_PATH}>Studio Diary</Link>
          </li>
        </ul>

        <Link href={`/collections/${SHOP_HANDLE}`} className="ff-logo">
          <span className="ff-logo-mark">{SHOP_NAME.toUpperCase()}</span>
        </Link>

        <div className="ff-nav-right">
          <button type="button" className="ff-bag-link" onClick={() => bag.setOpen(true)}>
            Bag {String(bag.items.length).padStart(2, "0")}
          </button>
        </div>
      </nav>
    </header>
  );
}

function Chevron() {
  return (
    <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true">
      <path d="M1 2.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

export function BagDrawer() {
  const bag = useBag();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!bag.open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") bag.setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.documentElement.classList.add("ff-locked");
    return () => {
      window.removeEventListener("keydown", onKey);
      document.documentElement.classList.remove("ff-locked");
    };
  }, [bag]);

  const checkout = async () => {
    if (!bag.items.length || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/friends/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slugs: bag.items.map((item) => item.slug), note }),
      });
      const data = (await response.json()) as { id?: string; error?: string };
      if (!response.ok || !data.id) {
        setError(data.error ?? "Checkout is having a moment.");
        return;
      }
      bag.clear();
      bag.setOpen(false);
      router.push(`/receipt/${data.id}`);
    } catch {
      setError("Checkout is having a moment.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div
        className={`ff-scrim${bag.open ? " ff-scrim-open" : ""}`}
        onClick={() => bag.setOpen(false)}
        aria-hidden="true"
      />
      <aside
        className={`ff-drawer${bag.open ? " ff-drawer-open" : ""}`}
        aria-label="Bag"
        aria-hidden={!bag.open}
      >
        <header className="ff-drawer-head">
          <h2>Bag ({bag.items.length})</h2>
          <button type="button" onClick={() => bag.setOpen(false)} aria-label="Close bag">
            Close
          </button>
        </header>

        {bag.items.length ? (
          <ul className="ff-drawer-list">
            {bag.items.map((item) => (
              <li key={item.slug}>
                <Link href={`/products/${item.slug}`} className="ff-drawer-thumb">
                  {item.heroUrl ? <img src={item.heroUrl} alt="" /> : <span />}
                </Link>
                <div className="ff-drawer-meta">
                  <p className="ff-drawer-name">{item.nickname}</p>
                  {item.productName ? <p className="ff-drawer-sub">{item.productName}</p> : null}
                  <p className="ff-drawer-sub">Qty 1 · the only one</p>
                  <button type="button" onClick={() => bag.remove(item.slug)}>
                    Remove
                  </button>
                </div>
                <p className="ff-drawer-price">{item.price ? `$ ${formatPrice(item.price)}` : "P.O.R."}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="ff-drawer-empty">
            Your bag is empty. <br />
            <Link href={`/collections/${SHOP_HANDLE}`}>Go find your people.</Link>
          </p>
        )}

        {bag.items.length ? (
          <footer className="ff-drawer-foot">
            <label className="ff-drawer-note">
              <span>Gift note (optional)</span>
              <textarea
                value={note}
                maxLength={280}
                rows={2}
                placeholder="printed on the receipt"
                onChange={(event) => setNote(event.target.value)}
              />
            </label>
            <div className="ff-drawer-total">
              <span>Subtotal</span>
              <span>$ {formatPrice(sumPrices(bag.items))} USD</span>
            </div>
            <div className="ff-drawer-total ff-drawer-total-sub">
              <span>Shipping</span>
              <span>Free (nothing ships)</span>
            </div>
            <div className="ff-drawer-total ff-drawer-total-sub">
              <span>Due today</span>
              <span>$ 0 USD</span>
            </div>
            <p className="ff-drawer-fine">
              Nothing is charged and nothing ships. Checkout makes a receipt you can share.
            </p>
            {error ? <p className="ff-error">{error}</p> : null}
            <button type="button" className="ff-pill ff-pill-dark" disabled={busy} onClick={checkout}>
              {busy ? "Processing…" : "Checkout"}
            </button>
          </footer>
        ) : null}
      </aside>
    </>
  );
}

export function ShopFooter() {
  return (
    <footer className="ff-footer">
      <div className="ff-footer-cols">
        <div>
          <p className="ff-footer-head">{SHOP_NAME}</p>
          <p>
            A Black Friday sale where every product is a real person in my life: my friends and my family,
            listed the way a store lists clothes. Nothing is for sale. You're in good company.
          </p>
        </div>
        <div>
          <p className="ff-footer-head">How it works</p>
          <p>Every price is a date, read as dollars. September 15 is $915. Which date is in the studio diary.</p>
          <p>Add people to your bag and check out. You get a receipt to share. No one is charged; nothing ships.</p>
          <p>Gift cards are not available. You cannot give someone a person.</p>
        </div>
        <div>
          <p className="ff-footer-head">Customer Care</p>
          <Link href={DIARY_PATH}>Studio Diary</Link>
          <Link href="/ask">Chat With Us</Link>
          <Link href="/admin">Staff Only</Link>
        </div>
        <div>
          <p className="ff-footer-head">Elsewhere</p>
          <Link href="/">Clemissima.com</Link>
          <Link href="/voice-memos">Voice Memos</Link>
          <Link href="/poetry">Poetry</Link>
        </div>
      </div>
      <p className="ff-footer-legal">
        © {new Date().getFullYear()} {SHOP_NAME} · A Clemissima production · Made with love, not inventory.
      </p>
    </footer>
  );
}

export function ChatPill() {
  return (
    <Link href={DIARY_PATH} className="ff-chat">
      <span className="ff-chat-dot" aria-hidden="true">
        ?
      </span>
      What is this?
    </Link>
  );
}
