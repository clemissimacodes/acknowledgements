/* Resolve a Poetry Foundation URL into { title, poet }. Used by the control-room
   poem fields so pasting a link fills the rest. PF itself is behind Cloudflare;
   we read through r.jina.ai, which returns the page as markdown. */

export type PoemMeta = { title: string; poet: string };

export function isPoetryFoundationUrl(value: string) {
  try {
    const host = new URL(value).hostname.replace(/^www\./, "");
    return host === "poetryfoundation.org";
  } catch {
    return false;
  }
}

/* Last path segment → "Introduction to the Songs of Innocence".
   Magazine URLs append a hash like "-56d23b188f238"; strip that. */
export function titleFromPoemUrl(value: string) {
  try {
    const parts = new URL(value).pathname.split("/").filter(Boolean);
    const raw = parts[parts.length - 1] ?? "";
    const cleaned = raw.replace(/-[0-9a-f]{8,}$/i, "").replace(/-/g, " ").trim();
    if (!cleaned || /^\d+$/.test(cleaned)) return "";
    return cleaned.replace(/\b\w/g, (c) => c.toUpperCase());
  } catch {
    return "";
  }
}

function stripMd(value: string) {
  return value.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/\s+/g, " ").trim();
}

export function parsePoemMarkdown(markdown: string, fallbackTitle = ""): PoemMeta {
  const titleLine = markdown.match(/^Title:\s*(.+)$/m)?.[1]?.trim() ?? "";
  let title = titleLine.replace(/\s*\|\s*The Poetry Foundation\s*$/i, "").trim();
  /* Homepage / 404 pages just say "The Poetry Foundation". */
  if (!title || /^just a moment/i.test(title) || /^the poetry foundation$/i.test(title)) {
    const heading = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? "";
    title = stripMd(heading) || fallbackTitle;
  }
  /* "By James Bertolino" or "By [Abigail Deutsch](…)" or "… Translated By …" —
     keep the poet, drop the translator credit for the shop byline. */
  const by = markdown.match(/^By\s+(.+)$/m)?.[1]?.trim() ?? "";
  const poet = stripMd(by.replace(/\s+Translated\s+By\s+.+$/i, ""));
  return { title, poet };
}

export async function lookupPoemMeta(url: string): Promise<PoemMeta> {
  const fallback = titleFromPoemUrl(url);
  if (!isPoetryFoundationUrl(url)) return { title: fallback, poet: "" };
  const target = url.replace(/^https?:\/\//, "https://");
  const res = await fetch(`https://r.jina.ai/${target}`, {
    headers: { Accept: "text/plain", "User-Agent": "clemissima-controlroom/1.0" },
    next: { revalidate: 86400 },
  });
  if (!res.ok) return { title: fallback, poet: "" };
  const text = await res.text();
  const meta = parsePoemMarkdown(text, fallback);
  return { title: meta.title || fallback, poet: meta.poet };
}
