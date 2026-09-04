import snapshot from "@/data/acknowledgements.json";
import { fetchAcknowledgementRows } from "@/lib/notion";
import {
  RELATIONSHIPS,
  type Note,
  type Relationship,
} from "@/lib/types";

export type { Note, Relationship } from "@/lib/types";
export { RELATIONSHIPS, RELATIONSHIP_LABELS } from "@/lib/types";

export type AcknowledgementRow = {
  name: string;
  slug: string;
  first?: string;
  last?: string;
  place?: string;
  date?: string;
  notes?: string;
  relationship?: string;
  example?: boolean;
  message?: string;
};

function optionalString(value: unknown): string | undefined {
  const text = String(value ?? "").trim();
  return text ? text : undefined;
}

function parseRelationship(value: unknown): Relationship | undefined {
  const text = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
  return RELATIONSHIPS.find((item) => item === text);
}

export function bubblesFromMessage(body: string): string[] {
  const blocks = body
    .split(/\n\s*\n/)
    .map((block) => block.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  if (blocks.length !== 1) return blocks;
  return blocks[0]
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function rowToNote(row: AcknowledgementRow): Note {
  const bubbles = bubblesFromMessage(row.message ?? "");
  const name = row.name.trim();
  const slug = (row.slug || name).trim();

  return {
    name,
    slug,
    hook: bubbles[0] ?? "",
    first: optionalString(row.first),
    last: optionalString(row.last),
    notes: optionalString(row.notes),
    date: optionalString(row.date),
    place: optionalString(row.place),
    relationship: parseRelationship(row.relationship),
    example: Boolean(row.example),
    bubbles,
  };
}

function sortNotes(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => {
    const aTime = a.date ? Date.parse(a.date) : 0;
    const bTime = b.date ? Date.parse(b.date) : 0;
    if (bTime !== aTime) return bTime - aTime;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}

export async function getNotes(): Promise<Note[]> {
  try {
    const live = await fetchAcknowledgementRows();
    if (live) return sortNotes(live.map(rowToNote));
  } catch (error) {
    console.error("Notion is unavailable; using the last snapshot.", error);
  }

  return sortNotes((snapshot as AcknowledgementRow[]).map(rowToNote));
}

export async function getNote(slug: string): Promise<Note | undefined> {
  const notes = await getNotes();
  return notes.find((note) => note.slug === slug);
}
