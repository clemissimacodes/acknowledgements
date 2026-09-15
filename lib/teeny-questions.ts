import "server-only";

import { createHmac, randomUUID } from "crypto";
import { neon } from "@neondatabase/serverless";

export type TeenyQuestion = {
  id: string;
  question: string;
  name: string | null;
  answer: string | null;
  createdAt: string;
  answeredAt: string | null;
};

function databaseUrl() {
  return process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? "";
}

function db() {
  const url = databaseUrl();
  if (!url) throw new Error("Database is not configured.");
  return neon(url);
}

function cleanLine(value: unknown, maximum: number) {
  return String(value ?? "")
    .replace(/\0/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
}

function hashIp(ip: string) {
  const secret =
    process.env.VISITOR_HASH_SECRET ??
    process.env.CLERK_SECRET_KEY ??
    process.env.ADMIN_EMAIL;
  if (!ip || !secret) return null;
  return createHmac("sha256", secret).update(ip).digest("hex");
}

async function ensureTable() {
  await db()`
    CREATE TABLE IF NOT EXISTS teeny_tiny_questions (
      id TEXT PRIMARY KEY,
      question TEXT NOT NULL,
      name TEXT,
      answer TEXT,
      ip_hash TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      answered_at TIMESTAMPTZ
    )
  `;
}

function mapQuestion(row: Record<string, unknown>): TeenyQuestion {
  return {
    id: String(row.id),
    question: String(row.question),
    name: row.name ? String(row.name) : null,
    answer: row.answer ? String(row.answer) : null,
    createdAt: new Date(row.created_at as string | Date).toISOString(),
    answeredAt: row.answered_at
      ? new Date(row.answered_at as string | Date).toISOString()
      : null,
  };
}

export async function submitTeenyQuestion(input: {
  question: unknown;
  name: unknown;
  website: unknown;
  ip: string;
}) {
  if (cleanLine(input.website, 100)) return;
  const question = cleanLine(input.question, 500);
  const name = cleanLine(input.name, 80);
  if (question.length < 3) throw new Error("Ask a little more.");

  await ensureTable();
  const ipHash = hashIp(input.ip);
  if (ipHash) {
    const recent = (await db()`
      SELECT COUNT(*)::int AS count
      FROM teeny_tiny_questions
      WHERE ip_hash = ${ipHash}
        AND created_at > NOW() - INTERVAL '1 hour'
    `) as Array<{ count: number }>;
    if (Number(recent[0]?.count ?? 0) >= 5) {
      throw new Error("That is enough tiny things for one hour.");
    }
  }

  await db()`
    INSERT INTO teeny_tiny_questions (id, question, name, ip_hash)
    VALUES (${randomUUID()}, ${question}, ${name || null}, ${ipHash})
  `;
}

export async function getAnsweredTeenyQuestions() {
  await ensureTable();
  const rows = (await db()`
    SELECT id, question, name, answer, created_at, answered_at
    FROM teeny_tiny_questions
    WHERE answer IS NOT NULL AND answer <> ''
    ORDER BY answered_at ASC
  `) as Array<Record<string, unknown>>;
  return rows.map(mapQuestion);
}

export async function getAllTeenyQuestions() {
  await ensureTable();
  const rows = (await db()`
    SELECT id, question, name, answer, created_at, answered_at
    FROM teeny_tiny_questions
    ORDER BY created_at DESC
    LIMIT 250
  `) as Array<Record<string, unknown>>;
  return rows.map(mapQuestion);
}

export async function getPendingTeenyQuestionCount() {
  await ensureTable();
  const rows = (await db()`
    SELECT COUNT(*)::int AS count
    FROM teeny_tiny_questions
    WHERE answer IS NULL OR answer = ''
  `) as Array<{ count: number }>;
  return Number(rows[0]?.count ?? 0);
}

export async function answerTeenyQuestion(idValue: unknown, answerValue: unknown) {
  const id = cleanLine(idValue, 100);
  const answer = cleanLine(answerValue, 1000);
  if (!/^[A-Za-z0-9-]{1,100}$/.test(id) || !answer) {
    throw new Error("A question and answer are required.");
  }
  await ensureTable();
  await db()`
    UPDATE teeny_tiny_questions
    SET answer = ${answer}, answered_at = NOW()
    WHERE id = ${id}
  `;
}

export async function deleteTeenyQuestion(idValue: unknown) {
  const id = cleanLine(idValue, 100);
  if (!/^[A-Za-z0-9-]{1,100}$/.test(id)) throw new Error("Invalid question.");
  await ensureTable();
  await db()`DELETE FROM teeny_tiny_questions WHERE id = ${id}`;
}
