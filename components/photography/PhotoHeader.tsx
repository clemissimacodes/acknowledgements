import Link from "next/link";

// The top row of the photography pages, laid on the same four columns as
// the index: initials, section links, about.
export function PhotoHeader({ current }: { current: "photography" | "roll" }) {
  return (
    <header className="photo-header">
      <span className="photo-col-no">
        <Link href="/">C.</Link>
      </span>
      <span className="photo-col-title">
        <Link href="/">K. S.</Link>
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
