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

// The top row of the photography pages, laid on the same four columns as
// the index: initials, section links, about.
export function PhotoHeader({ current }: { current: "photography" | "roll" }) {
  return (
    <header className="photo-header">
      <span className="photo-col-no photo-name">
        <Link href="/" aria-label="Clementine Kay Shao">
          <span className="photo-abbr" data-short="C." data-full="Clementine Kay Shao" />
        </Link>
      </span>
      <span className="photo-col-title photo-name">
        <Link href="/" aria-label="Clementine Kay Shao">
          <span className="photo-abbr" data-short="K. S." data-full="" />
        </Link>
      </span>
      <span className="photo-col-note">
        <Link
          href="/photography"
          className={current === "photography" ? "is-current" : undefined}
        >
          Photography,
        </Link>{" "}
        <Link href="/poetry">Poetry</Link>
      </span>
      <span className="photo-col-year">
        <Link href="/about">About</Link>
      </span>
    </header>
  );
}
