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

type Section = "photography" | "art-history" | "poetry";

const SECTIONS: Array<{ id: Section; href: string; label: string }> = [
  { id: "photography", href: "/photography", label: "Photography" },
  { id: "art-history", href: "/art-history", label: "Art History" },
  { id: "poetry", href: "/poetry", label: "Poetry" },
];

// Section links, laid on the same four columns as the index so they sit
// above the "P." column. The site anchor (top left) carries the name.
export function PhotoHeader({ current }: { current: Section }) {
  return (
    <nav className="photo-header" aria-label="Sections">
      <span className="photo-col-no" aria-hidden="true" />
      <span className="photo-col-title" aria-hidden="true" />
      <span className="photo-col-note">
        {SECTIONS.map((section, index) => (
          <span key={section.id}>
            <Link
              href={section.href}
              className={section.id === current ? "is-current" : undefined}
              aria-current={section.id === current ? "page" : undefined}
            >
              {section.label}
              {index < SECTIONS.length - 1 ? "," : ""}
            </Link>
            {index < SECTIONS.length - 1 ? " " : ""}
          </span>
        ))}
      </span>
    </nav>
  );
}
