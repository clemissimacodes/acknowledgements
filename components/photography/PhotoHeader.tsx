import Link from "next/link";

// A label that reads as its abbreviation until hovered (or focused), when
// the full word is revealed. Rendered through CSS attr() so the swap is
// instant and needs no JavaScript.
export function Abbr({ short, full }: { short: string; full: string }) {
  return (
    <span
      className="photo-abbr"
      data-short={short}
      data-full={full}
      aria-label={full}
    />
  );
}

// Section links, laid on the same four columns as the index so they sit
// above the "P." column. The site anchor (top left) carries the name.
export function PhotoHeader({ current }: { current: "photography" | "roll" }) {
  return (
    <nav className="photo-header" aria-label="Sections">
      <span className="photo-col-no" aria-hidden="true" />
      <span className="photo-col-title" aria-hidden="true" />
      <span className="photo-col-note">
        <Link
          href="/photography"
          className={current === "photography" ? "is-current" : undefined}
          aria-current={current === "photography" ? "page" : undefined}
        >
          Photography,
        </Link>{" "}
        <Link href="/poetry">Poetry</Link>
      </span>
    </nav>
  );
}
