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

// The section's name as the page's title, flush with the lede and index
// below it. On a poem or note it leads back to the section.
export function PhotoHeader({ current }: { current: Section }) {
  const section = SECTIONS.find((item) => item.id === current) ?? SECTIONS[0];
  return (
    <nav className="photo-header photo-section" aria-label="Section">
      <Link href={section.href} className="is-current">
        {section.label}
      </Link>
    </nav>
  );
}
