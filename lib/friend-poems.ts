import { adoredPoems, poemLines, poems } from "@/lib/poems";

/* A poem for every friend. Values are either one of Clementine's poem slugs
   or "adored:<n>" for one of the borrowed poems on the poetry page. */
export type PoemPick = {
  key: string;
  title: string;
  author?: string;
  href: string;
  lines: string[]; // a couple of opening lines, own poems only
};

export const POEM_PICKS: PoemPick[] = [
  ...poems.map((poem) => ({
    key: poem.slug,
    title: poem.title,
    href: `/poetry/${poem.slug}`,
    lines: poemLines(poem).filter(Boolean).slice(0, 2),
  })),
  ...adoredPoems.map((poem, index) => ({
    key: `adored:${index}`,
    title: poem.title,
    author: poem.author,
    href: poem.href,
    lines: [],
  })),
];

export function getPoemPick(key: string): PoemPick | undefined {
  return POEM_PICKS.find((pick) => pick.key === key);
}

export function isPoemKey(value: unknown): value is string {
  return typeof value === "string" && POEM_PICKS.some((pick) => pick.key === value);
}
