import "server-only";

import { neon } from "@neondatabase/serverless";
import { GENERAL_NOTE_ANCHOR } from "@/lib/poem-comments";
import { POEM_REACTIONS } from "@/lib/poem-reactions";
import { getPoem, poemLines } from "@/lib/poems";
import { STORE_PRODUCTS } from "@/lib/store-catalog";

// One feed for the control room: everything visitors did since the owner last
// pressed "Mark all as seen". Things with a timestamp are read straight from
// their own tables; plain counters (plays, reads, opens) have no history, so
// the last seen totals are kept here and the difference is shown.

export type NotificationGroup =
  | "notes"
  | "memo-replies"
  | "hearts"
  | "poem-notes"
  | "poem-reactions"
  | "wishes"
  | "posties"
  | "sales"
  | "door";

export type NotificationItem = {
  key: string;
  group: NotificationGroup;
  at: string;
  /** Happened after the last "seen" mark. */
  isNew: boolean;
  label: string;
  text: string;
  quote: string | null;
  audioUrl: string | null;
  href: string;
  action: string;
  /** How many events this row stands for (hearts and guesses are bundled). */
  count: number;
};

export type NotificationTally = {
  group: NotificationGroup;
  count: number;
  capped: boolean;
  label: string;
  href: string;
};

export type CounterSnapshot = {
  plays: Record<string, number>;
  reads: Record<string, number>;
  opens: number;
};

export type CounterDelta = { title: string; href: string; count: number };

export type Notifications = {
  since: string;
  through: string;
  /** No baseline yet: the feed starts from a week ago instead of a last visit. */
  firstVisit: boolean;
  fresh: NotificationItem[];
  earlier: NotificationItem[];
  tallies: NotificationTally[];
  waitingNotes: number;
  traffic: {
    visits: number;
    visitors: number;
    pages: Array<{ path: string; count: number }>;
  };
  plays: CounterDelta[];
  reads: CounterDelta[];
  opens: number;
  snapshot: CounterSnapshot;
  /** Sources that could not be read; the rest of the feed is still shown. */
  failed: string[];
};

type Row = Record<string, unknown>;
export type Run = (text: string, params?: unknown[]) => Promise<Row[]>;

const STATE_ID = "owner";
const FIRST_VISIT_DAYS = 7;
const EARLIER_DAYS = 7;
const SOURCE_LIMIT = 500;

const GROUPS: Record<
  NotificationGroup,
  { one: string; many: string; href: string }
> = {
  notes: { one: "note", many: "notes", href: "/controlroom/ask" },
  "memo-replies": {
    one: "memo reply",
    many: "memo replies",
    href: "/controlroom/voice-memos",
  },
  hearts: { one: "heart", many: "hearts", href: "/voice-memos" },
  "poem-notes": { one: "poem note", many: "poem notes", href: "/poetry" },
  "poem-reactions": {
    one: "poem reaction",
    many: "poem reactions",
    href: "/poetry",
  },
  wishes: { one: "wish", many: "wishes", href: "#wishes" },
  posties: { one: "Posties signup", many: "Posties signups", href: "#posties" },
  sales: { one: "sale", many: "sales", href: "/controlroom/shop" },
  door: { one: "door guess", many: "door guesses", href: "#secrets-attempts" },
};

const GROUP_ORDER = Object.keys(GROUPS) as NotificationGroup[];

function iso(value: unknown) {
  return value instanceof Date
    ? value.toISOString()
    : new Date(String(value)).toISOString();
}

function text(value: unknown) {
  return value == null ? "" : String(value).trim();
}

function who(value: unknown) {
  return text(value) || "Someone";
}

function clip(value: string, max: number) {
  const flat = value.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}

function titled(value: unknown) {
  return `“${text(value) || "untitled"}”`;
}

function clock(ms: number) {
  const seconds = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

function missingTable(error: unknown) {
  return (error as { code?: string } | null)?.code === "42P01";
}

function countMap(value: unknown) {
  const out: Record<string, number> = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return out;
  for (const [key, raw] of Object.entries(value).slice(0, 5000)) {
    const count = Number(raw);
    if (key.length <= 200 && Number.isInteger(count) && count >= 0) {
      out[key] = count;
    }
  }
  return out;
}

/** Accepts only the shape this file writes; anything else becomes null. */
export function parseSnapshot(value: unknown): CounterSnapshot | null {
  let raw = value;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const input = raw as Record<string, unknown>;
  const opens = Number(input.opens);
  return {
    plays: countMap(input.plays),
    reads: countMap(input.reads),
    opens: Number.isInteger(opens) && opens >= 0 ? opens : 0,
  };
}

async function loadState(run: Run) {
  await run(`
    CREATE TABLE IF NOT EXISTS admin_notification_state (
      id TEXT PRIMARY KEY,
      seen_at TIMESTAMPTZ NOT NULL,
      counters JSONB
    )
  `);
  await run(
    `INSERT INTO admin_notification_state (id, seen_at)
     VALUES ($1, date_trunc('milliseconds', NOW() - make_interval(days => $2::int)))
     ON CONFLICT (id) DO NOTHING`,
    [STATE_ID, FIRST_VISIT_DAYS],
  );
  const rows = await run(
    `SELECT seen_at, counters, date_trunc('milliseconds', NOW()) AS now
     FROM admin_notification_state WHERE id = $1`,
    [STATE_ID],
  );
  const row = rows[0];
  if (!row) throw new Error("Notification state is missing.");
  return {
    since: iso(row.seen_at),
    through: iso(row.now),
    baseline: row.counters == null ? null : parseSnapshot(row.counters),
  };
}

type Window = { from: string; since: string; through: string };

type Source = {
  name: string;
  load: (run: Run, window: Window, ownerHash: string) => Promise<NotificationItem[]>;
};

const sources: Source[] = [
  {
    name: "Leave a Note",
    async load(run, { from, since, through }) {
      const rows = await run(
        `SELECT id, body, answer, created_at,
           created_at > $3::timestamptz AS is_new
         FROM ask_questions
         WHERE created_at > $1::timestamptz AND created_at <= $2::timestamptz
         ORDER BY created_at DESC LIMIT ${SOURCE_LIMIT}`,
        [from, through, since],
      );
      return rows.map((row) => {
        const answered = Boolean(text(row.answer));
        return {
          key: `ask:${row.id}`,
          group: "notes",
          at: iso(row.created_at),
          isNew: Boolean(row.is_new),
          label: "Note",
          text: answered
            ? "Someone left a note (you replied)"
            : "Someone left a note",
          quote: text(row.body),
          audioUrl: null,
          href: `/controlroom/ask#${row.id}`,
          action: answered ? "See it" : "Reply",
          count: 1,
        };
      });
    },
  },
  {
    name: "Voice Memos notes",
    async load(run, { from, since, through }) {
      const rows = await run(
        `SELECT n.id, n.body, n.author_name, n.created_at, r.title, r.slug,
           n.created_at > $3::timestamptz AS is_new,
           CASE n.parent_kind
             WHEN 'note' THEN (SELECT x.by_owner FROM recording_notes x WHERE x.id = n.parent_id)
             WHEN 'reply' THEN (SELECT x.by_owner FROM recording_replies x WHERE x.id = n.parent_id)
           END AS to_owner
         FROM recording_notes n
         JOIN recordings r ON r.id = n.recording_id
         WHERE n.by_owner = FALSE AND r.deleted_at IS NULL
           AND n.created_at > $1::timestamptz AND n.created_at <= $2::timestamptz
         ORDER BY n.created_at DESC LIMIT ${SOURCE_LIMIT}`,
        [from, through, since],
      );
      return rows.map((row) => ({
        key: `memo-note:${row.id}`,
        group: "memo-replies",
        at: iso(row.created_at),
        isNew: Boolean(row.is_new),
        label: "Memo note",
        text: row.to_owner
          ? `${who(row.author_name)} replied to you on ${titled(row.title)}`
          : `${who(row.author_name)} wrote on ${titled(row.title)}`,
        quote: text(row.body),
        audioUrl: null,
        href: `/voice-memos/${row.slug}`,
        action: "Open memo",
        count: 1,
      }));
    },
  },
  {
    name: "Voice Memos voice replies",
    async load(run, { from, since, through }) {
      const rows = await run(
        `SELECT p.id, p.author_name, p.duration_ms, p.blob_url, p.created_at,
           r.title, r.slug, p.created_at > $3::timestamptz AS is_new,
           CASE p.parent_kind
             WHEN 'note' THEN (SELECT x.by_owner FROM recording_notes x WHERE x.id = p.parent_id)
             WHEN 'reply' THEN (SELECT x.by_owner FROM recording_replies x WHERE x.id = p.parent_id)
           END AS to_owner
         FROM recording_replies p
         JOIN recordings r ON r.id = p.recording_id
         WHERE p.by_owner = FALSE AND r.deleted_at IS NULL
           AND p.created_at > $1::timestamptz AND p.created_at <= $2::timestamptz
         ORDER BY p.created_at DESC LIMIT ${SOURCE_LIMIT}`,
        [from, through, since],
      );
      return rows.map((row) => ({
        key: `memo-reply:${row.id}`,
        group: "memo-replies",
        at: iso(row.created_at),
        isNew: Boolean(row.is_new),
        label: "Voice reply",
        text: `${who(row.author_name)} sent a ${clock(Number(row.duration_ms))} voice reply ${
          row.to_owner ? "to you on" : "on"
        } ${titled(row.title)}`,
        quote: null,
        audioUrl: text(row.blob_url) || null,
        href: `/voice-memos/${row.slug}`,
        action: "Open memo",
        count: 1,
      }));
    },
  },
  {
    name: "Voice Memos hearts",
    async load(run, { from, since, through }, ownerHash) {
      const rows = await run(
        `SELECT r.id, r.title, r.slug, h.is_new,
           COUNT(*)::int AS count, MAX(h.created_at) AS at
         FROM (
           SELECT recording_id, created_at, created_at > $3::timestamptz AS is_new
           FROM recording_hearts
           WHERE created_at > $1::timestamptz AND created_at <= $2::timestamptz
             AND visitor_hash <> $4
         ) h
         JOIN recordings r ON r.id = h.recording_id
         WHERE r.deleted_at IS NULL
         GROUP BY r.id, r.title, r.slug, h.is_new`,
        [from, through, since, ownerHash],
      );
      return rows.map((row) => {
        const count = Number(row.count);
        return {
          key: `memo-heart:${row.id}:${row.is_new ? "new" : "old"}`,
          group: "hearts",
          at: iso(row.at),
          isNew: Boolean(row.is_new),
          label: "Hearts",
          text: `${plural(count, "heart", "hearts")} on ${titled(row.title)}`,
          quote: null,
          audioUrl: null,
          href: `/voice-memos/${row.slug}`,
          action: "Open memo",
          count,
        };
      });
    },
  },
  {
    name: "Voice Memos reply hearts",
    async load(run, { from, since, through }, ownerHash) {
      const rows = await run(
        `SELECT h.kind, h.response_id, h.is_new,
           COUNT(*)::int AS count, MAX(h.created_at) AS at,
           COALESCE(n.by_owner, p.by_owner, FALSE) AS by_owner,
           n.body, COALESCE(n.author_name, p.author_name) AS author_name,
           r.title, r.slug
         FROM (
           SELECT kind, response_id, created_at, created_at > $3::timestamptz AS is_new
           FROM response_hearts
           WHERE created_at > $1::timestamptz AND created_at <= $2::timestamptz
             AND visitor_hash <> 'owner' AND visitor_hash <> $4
         ) h
         LEFT JOIN recording_notes n ON h.kind = 'note' AND n.id = h.response_id
         LEFT JOIN recording_replies p ON h.kind = 'reply' AND p.id = h.response_id
         JOIN recordings r ON r.id = COALESCE(n.recording_id, p.recording_id)
         WHERE r.deleted_at IS NULL
         GROUP BY h.kind, h.response_id, h.is_new, n.by_owner, p.by_owner,
           n.body, n.author_name, p.author_name, r.title, r.slug`,
        [from, through, since, ownerHash],
      );
      return rows.map((row) => {
        const count = Number(row.count);
        const whose = row.by_owner
          ? "your"
          : text(row.author_name)
            ? `${text(row.author_name)}’s`
            : "a visitor’s";
        const what = row.kind === "reply" ? "voice reply" : "note";
        return {
          key: `response-heart:${row.kind}:${row.response_id}:${row.is_new ? "new" : "old"}`,
          group: "hearts",
          at: iso(row.at),
          isNew: Boolean(row.is_new),
          label: "Hearts",
          text: `${plural(count, "heart", "hearts")} on ${whose} ${what} on ${titled(row.title)}`,
          quote: text(row.body) || null,
          audioUrl: null,
          href: `/voice-memos/${row.slug}`,
          action: "Open memo",
          count,
        };
      });
    },
  },
  {
    name: "Poem notes",
    async load(run, { from, since, through }) {
      const rows = await run(
        `SELECT id, poem_slug, line_index, kind, author_name, body, created_at,
           created_at > $3::timestamptz AS is_new
         FROM poem_notes
         WHERE created_at > $1::timestamptz AND created_at <= $2::timestamptz
         ORDER BY created_at DESC LIMIT ${SOURCE_LIMIT}`,
        [from, through, since],
      );
      return rows.map((row) => {
        const slug = text(row.poem_slug);
        const poem = getPoem(slug);
        const line = Number(row.line_index);
        const where =
          line === GENERAL_NOTE_ANCHOR || !poem
            ? ""
            : line === -2
              ? ", at the title"
              : line === -1
                ? ", at the dedication"
                : poemLines(poem)[line]
                  ? `, at “${clip(poemLines(poem)[line], 70)}”`
                  : "";
        const question = row.kind === "question";
        return {
          key: `poem-note:${row.id}`,
          group: "poem-notes",
          at: iso(row.created_at),
          isNew: Boolean(row.is_new),
          label: question ? "Poem question" : "Poem note",
          text: `${who(row.author_name)} ${
            question ? "asked about" : "left a note on"
          } ${titled(poem?.title ?? slug)}${where}`,
          quote: text(row.body),
          audioUrl: null,
          href: `/poetry/${slug}`,
          action: "Open poem",
          count: 1,
        };
      });
    },
  },
  {
    name: "Poem reactions",
    async load(run, { from, since, through }) {
      const rows = await run(
        `SELECT poem_slug, reaction, is_new,
           COUNT(*)::int AS count, MAX(created_at) AS at
         FROM (
           SELECT poem_slug, reaction, created_at, created_at > $3::timestamptz AS is_new
           FROM poem_reactions
           WHERE created_at > $1::timestamptz AND created_at <= $2::timestamptz
         ) x
         GROUP BY poem_slug, reaction, is_new`,
        [from, through, since],
      );
      return rows.map((row) => {
        const slug = text(row.poem_slug);
        const count = Number(row.count);
        const label =
          POEM_REACTIONS.find((item) => item.id === row.reaction)?.label ??
          text(row.reaction);
        return {
          key: `poem-reaction:${slug}:${row.reaction}:${row.is_new ? "new" : "old"}`,
          group: "poem-reactions",
          at: iso(row.at),
          isNew: Boolean(row.is_new),
          label: "Poem reaction",
          text: `${count} × “${label}” on ${titled(getPoem(slug)?.title ?? slug)}`,
          quote: null,
          audioUrl: null,
          href: `/poetry/${slug}`,
          action: "Open poem",
          count,
        };
      });
    },
  },
  {
    name: "Dandelion wishes",
    async load(run, { from, since, through }) {
      const rows = await run(
        `SELECT id, body, location, gender, age, created_at,
           created_at > $3::timestamptz AS is_new
         FROM dandelion_wishes
         WHERE created_at > $1::timestamptz AND created_at <= $2::timestamptz
         ORDER BY created_at DESC LIMIT ${SOURCE_LIMIT}`,
        [from, through, since],
      );
      return rows.map((row) => {
        const origin = [row.location, row.gender, row.age].map(text).filter(Boolean);
        return {
          key: `wish:${row.id}`,
          group: "wishes",
          at: iso(row.created_at),
          isNew: Boolean(row.is_new),
          label: "Wish",
          text: origin.length ? `A wish from ${origin.join(", ")}` : "A wish",
          quote: text(row.body),
          audioUrl: null,
          href: "#wishes",
          action: "All wishes",
          count: 1,
        };
      });
    },
  },
  {
    name: "Sunday Posties",
    async load(run, { from, since, through }) {
      const rows = await run(
        `SELECT id, name, platform, created_at,
           created_at > $3::timestamptz AS is_new
         FROM sunday_posties
         WHERE created_at > $1::timestamptz AND created_at <= $2::timestamptz
         ORDER BY created_at DESC LIMIT ${SOURCE_LIMIT}`,
        [from, through, since],
      );
      return rows.map((row) => ({
        key: `posties:${row.id}`,
        group: "posties",
        at: iso(row.created_at),
        isNew: Boolean(row.is_new),
        label: "Posties",
        text: `${who(row.name)} signed up for Sunday Posties`,
        quote: null,
        audioUrl: null,
        href: "#posties",
        action: "See address",
        count: 1,
      }));
    },
  },
  {
    name: "Clemi Store",
    async load(run, { from, since, through }) {
      const rows = await run(
        `SELECT stripe_session_id, product_id, amount_total, currency, paid_at,
           paid_at > $3::timestamptz AS is_new
         FROM clemi_store_purchases
         WHERE paid_at > $1::timestamptz AND paid_at <= $2::timestamptz
         ORDER BY paid_at DESC LIMIT ${SOURCE_LIMIT}`,
        [from, through, since],
      );
      return rows.map((row) => {
        const product = STORE_PRODUCTS.find((item) => item.id === row.product_id);
        const amount =
          row.amount_total == null
            ? ""
            : ` for ${new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: (text(row.currency) || "usd").toUpperCase(),
              }).format(Number(row.amount_total) / 100)}`;
        return {
          key: `sale:${row.stripe_session_id}`,
          group: "sales",
          at: iso(row.paid_at),
          isNew: Boolean(row.is_new),
          label: "Sale",
          text: `${titled(product?.title ?? row.product_id)} sold${amount}`,
          quote: null,
          audioUrl: null,
          href: "/controlroom/shop",
          action: "Open store",
          count: 1,
        };
      });
    },
  },
  {
    name: "Secrets door",
    async load(run, { from, since, through }) {
      const rows = await run(
        `SELECT is_new, COUNT(*)::int AS count,
           COUNT(*) FILTER (WHERE outcome = 'cracked')::int AS cracked,
           COUNT(DISTINCT guest_id)::int AS guessers, MAX(created_at) AS at
         FROM (
           SELECT guest_id, outcome, created_at, created_at > $3::timestamptz AS is_new
           FROM secrets_attempts
           WHERE created_at > $1::timestamptz AND created_at <= $2::timestamptz
         ) x
         GROUP BY is_new`,
        [from, through, since],
      );
      return rows.map((row) => {
        const count = Number(row.count);
        const cracked = Number(row.cracked);
        return {
          key: `door:${row.is_new ? "new" : "old"}`,
          group: "door",
          at: iso(row.at),
          isNew: Boolean(row.is_new),
          label: "Secrets door",
          text: `${plural(count, "guess", "guesses")} at the secrets door from ${plural(
            Number(row.guessers),
            "person",
            "people",
          )}${cracked ? `, ${cracked} got in` : ", nobody got in"}`,
          quote: null,
          audioUrl: null,
          href: "#secrets-attempts",
          action: "See guesses",
          count,
        };
      });
    },
  },
];

async function quiet<T>(
  name: string,
  failed: string[],
  fallback: T,
  load: () => Promise<T>,
) {
  try {
    return await load();
  } catch (error) {
    if (!missingTable(error)) {
      failed.push(name);
      console.error(`Notifications: ${name} could not be read.`, error);
    }
    return fallback;
  }
}

function tally(lists: NotificationItem[][]) {
  const totals = new Map<NotificationGroup, { count: number; capped: boolean }>();
  for (const list of lists) {
    const fresh = list.filter((item) => item.isNew);
    for (const item of fresh) {
      const entry = totals.get(item.group) ?? { count: 0, capped: false };
      entry.count += item.count;
      // A full page of new rows means older new ones were cut off.
      entry.capped ||= fresh.length >= SOURCE_LIMIT;
      totals.set(item.group, entry);
    }
  }
  return GROUP_ORDER.flatMap((group) => {
    const entry = totals.get(group);
    if (!entry) return [];
    const { one, many, href } = GROUPS[group];
    return [
      {
        group,
        count: entry.count,
        capped: entry.capped,
        label: entry.count === 1 && !entry.capped ? one : many,
        href,
      },
    ];
  });
}

function deltas(
  current: Array<{ key: string; title: string; href: string; count: number }>,
  seen: Record<string, number>,
) {
  return current
    .map((item) => ({
      title: item.title,
      href: item.href,
      count: item.count - (seen[item.key] ?? 0),
    }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title));
}

export async function collectNotifications(
  run: Run,
  ownerHash: string | null,
): Promise<Notifications> {
  const state = await loadState(run);
  const window: Window = {
    from: new Date(
      new Date(state.since).getTime() - EARLIER_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString(),
    since: state.since,
    through: state.through,
  };
  const failed: string[] = [];
  const range = [window.since, window.through];

  const [lists, waiting, totals, pages, recordings, poemReads, askOpens] =
    await Promise.all([
      Promise.all(
        sources.map((source) =>
          quiet(source.name, failed, [] as NotificationItem[], () =>
            source.load(run, window, ownerHash ?? ""),
          ),
        ),
      ),
      quiet("Leave a Note", failed, [] as Row[], () =>
        run(
          `SELECT COUNT(*)::int AS count FROM ask_questions
           WHERE answer IS NULL OR answer = ''`,
        ),
      ),
      quiet("Visits", failed, [] as Row[], () =>
        run(
          `SELECT COUNT(*)::int AS visits, COUNT(DISTINCT ip_hash)::int AS visitors
           FROM site_visits
           WHERE created_at > $1::timestamptz AND created_at <= $2::timestamptz`,
          range,
        ),
      ),
      quiet("Visits", failed, [] as Row[], () =>
        run(
          `SELECT path, COUNT(*)::int AS count FROM site_visits
           WHERE created_at > $1::timestamptz AND created_at <= $2::timestamptz
           GROUP BY path ORDER BY count DESC, path ASC LIMIT 5`,
          range,
        ),
      ),
      quiet("Voice Memos plays", failed, [] as Row[], () =>
        run(`SELECT id, title, slug, plays FROM recordings WHERE deleted_at IS NULL`),
      ),
      quiet("Poem reads", failed, [] as Row[], () =>
        run(`SELECT slug, reads FROM poem_reads`),
      ),
      quiet("Leave a Note", failed, [] as Row[], () =>
        run(`SELECT COALESCE(SUM(opens), 0)::int AS opens FROM ask_questions`),
      ),
    ]);

  const items = lists.flat().sort((a, b) => b.at.localeCompare(a.at));
  const fresh = items.filter((item) => item.isNew);
  const earlier = items.filter((item) => !item.isNew);

  const snapshot: CounterSnapshot = {
    plays: Object.fromEntries(
      recordings.map((row) => [String(row.id), Number(row.plays ?? 0)]),
    ),
    reads: Object.fromEntries(
      poemReads.map((row) => [String(row.slug), Number(row.reads ?? 0)]),
    ),
    opens: Number(askOpens[0]?.opens ?? 0),
  };

  // Without a baseline there is nothing to subtract from, so start one now.
  const firstVisit = !state.baseline;
  if (firstVisit) {
    await run(
      `UPDATE admin_notification_state SET counters = $2::jsonb
       WHERE id = $1 AND counters IS NULL`,
      [STATE_ID, JSON.stringify(snapshot)],
    );
  }
  const baseline = state.baseline ?? snapshot;

  return {
    since: window.since,
    through: window.through,
    firstVisit,
    fresh,
    earlier,
    tallies: tally(lists),
    waitingNotes: Number(waiting[0]?.count ?? 0),
    traffic: {
      visits: Number(totals[0]?.visits ?? 0),
      visitors: Number(totals[0]?.visitors ?? 0),
      pages: pages.map((row) => ({
        path: String(row.path),
        count: Number(row.count),
      })),
    },
    plays: deltas(
      recordings.map((row) => ({
        key: String(row.id),
        title: text(row.title) || "untitled",
        href: `/voice-memos/${row.slug}`,
        count: Number(row.plays ?? 0),
      })),
      baseline.plays,
    ),
    reads: deltas(
      poemReads.map((row) => ({
        key: String(row.slug),
        title: getPoem(String(row.slug))?.title ?? String(row.slug),
        href: `/poetry/${row.slug}`,
        count: Number(row.reads ?? 0),
      })),
      baseline.reads,
    ),
    opens: Math.max(0, snapshot.opens - baseline.opens),
    snapshot,
    failed: [...new Set(failed)],
  };
}

/** Moves the mark forward to what the page showed; it never moves back. */
export async function markSeen(
  run: Run,
  throughValue: unknown,
  countersValue: unknown,
) {
  const through = new Date(String(throughValue ?? ""));
  if (Number.isNaN(through.getTime())) throw new Error("Invalid time.");
  const snapshot = parseSnapshot(countersValue);
  if (!snapshot) throw new Error("Invalid counters.");
  await run(
    `UPDATE admin_notification_state
     SET seen_at = date_trunc('milliseconds', LEAST($2::timestamptz, NOW())),
         counters = $3::jsonb
     WHERE id = $1 AND seen_at < LEAST($2::timestamptz, NOW())`,
    [STATE_ID, through.toISOString(), JSON.stringify(snapshot)],
  );
}

function database(): Run {
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? "";
  if (!url) throw new Error("Database is not configured.");
  const sql = neon(url);
  return (query, params) => sql.query(query, params ?? []) as Promise<Row[]>;
}

export function getNotifications(ownerHash: string | null) {
  return collectNotifications(database(), ownerHash);
}

export function markNotificationsSeen(through: unknown, counters: unknown) {
  return markSeen(database(), through, counters);
}
