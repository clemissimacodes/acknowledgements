import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

export type Note = {
  name: string;
  slug: string;
  hook: string;
  date?: string;
  place?: string;
  example: boolean;
  bubbles: string[];
};

const NOTES_DIR = path.join(process.cwd(), "notes");

function toDateString(value: unknown): string | undefined {
  if (!value) return undefined;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  return text;
}

function bubblesFromBody(body: string): string[] {
  return body
    .split(/\n\s*\n/)
    .map((block) => block.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function parseNote(filename: string): Note {
  const raw = fs.readFileSync(path.join(NOTES_DIR, filename), "utf8");
  const { data, content } = matter(raw);
  const slug = String(data.slug ?? filename.replace(/\.md$/, ""));
  const name = String(data.name ?? slug);
  const bubbles = bubblesFromBody(content);

  if (!name.trim()) {
    throw new Error(`${filename}: frontmatter needs a name`);
  }
  if (bubbles.length === 0) {
    throw new Error(`${filename}: write at least one paragraph; each becomes a blue bubble`);
  }

  return {
    name,
    slug,
    hook: String(data.hook ?? bubbles[0] ?? ""),
    date: toDateString(data.date),
    place: data.place ? String(data.place) : undefined,
    example: Boolean(data.example),
    bubbles,
  };
}

export function getNotes(): Note[] {
  const files = fs
    .readdirSync(NOTES_DIR)
    .filter((file) => file.endsWith(".md"));

  return files
    .map(parseNote)
    .sort((a, b) => {
      const aTime = a.date ? Date.parse(a.date) : 0;
      const bTime = b.date ? Date.parse(b.date) : 0;
      return bTime - aTime;
    });
}

export function getNote(slug: string): Note | undefined {
  return getNotes().find((note) => note.slug === slug);
}
