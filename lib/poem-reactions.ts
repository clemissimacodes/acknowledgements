import { randomUUID } from "crypto";
import { neon } from "@neondatabase/serverless";

export const POEM_REACTIONS = [
  { id: "twice", label: "read it twice" },
  { id: "molars", label: "felt it in my molars" },
  { id: "whispered", label: "whispered it aloud" },
] as const;

export type PoemReactionId = (typeof POEM_REACTIONS)[number]["id"];

export type PoemReactionState = {
  counts: Record<PoemReactionId, number>;
  mine: PoemReactionId[];
};

export function isReactionId(value: unknown): value is PoemReactionId {
  return POEM_REACTIONS.some((reaction) => reaction.id === value);
}

function db() {
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? "";
  if (!url) throw new Error("Database is not configured.");
  return neon(url);
}

async function ensureTable() {
  await db()`
    CREATE TABLE IF NOT EXISTS poem_reactions (
      id TEXT PRIMARY KEY,
      poem_slug TEXT NOT NULL,
      reaction TEXT NOT NULL,
      visitor_id TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (poem_slug, reaction, visitor_id)
    )
  `;
}

function emptyCounts() {
  return Object.fromEntries(
    POEM_REACTIONS.map((reaction) => [reaction.id, 0]),
  ) as Record<PoemReactionId, number>;
}

export async function reactionsForPoem(
  poem: string,
  visitorId: string | null,
): Promise<PoemReactionState> {
  await ensureTable();
  const sql = db();
  const [countRows, mineRows] = await Promise.all([
    sql`
      SELECT reaction, COUNT(*)::int AS count
      FROM poem_reactions
      WHERE poem_slug = ${poem}
      GROUP BY reaction
    `,
    visitorId
      ? sql`
          SELECT reaction
          FROM poem_reactions
          WHERE poem_slug = ${poem} AND visitor_id = ${visitorId}
        `
      : Promise.resolve([]),
  ]);
  const counts = emptyCounts();
  for (const row of countRows as Array<{ reaction: string; count: number }>) {
    if (isReactionId(row.reaction)) counts[row.reaction] = Number(row.count);
  }
  const mine = (mineRows as Array<{ reaction: string }>)
    .map((row) => row.reaction)
    .filter(isReactionId);
  return { counts, mine };
}

export async function toggleReaction(input: {
  poem: string;
  reaction: PoemReactionId;
  visitorId: string;
}) {
  await ensureTable();
  const sql = db();
  const removed = await sql`
    DELETE FROM poem_reactions
    WHERE poem_slug = ${input.poem}
      AND reaction = ${input.reaction}
      AND visitor_id = ${input.visitorId}
    RETURNING id
  `;
  if (removed.length === 0) {
    await sql`
      INSERT INTO poem_reactions (id, poem_slug, reaction, visitor_id)
      VALUES (${randomUUID()}, ${input.poem}, ${input.reaction}, ${input.visitorId})
      ON CONFLICT DO NOTHING
    `;
  }
  return reactionsForPoem(input.poem, input.visitorId);
}
