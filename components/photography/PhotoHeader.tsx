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

type Section = "poetry" | "ask";

const SECTIONS: Array<{ id: Section; href: string; label: string }> = [
  { id: "poetry", href: "/poetry", label: "Poetry" },
  { id: "ask", href: "/ask", label: "Leave a Note" },
];

// The section's own name, laid on the same four columns as the index so it
// sits above the "P." column. The site anchor (top left) carries the name.
export function PhotoHeader({ current }: { current: Section }) {
  const section = SECTIONS.find((item) => item.id === current) ?? SECTIONS[0];
  return (
    <nav className="photo-header" aria-label="Section">
      <span className="photo-col-no" aria-hidden="true" />
      <span className="photo-col-title" aria-hidden="true" />
      <span className="photo-col-note">
        <Link href={section.href} className="is-current" aria-current="page">
          {section.label}
        </Link>
      </span>
    </nav>
  );
}
