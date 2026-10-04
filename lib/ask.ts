import "server-only";

import { createHmac, randomUUID } from "crypto";
import { neon } from "@neondatabase/serverless";

// "Ask me anything": anonymous questions, thoughts and well wishes. No name,
// no email. Each one gets a page where the reply lives, and a small count of
// how many times it has been opened.

export type AskQuestion = {
  id: string;
  body: string;
  answer: string | null;
  opens: number;
  createdAt: string;
  answeredAt: string | null;
};

export const ASK_MAX_LENGTH = 600;
export const ASK_ANSWER_MAX_LENGTH = 4000;

function databaseUrl() {
  return process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? "";
}

function db() {
  const url = databaseUrl();
  if (!url) throw new Error("Database is not configured.");
  return neon(url);
}

function cleanText(value: unknown, maximum: number) {
  return String(value ?? "")
    .replace(/\0/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maximum);
}

function cleanId(value: unknown) {
  const id = String(value ?? "").trim();
  if (!/^[A-Za-z0-9-]{8,80}$/.test(id)) throw new Error("Unknown question.");
  return id;
}

function hashIp(ip: string) {
  const secret =
    process.env.VISITOR_HASH_SECRET ??
    process.env.CLERK_SECRET_KEY ??
    process.env.ADMIN_EMAIL;
  if (!ip || !secret) return null;
  return createHmac("sha256", secret).update(ip).digest("hex");
}

let ready: Promise<void> | null = null;

function ensureTable() {
  if (!ready) {
    ready = (async () => {
      await db()`
        CREATE TABLE IF NOT EXISTS ask_questions (
          id TEXT PRIMARY KEY,
          body TEXT NOT NULL,
          answer TEXT,
          opens INTEGER NOT NULL DEFAULT 0,
          ip_hash TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          answered_at TIMESTAMPTZ
        )
      `;
    })().catch((error) => {
      ready = null;
      throw error;
    });
  }
  return ready;
}

function mapQuestion(row: Record<string, unknown>): AskQuestion {
  return {
    id: String(row.id),
    body: String(row.body),
    answer: row.answer ? String(row.answer) : null,
    opens: Number(row.opens ?? 0),
    createdAt: new Date(row.created_at as string | Date).toISOString(),
    answeredAt: row.answered_at
      ? new Date(row.answered_at as string | Date).toISOString()
      : null,
  };
}

export async function submitAskQuestion(input: {
  body: unknown;
  website: unknown;
  ip: string;
}) {
  // Honeypot: real people never fill the hidden "website" field.
  if (cleanText(input.website, 100)) return null;
  const body = cleanText(input.body, ASK_MAX_LENGTH);
  if (body.length < 2) throw new Error("Say a little more.");

  await ensureTable();
  const ipHash = hashIp(input.ip);
  if (ipHash) {
    const recent = (await db()`
      SELECT COUNT(*)::int AS count
      FROM ask_questions
      WHERE ip_hash = ${ipHash}
        AND created_at > NOW() - INTERVAL '1 hour'
    `) as Array<{ count: number }>;
    if (Number(recent[0]?.count ?? 0) >= 8) {
      throw new Error("That is plenty for one hour. Come back later.");
    }
  }

  const id = randomUUID();
  await db()`
    INSERT INTO ask_questions (id, body, ip_hash)
    VALUES (${id}, ${body}, ${ipHash})
  `;
  return id;
}

// Newest first: a fresh question appears at the top of the index.
export async function listAskQuestions(limit = 400) {
  await ensureTable();
  const rows = (await db()`
    SELECT id, body, answer, opens, created_at, answered_at
    FROM ask_questions
    ORDER BY created_at DESC
    LIMIT ${limit}
  `) as Array<Record<string, unknown>>;
  return rows.map(mapQuestion);
}

export async function getAskQuestion(idValue: unknown) {
  let id: string;
  try {
    id = cleanId(idValue);
  } catch {
    return null;
  }
  await ensureTable();
  const rows = (await db()`
    SELECT id, body, answer, opens, created_at, answered_at
    FROM ask_questions WHERE id = ${id} LIMIT 1
  `) as Array<Record<string, unknown>>;
  return rows[0] ? mapQuestion(rows[0]) : null;
}

// Count a visit and return the question in one round trip.
export async function openAskQuestion(idValue: unknown) {
  let id: string;
  try {
    id = cleanId(idValue);
  } catch {
    return null;
  }
  await ensureTable();
  const rows = (await db()`
    UPDATE ask_questions
    SET opens = opens + 1
    WHERE id = ${id}
    RETURNING id, body, answer, opens, created_at, answered_at
  `) as Array<Record<string, unknown>>;
  return rows[0] ? mapQuestion(rows[0]) : null;
}

export async function getPendingAskCount() {
  await ensureTable();
  const rows = (await db()`
    SELECT COUNT(*)::int AS count
    FROM ask_questions
    WHERE answer IS NULL OR answer = ''
  `) as Array<{ count: number }>;
  return Number(rows[0]?.count ?? 0);
}

export async function answerAskQuestion(idValue: unknown, answerValue: unknown) {
  const id = cleanId(idValue);
  const answer = cleanText(answerValue, ASK_ANSWER_MAX_LENGTH);
  await ensureTable();
  if (!answer) {
    await db()`
      UPDATE ask_questions SET answer = NULL, answered_at = NULL WHERE id = ${id}
    `;
    return;
  }
  await db()`
    UPDATE ask_questions
    SET answer = ${answer},
        answered_at = COALESCE(answered_at, NOW())
    WHERE id = ${id}
  `;
}

export async function deleteAskQuestion(idValue: unknown) {
  const id = cleanId(idValue);
  await ensureTable();
  await db()`DELETE FROM ask_questions WHERE id = ${id}`;
}
