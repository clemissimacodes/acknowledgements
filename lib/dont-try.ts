import "server-only";

import { neon } from "@neondatabase/serverless";

export const DONT_TRY_START = "2026-09-10";
export const DONT_TRY_DAYS = 100;
export const DONT_TRY_CHALLENGE_ID = "clementine";

export type DontTryStatus = "pending" | "complete" | "partial" | "missed";

export type DontTryEntry = {
  day: number;
  date: string;
  status: DontTryStatus;
  studyPoem: string;
  studyAuthor: string;
  studyNotes: string;
  steps: number | null;
  eatComplete: boolean | null;
  eatNotes: string;
  act: string;
  actDifficulty: number | null;
  workout: string;
  durationMinutes: number | null;
  plankSeconds: number | null;
  trainNotes: string;
  verdict: string;
  setsAbandoned: number;
  abandonedNotes: string;
  publishedAt: string | null;
  updatedAt: string;
};

export type DontTryInput = Omit<
  DontTryEntry,
  "date" | "publishedAt" | "updatedAt"
>;

export type DontTryStats = {
  publishedDays: number;
  completeDays: number;
  partialDays: number;
  missedDays: number;
  studyDays: number;
  walkDays: number;
  eatDays: number;
  actDays: number;
  trainDays: number;
  currentPlankSeconds: number | null;
  longestPlankSeconds: number | null;
  totalSteps: number;
  setsAbandoned: number;
};

function databaseUrl() {
  return process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? "";
}

function db() {
  const url = databaseUrl();
  if (!url) throw new Error("DON’T TRY database is not configured.");
  return neon(url);
}

function dateForDay(day: number) {
  const date = new Date(`${DONT_TRY_START}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + day - 1);
  return date.toISOString().slice(0, 10);
}

function iso(value: string | Date | null) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function cleanLine(value: unknown, max: number) {
  return String(value ?? "")
    .replace(/\0/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function cleanText(value: unknown, max: number) {
  return String(value ?? "")
    .replace(/\0/g, "")
    .replace(/\r\n?/g, "\n")
    .trim()
    .slice(0, max);
}

function boundedInteger(
  value: unknown,
  minimum: number,
  maximum: number,
  optional = true,
) {
  if (optional && (value === "" || value === null || value === undefined)) {
    return null;
  }
  const number = Number(value);
  if (!Number.isInteger(number) || number < minimum || number > maximum) {
    throw new Error(`Expected a whole number from ${minimum} to ${maximum}.`);
  }
  return number;
}

function cleanStatus(value: unknown): DontTryStatus {
  if (
    value === "pending" ||
    value === "complete" ||
    value === "partial" ||
    value === "missed"
  ) {
    return value;
  }
  throw new Error("Invalid day status.");
}

function nullableBoolean(value: unknown) {
  if (value === true || value === "yes" || value === "true") return true;
  if (value === false || value === "no" || value === "false") return false;
  return null;
}

async function ensureDontTryTable() {
  await db()`
    CREATE TABLE IF NOT EXISTS dont_try_challenges (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      owner_user_id TEXT,
      display_name TEXT NOT NULL,
      start_date DATE NOT NULL,
      duration_days INTEGER NOT NULL DEFAULT 100,
      study_promise TEXT NOT NULL,
      walk_promise TEXT NOT NULL,
      eat_promise TEXT NOT NULL,
      act_promise TEXT NOT NULL,
      train_promise TEXT NOT NULL,
      is_public BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await db()`
    INSERT INTO dont_try_challenges (
      id, slug, display_name, start_date, duration_days, study_promise,
      walk_promise, eat_promise, act_promise, train_promise, is_public
    )
    VALUES (
      ${DONT_TRY_CHALLENGE_ID}, 'clementine', 'Clementine Kay Shao',
      ${DONT_TRY_START}, ${DONT_TRY_DAYS},
      'Deeply study one poem every day.',
      'Walk 12,000 steps every day.',
      'Whole foods. No added sugar, alcohol, or recreational drugs.',
      'Do one uncomfortable, difficult, vulnerable, or scary thing.',
      'Complete one hard workout. Work toward an eight-minute plank.',
      TRUE
    )
    ON CONFLICT (id) DO NOTHING
  `;
  await db()`
    CREATE TABLE IF NOT EXISTS dont_try_daily_entries (
      challenge_id TEXT NOT NULL REFERENCES dont_try_challenges(id)
        ON DELETE CASCADE,
      day_number INTEGER NOT NULL CHECK (day_number BETWEEN 1 AND 100),
      entry_date DATE NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'complete', 'partial', 'missed')),
      study_poem TEXT NOT NULL DEFAULT '',
      study_author TEXT NOT NULL DEFAULT '',
      study_notes TEXT NOT NULL DEFAULT '',
      steps INTEGER CHECK (steps IS NULL OR steps BETWEEN 0 AND 1000000),
      eat_complete BOOLEAN,
      eat_notes TEXT NOT NULL DEFAULT '',
      act_text TEXT NOT NULL DEFAULT '',
      act_difficulty INTEGER
        CHECK (act_difficulty IS NULL OR act_difficulty BETWEEN 1 AND 10),
      workout TEXT NOT NULL DEFAULT '',
      duration_minutes INTEGER
        CHECK (duration_minutes IS NULL OR duration_minutes BETWEEN 0 AND 1440),
      plank_seconds INTEGER
        CHECK (plank_seconds IS NULL OR plank_seconds BETWEEN 0 AND 3600),
      train_notes TEXT NOT NULL DEFAULT '',
      verdict TEXT NOT NULL DEFAULT '',
      sets_abandoned INTEGER NOT NULL DEFAULT 0
        CHECK (sets_abandoned BETWEEN 0 AND 1000),
      abandoned_notes TEXT NOT NULL DEFAULT '',
      published_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (challenge_id, day_number),
      UNIQUE (challenge_id, entry_date)
    )
  `;
  await db()`
    INSERT INTO dont_try_daily_entries (challenge_id, day_number, entry_date)
    VALUES (${DONT_TRY_CHALLENGE_ID}, 1, ${DONT_TRY_START})
    ON CONFLICT (challenge_id, day_number) DO NOTHING
  `;
}

function dateValue(value: unknown) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function mapEntry(row: Record<string, unknown>): DontTryEntry {
  return {
    day: Number(row.day_number),
    date: dateValue(row.entry_date),
    status: cleanStatus(row.status),
    studyPoem: String(row.study_poem ?? ""),
    studyAuthor: String(row.study_author ?? ""),
    studyNotes: String(row.study_notes ?? ""),
    steps: row.steps === null ? null : Number(row.steps),
    eatComplete:
      row.eat_complete === null ? null : Boolean(row.eat_complete),
    eatNotes: String(row.eat_notes ?? ""),
    act: String(row.act_text ?? ""),
    actDifficulty:
      row.act_difficulty === null ? null : Number(row.act_difficulty),
    workout: String(row.workout ?? ""),
    durationMinutes:
      row.duration_minutes === null ? null : Number(row.duration_minutes),
    plankSeconds:
      row.plank_seconds === null ? null : Number(row.plank_seconds),
    trainNotes: String(row.train_notes ?? ""),
    verdict: String(row.verdict ?? ""),
    setsAbandoned: Number(row.sets_abandoned ?? 0),
    abandonedNotes: String(row.abandoned_notes ?? ""),
    publishedAt: iso(row.published_at as string | Date | null),
    updatedAt:
      iso(row.updated_at as string | Date | null) ?? new Date(0).toISOString(),
  };
}

export async function getDontTryEntries(includeDrafts = false) {
  await ensureDontTryTable();
  const rows = (await (includeDrafts
    ? db()`SELECT * FROM dont_try_daily_entries
           WHERE challenge_id = ${DONT_TRY_CHALLENGE_ID}
           ORDER BY day_number DESC`
    : db()`SELECT * FROM dont_try_daily_entries
           WHERE challenge_id = ${DONT_TRY_CHALLENGE_ID}
             AND published_at IS NOT NULL
           ORDER BY day_number DESC`)) as Array<Record<string, unknown>>;
  return rows.map(mapEntry);
}

export function calculateDontTryStats(entries: DontTryEntry[]): DontTryStats {
  const published = entries.filter((entry) => entry.publishedAt);
  const latestWithPlank = published.find((entry) => entry.plankSeconds !== null);
  return {
    publishedDays: published.length,
    completeDays: published.filter((entry) => entry.status === "complete").length,
    partialDays: published.filter((entry) => entry.status === "partial").length,
    missedDays: published.filter((entry) => entry.status === "missed").length,
    studyDays: published.filter((entry) => Boolean(entry.studyPoem)).length,
    walkDays: published.filter((entry) => (entry.steps ?? 0) >= 12_000).length,
    eatDays: published.filter((entry) => entry.eatComplete === true).length,
    actDays: published.filter((entry) => Boolean(entry.act)).length,
    trainDays: published.filter((entry) => Boolean(entry.workout)).length,
    currentPlankSeconds: latestWithPlank?.plankSeconds ?? null,
    longestPlankSeconds:
      published.reduce<number | null>(
        (longest, entry) =>
          entry.plankSeconds === null
            ? longest
            : Math.max(longest ?? 0, entry.plankSeconds),
        null,
      ),
    totalSteps: published.reduce((total, entry) => total + (entry.steps ?? 0), 0),
    setsAbandoned: published.reduce(
      (total, entry) => total + entry.setsAbandoned,
      0,
    ),
  };
}

export function currentDontTryDay(now = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const today = Date.UTC(
    Number(value.year),
    Number(value.month) - 1,
    Number(value.day),
  );
  const start = Date.parse(`${DONT_TRY_START}T00:00:00Z`);
  return Math.min(
    DONT_TRY_DAYS,
    Math.max(1, Math.floor((today - start) / 86_400_000) + 1),
  );
}

export async function saveDontTryEntry(input: {
  day: unknown;
  status: unknown;
  studyPoem: unknown;
  studyAuthor: unknown;
  studyNotes: unknown;
  steps: unknown;
  eatComplete: unknown;
  eatNotes: unknown;
  act: unknown;
  actDifficulty: unknown;
  workout: unknown;
  durationMinutes: unknown;
  plankSeconds: unknown;
  trainNotes: unknown;
  verdict: unknown;
  setsAbandoned: unknown;
  abandonedNotes: unknown;
}) {
  await ensureDontTryTable();
  const day = boundedInteger(input.day, 1, DONT_TRY_DAYS, false);
  if (day === null) throw new Error("A day is required.");
  const status = cleanStatus(input.status);
  const values = {
    studyPoem: cleanLine(input.studyPoem, 160),
    studyAuthor: cleanLine(input.studyAuthor, 120),
    studyNotes: cleanText(input.studyNotes, 1200),
    steps: boundedInteger(input.steps, 0, 1_000_000),
    eatComplete: nullableBoolean(input.eatComplete),
    eatNotes: cleanText(input.eatNotes, 600),
    act: cleanText(input.act, 800),
    actDifficulty: boundedInteger(input.actDifficulty, 1, 10),
    workout: cleanLine(input.workout, 160),
    durationMinutes: boundedInteger(input.durationMinutes, 0, 1440),
    plankSeconds: boundedInteger(input.plankSeconds, 0, 3600),
    trainNotes: cleanText(input.trainNotes, 1000),
    verdict: cleanLine(input.verdict, 180),
    setsAbandoned:
      boundedInteger(input.setsAbandoned, 0, 1000, false) ?? 0,
    abandonedNotes: cleanText(input.abandonedNotes, 600),
  };

  await db()`
    INSERT INTO dont_try_daily_entries (
      challenge_id, day_number, entry_date, status, study_poem, study_author,
      study_notes, steps, eat_complete, eat_notes, act_text, act_difficulty,
      workout, duration_minutes, plank_seconds, train_notes, verdict,
      sets_abandoned, abandoned_notes, updated_at
    )
    VALUES (
      ${DONT_TRY_CHALLENGE_ID}, ${day}, ${dateForDay(day)}, ${status},
      ${values.studyPoem},
      ${values.studyAuthor}, ${values.studyNotes}, ${values.steps},
      ${values.eatComplete}, ${values.eatNotes}, ${values.act},
      ${values.actDifficulty}, ${values.workout}, ${values.durationMinutes},
      ${values.plankSeconds}, ${values.trainNotes}, ${values.verdict},
      ${values.setsAbandoned}, ${values.abandonedNotes}, NOW()
    )
    ON CONFLICT (challenge_id, day_number) DO UPDATE SET
      status = EXCLUDED.status,
      study_poem = EXCLUDED.study_poem,
      study_author = EXCLUDED.study_author,
      study_notes = EXCLUDED.study_notes,
      steps = EXCLUDED.steps,
      eat_complete = EXCLUDED.eat_complete,
      eat_notes = EXCLUDED.eat_notes,
      act_text = EXCLUDED.act_text,
      act_difficulty = EXCLUDED.act_difficulty,
      workout = EXCLUDED.workout,
      duration_minutes = EXCLUDED.duration_minutes,
      plank_seconds = EXCLUDED.plank_seconds,
      train_notes = EXCLUDED.train_notes,
      verdict = EXCLUDED.verdict,
      sets_abandoned = EXCLUDED.sets_abandoned,
      abandoned_notes = EXCLUDED.abandoned_notes,
      updated_at = NOW()
  `;
}

export async function setDontTryPublished(dayValue: unknown, publish: boolean) {
  await ensureDontTryTable();
  const day = boundedInteger(dayValue, 1, DONT_TRY_DAYS, false);
  if (day === null) throw new Error("A day is required.");
  if (publish) {
    const rows = (await db()`
      SELECT status FROM dont_try_daily_entries
      WHERE challenge_id = ${DONT_TRY_CHALLENGE_ID}
        AND day_number = ${day}
    `) as Array<{ status: DontTryStatus }>;
    if (!rows[0] || rows[0].status === "pending") {
      throw new Error("Choose Complete, Partial, or Missed before publishing.");
    }
  }
  await db()`
    UPDATE dont_try_daily_entries
    SET published_at = ${publish ? new Date().toISOString() : null},
        updated_at = NOW()
    WHERE challenge_id = ${DONT_TRY_CHALLENGE_ID}
      AND day_number = ${day}
  `;
}
