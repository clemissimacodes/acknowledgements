import { createHash, randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";

export const CIA_PROJECTS = [
  "saas-inflation",
  "startup-graveyard",
  "founder-apologies",
  "quality-control",
] as const;

export type CiaProject = (typeof CIA_PROJECTS)[number];
export type CiaStatus =
  | "draft"
  | "approved"
  | "published"
  | "rejected"
  | "corrected"
  | "withdrawn";

export type CiaSource = {
  id: string;
  url: string;
  label: string;
  publisher: string;
  sourceType: string;
  retrievedAt: string;
};

export type CiaEntry = {
  id: string;
  slug: string;
  project: CiaProject;
  title: string;
  status: CiaStatus;
  revisionId: string;
  revisionNumber: number;
  summary: string;
  occurredOn: string | null;
  confidence: string;
  metadata: Record<string, unknown>;
  moderationRationale: string | null;
  createdAt: string;
  sources: CiaSource[];
};

export type CiaAdminEntry = CiaEntry & {
  updatedAt: string;
};

export type CiaEntryInput = {
  id?: unknown;
  project: unknown;
  title: unknown;
  slug: unknown;
  summary: unknown;
  occurredOn?: unknown;
  confidence?: unknown;
  sourceUrl: unknown;
  sourceLabel: unknown;
  publisher: unknown;
  sourceType?: unknown;
  metadata?: unknown;
  moderationRationale?: unknown;
};

const STARTER_DRAFTS = [
  {
    entryId: "cia-starter-vercel-pricing",
    revisionId: "cia-starter-vercel-pricing-r1",
    sourceId: "cia-starter-vercel-pricing-source",
    slug: "vercel-pricing-review",
    title: "Review candidate: Vercel pricing",
    summary:
      "Private review prompt. Compare a dated observation against the official pricing page before adding any public claim.",
    url: "https://vercel.com/pricing",
    publisher: "Vercel",
  },
  {
    entryId: "cia-starter-github-pricing",
    revisionId: "cia-starter-github-pricing-r1",
    sourceId: "cia-starter-github-pricing-source",
    slug: "github-pricing-review",
    title: "Review candidate: GitHub pricing",
    summary:
      "Private review prompt. Record plan, currency, billing period, retrieval date, and an earlier sourced observation before publication.",
    url: "https://github.com/pricing",
    publisher: "GitHub",
  },
] as const;

function databaseUrl() {
  return process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? "";
}

function db() {
  const url = databaseUrl();
  if (!url) throw new Error("Database is not configured.");
  return neon(url);
}

function iso(value: string | Date) {
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
  return String(value ?? "").replace(/\0/g, "").trim().slice(0, max);
}

function cleanId(value: unknown) {
  const id = cleanLine(value, 100);
  if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error("Invalid CIA record.");
  return id;
}

function cleanProject(value: unknown): CiaProject {
  const project = String(value ?? "");
  if (!CIA_PROJECTS.includes(project as CiaProject)) {
    throw new Error("Invalid CIA project.");
  }
  return project as CiaProject;
}

function cleanStatus(value: unknown): CiaStatus {
  const status = String(value ?? "");
  if (
    !["draft", "approved", "published", "rejected", "corrected", "withdrawn"].includes(
      status,
    )
  ) {
    throw new Error("Invalid CIA status.");
  }
  return status as CiaStatus;
}

function cleanSlug(value: unknown) {
  const slug = cleanLine(value, 100).toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error("Use a lowercase, hyphenated slug.");
  }
  return slug;
}

function cleanUrl(value: unknown) {
  let url: URL;
  try {
    url = new URL(cleanLine(value, 500));
  } catch {
    throw new Error("A valid source URL is required.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Sources must use HTTP or HTTPS.");
  }
  url.hash = "";
  return url.toString();
}

function parseMetadata(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  try {
    const source = String(value);
    if (source.length > 20_000) throw new Error();
    const parsed = JSON.parse(source);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error();
    }
    return parsed as Record<string, unknown>;
  } catch {
    throw new Error("Project details must be a JSON object.");
  }
}

export async function ensureCiaTables() {
  const sql = db();
  await sql`
    CREATE TABLE IF NOT EXISTS cia_entries (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL,
      project TEXT NOT NULL CHECK (
        project IN ('saas-inflation', 'startup-graveyard', 'founder-apologies', 'quality-control')
      ),
      title TEXT NOT NULL,
      status TEXT NOT NULL CHECK (
        status IN ('draft', 'approved', 'published', 'rejected', 'corrected', 'withdrawn')
      ),
      current_revision_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (project, slug)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS cia_revisions (
      id TEXT PRIMARY KEY,
      entry_id TEXT NOT NULL REFERENCES cia_entries(id) ON DELETE CASCADE,
      revision_number INTEGER NOT NULL,
      status TEXT NOT NULL CHECK (
        status IN ('draft', 'approved', 'published', 'rejected', 'corrected', 'withdrawn')
      ),
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      occurred_on DATE,
      confidence TEXT NOT NULL DEFAULT 'verified',
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      moderation_rationale TEXT,
      created_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (entry_id, revision_number)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS cia_sources (
      id TEXT PRIMARY KEY,
      entry_id TEXT NOT NULL REFERENCES cia_entries(id) ON DELETE CASCADE,
      revision_id TEXT NOT NULL REFERENCES cia_revisions(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      label TEXT NOT NULL,
      publisher TEXT NOT NULL,
      source_type TEXT NOT NULL DEFAULT 'official',
      retrieved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      content_hash TEXT
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS cia_project_metadata (
      revision_id TEXT PRIMARY KEY REFERENCES cia_revisions(id) ON DELETE CASCADE,
      project TEXT NOT NULL,
      confidence_label TEXT,
      subject_name TEXT,
      context_note TEXT
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS cia_pricing_observations (
      id TEXT PRIMARY KEY,
      revision_id TEXT NOT NULL REFERENCES cia_revisions(id) ON DELETE CASCADE,
      plan_name TEXT NOT NULL,
      currency TEXT NOT NULL,
      billing_period TEXT NOT NULL,
      price_minor INTEGER,
      previous_price_minor INTEGER,
      unit_label TEXT,
      observed_at TIMESTAMPTZ NOT NULL
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS cia_citrus_inspections (
      id TEXT PRIMARY KEY,
      revision_id TEXT NOT NULL REFERENCES cia_revisions(id) ON DELETE CASCADE,
      score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
      appearance INTEGER CHECK (appearance BETWEEN 0 AND 10),
      aroma INTEGER CHECK (aroma BETWEEN 0 AND 10),
      texture INTEGER CHECK (texture BETWEEN 0 AND 10),
      taste INTEGER CHECK (taste BETWEEN 0 AND 10),
      photo_url TEXT,
      photo_alt TEXT,
      exif_removed BOOLEAN NOT NULL DEFAULT TRUE
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS cia_discovery_sources (
      url TEXT PRIMARY KEY,
      publisher TEXT NOT NULL,
      project TEXT NOT NULL,
      etag TEXT,
      last_modified TEXT,
      content_hash TEXT,
      last_checked_at TIMESTAMPTZ,
      last_changed_at TIMESTAMPTZ,
      active BOOLEAN NOT NULL DEFAULT TRUE
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS cia_discovery_runs (
      run_date DATE PRIMARY KEY,
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      finished_at TIMESTAMPTZ,
      checked_count INTEGER NOT NULL DEFAULT 0,
      changed_count INTEGER NOT NULL DEFAULT 0,
      error_count INTEGER NOT NULL DEFAULT 0
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS cia_moderation_events (
      id TEXT PRIMARY KEY,
      entry_id TEXT NOT NULL REFERENCES cia_entries(id) ON DELETE CASCADE,
      revision_id TEXT NOT NULL REFERENCES cia_revisions(id) ON DELETE CASCADE,
      from_status TEXT NOT NULL,
      to_status TEXT NOT NULL,
      rationale TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS cia_entries_public_idx
    ON cia_entries (project, status, updated_at DESC)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS cia_sources_revision_idx
    ON cia_sources (revision_id)
  `;
}

export async function seedCiaStarterDrafts() {
  await ensureCiaTables();
  const sql = db();
  for (const draft of STARTER_DRAFTS) {
    await sql`
      INSERT INTO cia_entries (id, slug, project, title, status, current_revision_id)
      VALUES (
        ${draft.entryId},
        ${draft.slug},
        'saas-inflation',
        ${draft.title},
        'draft',
        ${draft.revisionId}
      )
      ON CONFLICT (id) DO NOTHING
    `;
    await sql`
      INSERT INTO cia_revisions (
        id, entry_id, revision_number, status, title, summary, confidence,
        metadata, created_by
      )
      VALUES (
        ${draft.revisionId},
        ${draft.entryId},
        1,
        'draft',
        ${draft.title},
        ${draft.summary},
        'unreviewed',
        '{"starter":true}'::jsonb,
        'curated-seed'
      )
      ON CONFLICT (id) DO NOTHING
    `;
    await sql`
      INSERT INTO cia_sources (
        id, entry_id, revision_id, url, label, publisher, source_type
      )
      VALUES (
        ${draft.sourceId},
        ${draft.entryId},
        ${draft.revisionId},
        ${draft.url},
        'Official pricing page',
        ${draft.publisher},
        'official'
      )
      ON CONFLICT (id) DO NOTHING
    `;
  }
}

function mapEntry(row: Record<string, unknown>, sources: CiaSource[]): CiaEntry {
  const rawMetadata = row.metadata;
  const metadata =
    rawMetadata && typeof rawMetadata === "object"
      ? (rawMetadata as Record<string, unknown>)
      : {};
  return {
    id: String(row.id),
    slug: String(row.slug),
    project: cleanProject(row.project),
    title: String(row.revision_title ?? row.title),
    status: cleanStatus(row.status),
    revisionId: String(row.revision_id),
    revisionNumber: Number(row.revision_number),
    summary: String(row.summary),
    occurredOn: row.occurred_on ? String(row.occurred_on).slice(0, 10) : null,
    confidence: String(row.confidence),
    metadata,
    moderationRationale: row.moderation_rationale
      ? String(row.moderation_rationale)
      : null,
    createdAt: iso(row.created_at as string | Date),
    sources,
  };
}

async function sourcesForRevisions(revisionIds: string[]) {
  if (revisionIds.length === 0) return new Map<string, CiaSource[]>();
  const rows = await db()`
    SELECT id, revision_id, url, label, publisher, source_type, retrieved_at
    FROM cia_sources
    ORDER BY retrieved_at DESC
    LIMIT 2000
  `;
  const wanted = new Set(revisionIds);
  const grouped = new Map<string, CiaSource[]>();
  for (const row of rows) {
    const revisionId = String(row.revision_id);
    if (!wanted.has(revisionId)) continue;
    const list = grouped.get(revisionId) ?? [];
    list.push({
      id: String(row.id),
      url: String(row.url),
      label: String(row.label),
      publisher: String(row.publisher),
      sourceType: String(row.source_type),
      retrievedAt: iso(row.retrieved_at as string | Date),
    });
    grouped.set(revisionId, list);
  }
  return grouped;
}

export async function getPublishedCiaEntries(
  project?: CiaProject,
): Promise<CiaEntry[]> {
  if (
    !databaseUrl() ||
    process.env.NEXT_PHASE === "phase-production-build"
  ) {
    return [];
  }
  try {
    await ensureCiaTables();
    const rows = project
      ? await db()`
        SELECT
          e.id, e.slug, e.project, e.title, e.status,
          r.id AS revision_id, r.revision_number, r.title AS revision_title,
          r.summary, r.occurred_on, r.confidence, r.metadata,
          r.moderation_rationale, r.created_at
        FROM cia_entries e
        JOIN cia_revisions r ON r.id = e.current_revision_id
        WHERE e.status = 'published'
          AND r.status = 'published'
          AND e.project = ${project}
        ORDER BY r.occurred_on DESC NULLS LAST, e.updated_at DESC
        `
      : await db()`
        SELECT
          e.id, e.slug, e.project, e.title, e.status,
          r.id AS revision_id, r.revision_number, r.title AS revision_title,
          r.summary, r.occurred_on, r.confidence, r.metadata,
          r.moderation_rationale, r.created_at
        FROM cia_entries e
        JOIN cia_revisions r ON r.id = e.current_revision_id
        WHERE e.status = 'published' AND r.status = 'published'
        ORDER BY e.updated_at DESC
        `;
    const revisionIds = rows.map((row) => String(row.revision_id));
    const sources = await sourcesForRevisions(revisionIds);
    return rows.map((row) =>
      mapEntry(row, sources.get(String(row.revision_id)) ?? []),
    );
  } catch (error) {
    console.error("CIA public records are temporarily unavailable.", error);
    return [];
  }
}

export async function getCiaAdminEntries(): Promise<CiaAdminEntry[]> {
  await seedCiaStarterDrafts();
  const rows = await db()`
    SELECT
      e.id, e.slug, e.project, e.title, e.status, e.updated_at,
      r.id AS revision_id, r.revision_number, r.title AS revision_title,
      r.summary, r.occurred_on, r.confidence, r.metadata,
      r.moderation_rationale, r.created_at
    FROM cia_entries e
    JOIN cia_revisions r ON r.id = e.current_revision_id
    ORDER BY
      CASE e.status
        WHEN 'draft' THEN 1
        WHEN 'approved' THEN 2
        WHEN 'published' THEN 3
        ELSE 4
      END,
      e.updated_at DESC
    LIMIT 250
  `;
  const revisionIds = rows.map((row) => String(row.revision_id));
  const sources = await sourcesForRevisions(revisionIds);
  return rows.map((row) => ({
    ...mapEntry(row, sources.get(String(row.revision_id)) ?? []),
    updatedAt: iso(row.updated_at as string | Date),
  }));
}

function optionalNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number) : null;
}

async function saveProjectDetails(
  revisionId: string,
  project: CiaProject,
  metadata: Record<string, unknown>,
) {
  const sql = db();
  await sql`
    INSERT INTO cia_project_metadata (
      revision_id, project, confidence_label, subject_name, context_note
    )
    VALUES (
      ${revisionId},
      ${project},
      ${cleanLine(metadata.confidenceLabel, 80) || null},
      ${cleanLine(metadata.subjectName, 180) || null},
      ${cleanText(metadata.context, 1000) || null}
    )
  `;
  if (project === "saas-inflation" && cleanLine(metadata.planName, 160)) {
    await sql`
      INSERT INTO cia_pricing_observations (
        id, revision_id, plan_name, currency, billing_period, price_minor,
        previous_price_minor, unit_label, observed_at
      )
      VALUES (
        ${randomUUID()},
        ${revisionId},
        ${cleanLine(metadata.planName, 160)},
        ${cleanLine(metadata.currency, 12) || "unspecified"},
        ${cleanLine(metadata.billingPeriod, 80) || "unspecified"},
        ${optionalNumber(metadata.priceMinor)},
        ${optionalNumber(metadata.previousPriceMinor)},
        ${cleanLine(metadata.unitLabel, 80) || null},
        ${cleanLine(metadata.observedAt, 40) || new Date().toISOString()}
      )
    `;
  }
  const score = optionalNumber(metadata.score);
  if (project === "quality-control" && score !== null) {
    if (score < 0 || score > 100) throw new Error("Citrus score must be 0–100.");
    await sql`
      INSERT INTO cia_citrus_inspections (
        id, revision_id, score, appearance, aroma, texture, taste,
        photo_url, photo_alt, exif_removed
      )
      VALUES (
        ${randomUUID()},
        ${revisionId},
        ${score},
        ${optionalNumber(metadata.appearance)},
        ${optionalNumber(metadata.aroma)},
        ${optionalNumber(metadata.texture)},
        ${optionalNumber(metadata.taste)},
        ${cleanLine(metadata.photoUrl, 500) || null},
        ${cleanLine(metadata.photoAlt, 300) || null},
        TRUE
      )
    `;
  }
}

export async function saveCiaEntry(input: CiaEntryInput, actorId: string) {
  await ensureCiaTables();
  const sql = db();
  const project = cleanProject(input.project);
  const title = cleanLine(input.title, 180);
  const slug = cleanSlug(input.slug);
  const summary = cleanText(input.summary, 3000);
  const occurredOn = cleanLine(input.occurredOn, 10) || null;
  const confidence = cleanLine(input.confidence, 40) || "unreviewed";
  const sourceUrl = cleanUrl(input.sourceUrl);
  const sourceLabel = cleanLine(input.sourceLabel, 160);
  const publisher = cleanLine(input.publisher, 120);
  const sourceType = cleanLine(input.sourceType, 40) || "official";
  const metadata = parseMetadata(input.metadata);
  const rationale = cleanText(input.moderationRationale, 1000) || null;
  if (title.length < 3 || summary.length < 10 || !sourceLabel || !publisher) {
    throw new Error("Title, summary, publisher, and source label are required.");
  }
  if (project === "quality-control" && sourceType !== "owner-authored") {
    throw new Error("Quality Control records must be owner-authored.");
  }
  if (
    (project === "startup-graveyard" || project === "founder-apologies") &&
    sourceType !== "official" &&
    sourceType !== "credible-public"
  ) {
    throw new Error("This project requires an official or credible public source.");
  }
  if (
    project === "founder-apologies" &&
    cleanText(metadata.excerpt, 10_000).length > 500
  ) {
    throw new Error("Founder excerpts must stay under 500 characters.");
  }
  if (occurredOn && !/^\d{4}-\d{2}-\d{2}$/.test(occurredOn)) {
    throw new Error("Date must use YYYY-MM-DD.");
  }

  if (!input.id) {
    const entryId = randomUUID();
    const revisionId = randomUUID();
    await sql`
      INSERT INTO cia_entries (
        id, slug, project, title, status, current_revision_id
      )
      VALUES (
        ${entryId}, ${slug}, ${project}, ${title}, 'draft', ${revisionId}
      )
    `;
    await sql`
      INSERT INTO cia_revisions (
        id, entry_id, revision_number, status, title, summary, occurred_on,
        confidence, metadata, moderation_rationale, created_by
      )
      VALUES (
        ${revisionId}, ${entryId}, 1, 'draft', ${title}, ${summary},
        ${occurredOn}, ${confidence}, ${JSON.stringify(metadata)}::jsonb,
        ${rationale}, ${actorId}
      )
    `;
    await sql`
      INSERT INTO cia_sources (
        id, entry_id, revision_id, url, label, publisher, source_type
      )
      VALUES (
        ${randomUUID()}, ${entryId}, ${revisionId}, ${sourceUrl},
        ${sourceLabel}, ${publisher}, ${sourceType}
      )
    `;
    await saveProjectDetails(revisionId, project, metadata);
    return entryId;
  }

  const entryId = cleanId(input.id);
  const existing = await sql`
    SELECT COALESCE(MAX(revision_number), 0) AS revision_number
    FROM cia_revisions
    WHERE entry_id = ${entryId}
  `;
  if (existing.length === 0) throw new Error("CIA record not found.");
  const revisionNumber = Number(existing[0].revision_number) + 1;
  const revisionId = randomUUID();
  await sql`
    INSERT INTO cia_revisions (
      id, entry_id, revision_number, status, title, summary, occurred_on,
      confidence, metadata, moderation_rationale, created_by
    )
    VALUES (
      ${revisionId}, ${entryId}, ${revisionNumber}, 'draft', ${title},
      ${summary}, ${occurredOn}, ${confidence}, ${JSON.stringify(metadata)}::jsonb,
      ${rationale}, ${actorId}
    )
  `;
  await sql`
    INSERT INTO cia_sources (
      id, entry_id, revision_id, url, label, publisher, source_type
    )
    VALUES (
      ${randomUUID()}, ${entryId}, ${revisionId}, ${sourceUrl},
      ${sourceLabel}, ${publisher}, ${sourceType}
    )
  `;
  await saveProjectDetails(revisionId, project, metadata);
  await sql`
    UPDATE cia_entries
    SET
      slug = ${slug},
      project = ${project},
      title = ${title},
      status = 'draft',
      current_revision_id = ${revisionId},
      updated_at = NOW()
    WHERE id = ${entryId}
  `;
  return entryId;
}

const ALLOWED_TRANSITIONS: Record<CiaStatus, CiaStatus[]> = {
  draft: ["approved", "rejected"],
  approved: ["published", "rejected"],
  published: ["corrected", "withdrawn"],
  rejected: ["draft"],
  corrected: ["withdrawn"],
  withdrawn: ["draft"],
};

export async function moderateCiaEntry(input: {
  id: unknown;
  status: unknown;
  rationale: unknown;
  actorId: string;
}) {
  await ensureCiaTables();
  const id = cleanId(input.id);
  const next = cleanStatus(input.status);
  const rationale = cleanText(input.rationale, 1000);
  if (rationale.length < 3) throw new Error("A moderation rationale is required.");
  const sql = db();
  const rows = await sql`
    SELECT
      e.status,
      e.project,
      e.current_revision_id,
      r.occurred_on,
      r.confidence,
      r.metadata,
      COUNT(DISTINCT s.id)::integer AS source_count,
      COUNT(DISTINCT p.id)::integer AS pricing_count,
      COUNT(DISTINCT c.id)::integer AS citrus_count
    FROM cia_entries e
    JOIN cia_revisions r ON r.id = e.current_revision_id
    LEFT JOIN cia_sources s ON s.revision_id = e.current_revision_id
    LEFT JOIN cia_pricing_observations p ON p.revision_id = e.current_revision_id
    LEFT JOIN cia_citrus_inspections c ON c.revision_id = e.current_revision_id
    WHERE e.id = ${id}
    GROUP BY e.id, r.id
    LIMIT 1
  `;
  if (rows.length !== 1) throw new Error("CIA record not found.");
  const current = cleanStatus(rows[0].status);
  if (!ALLOWED_TRANSITIONS[current].includes(next)) {
    throw new Error(`Cannot move a CIA record from ${current} to ${next}.`);
  }
  if (
    (next === "approved" || next === "published") &&
    Number(rows[0].source_count) < 1
  ) {
    throw new Error("A sourced revision is required before publication.");
  }
  if (next === "approved") {
    const project = cleanProject(rows[0].project);
    const metadata =
      rows[0].metadata && typeof rows[0].metadata === "object"
        ? (rows[0].metadata as Record<string, unknown>)
        : {};
    if (project === "saas-inflation" && Number(rows[0].pricing_count) < 1) {
      throw new Error("Pricing records require normalized plan details.");
    }
    if (
      project === "startup-graveyard" &&
      (!rows[0].occurred_on || String(rows[0].confidence).includes("unreviewed"))
    ) {
      throw new Error("Shutdown records require a date and reviewed confidence.");
    }
    if (
      project === "founder-apologies" &&
      (!cleanText(metadata.excerpt, 500) || !cleanText(metadata.context, 1000))
    ) {
      throw new Error("Founder records require a short excerpt and neutral context.");
    }
    if (project === "quality-control" && Number(rows[0].citrus_count) < 1) {
      throw new Error("Citrus records require a scored owner inspection.");
    }
  }
  const revisionId = String(rows[0].current_revision_id);
  await sql`
    UPDATE cia_revisions
    SET status = ${next}, moderation_rationale = ${rationale}
    WHERE id = ${revisionId}
  `;
  await sql`
    UPDATE cia_entries
    SET status = ${next}, updated_at = NOW()
    WHERE id = ${id}
  `;
  await sql`
    INSERT INTO cia_moderation_events (
      id, entry_id, revision_id, from_status, to_status, rationale, actor_id
    )
    VALUES (
      ${randomUUID()}, ${id}, ${revisionId}, ${current}, ${next},
      ${rationale}, ${input.actorId}
    )
  `;
}

export async function deleteCiaEntry(idValue: unknown) {
  await ensureCiaTables();
  const id = cleanId(idValue);
  const rows = await db()`
    SELECT status FROM cia_entries WHERE id = ${id} LIMIT 1
  `;
  if (rows.length !== 1) return;
  const status = cleanStatus(rows[0].status);
  if (!["draft", "rejected"].includes(status)) {
    throw new Error("Only draft or rejected CIA records may be deleted.");
  }
  await db()`DELETE FROM cia_entries WHERE id = ${id}`;
}

export function hashDiscoveryContent(content: string) {
  return createHash("sha256").update(content).digest("hex");
}

const DEFAULT_PRICING_WATCHLIST = [
  { url: "https://vercel.com/pricing", publisher: "Vercel" },
  { url: "https://github.com/pricing", publisher: "GitHub" },
] as const;

function safeDiscoveryUrl(value: string) {
  const url = new URL(value);
  const hostname = url.hostname.toLowerCase();
  const blocked =
    url.protocol !== "https:" ||
    hostname === "localhost" ||
    hostname.endsWith(".local") ||
    /^\d+\.\d+\.\d+\.\d+$/.test(hostname) ||
    hostname === "[::1]";
  if (blocked || url.username || url.password || url.port) {
    throw new Error("Unsafe discovery URL.");
  }
  url.hash = "";
  return url;
}

function pricingWatchlist() {
  const configured = cleanText(process.env.CIA_PRICING_WATCHLIST, 4000);
  if (!configured) return [...DEFAULT_PRICING_WATCHLIST];
  return configured
    .split(",")
    .slice(0, 4)
    .map((item) => {
      const [publisher, rawUrl] = item.split("|").map((part) => part.trim());
      const url = safeDiscoveryUrl(rawUrl || publisher);
      return {
        publisher: rawUrl ? cleanLine(publisher, 120) : url.hostname,
        url: url.toString(),
      };
    });
}

async function boundedTextResponse(
  url: URL,
  init: RequestInit = {},
  maxBytes = 256_000,
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5_000);
  try {
    const response = await fetch(url, {
      ...init,
      redirect: "error",
      signal: controller.signal,
      headers: {
        "User-Agent": "ClementineCIA/1.0 (+https://clemissima.com/privacy)",
        Accept: "text/html,text/plain;q=0.9",
        ...init.headers,
      },
    });
    if (response.status === 304) return { response, text: "" };
    if (!response.ok) throw new Error(`Source returned ${response.status}.`);
    const contentLength = Number(response.headers.get("content-length") ?? 0);
    if (contentLength > maxBytes) throw new Error("Source exceeds byte cap.");
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Source did not return a body.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new Error("Source exceeds byte cap.");
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return { response, text: new TextDecoder().decode(bytes) };
  } finally {
    clearTimeout(timer);
  }
}

async function robotsAllows(url: URL) {
  const robotsUrl = new URL("/robots.txt", url);
  try {
    const { text } = await boundedTextResponse(robotsUrl, {}, 32_000);
    let applies = false;
    for (const rawLine of text.split("\n")) {
      const line = rawLine.replace(/#.*$/, "").trim();
      const [key, ...rest] = line.split(":");
      const value = rest.join(":").trim();
      if (key?.toLowerCase() === "user-agent") {
        applies = value === "*";
      } else if (
        applies &&
        key?.toLowerCase() === "disallow" &&
        value &&
        url.pathname.startsWith(value)
      ) {
        return false;
      }
    }
    return true;
  } catch {
    // A missing or unavailable robots file is not interpreted as permission to
    // crawl broadly. This watcher still makes one bounded request to a manually
    // configured official page.
    return true;
  }
}

function extractPriceSignals(html: string) {
  const text = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");
  return Array.from(
    new Set(text.match(/(?:[$€£]\s?\d[\d,.]*|\d[\d,.]*\s?(?:USD|EUR|GBP))/g) ?? []),
  ).slice(0, 12);
}

export async function runCiaDiscovery() {
  await ensureCiaTables();
  const sql = db();
  const claimed = await sql`
    INSERT INTO cia_discovery_runs (run_date)
    VALUES ((NOW() AT TIME ZONE 'UTC')::date)
    ON CONFLICT (run_date) DO NOTHING
    RETURNING run_date
  `;
  if (claimed.length === 0) {
    return { skipped: true, checked: 0, changed: 0, errors: 0 };
  }

  let checked = 0;
  let changed = 0;
  let errors = 0;
  for (const item of pricingWatchlist()) {
    try {
      const url = safeDiscoveryUrl(item.url);
      if (!(await robotsAllows(url))) throw new Error("Blocked by robots.txt.");
      const previousRows = await sql`
        SELECT etag, last_modified, content_hash
        FROM cia_discovery_sources
        WHERE url = ${url.toString()}
        LIMIT 1
      `;
      const previous = previousRows[0];
      const headers: Record<string, string> = {};
      if (previous?.etag) headers["If-None-Match"] = String(previous.etag);
      if (previous?.last_modified) {
        headers["If-Modified-Since"] = String(previous.last_modified);
      }
      const { response, text } = await boundedTextResponse(url, { headers });
      checked += 1;
      if (response.status === 304) {
        await sql`
          UPDATE cia_discovery_sources
          SET last_checked_at = NOW()
          WHERE url = ${url.toString()}
        `;
        continue;
      }
      const hash = hashDiscoveryContent(text);
      const priorHash = previous?.content_hash
        ? String(previous.content_hash)
        : null;
      const didChange = Boolean(priorHash && priorHash !== hash);
      await sql`
        INSERT INTO cia_discovery_sources (
          url, publisher, project, etag, last_modified, content_hash,
          last_checked_at, last_changed_at
        )
        VALUES (
          ${url.toString()}, ${item.publisher}, 'saas-inflation',
          ${response.headers.get("etag")},
          ${response.headers.get("last-modified")},
          ${hash}, NOW(), ${didChange ? new Date().toISOString() : null}
        )
        ON CONFLICT (url) DO UPDATE SET
          publisher = EXCLUDED.publisher,
          etag = EXCLUDED.etag,
          last_modified = EXCLUDED.last_modified,
          content_hash = EXCLUDED.content_hash,
          last_checked_at = NOW(),
          last_changed_at = CASE
            WHEN cia_discovery_sources.content_hash IS DISTINCT FROM EXCLUDED.content_hash
              THEN NOW()
            ELSE cia_discovery_sources.last_changed_at
          END
      `;
      if (didChange) {
        changed += 1;
        const date = new Date().toISOString().slice(0, 10);
        await saveCiaEntry(
          {
            project: "saas-inflation",
            title: `Pricing page change detected: ${item.publisher}`,
            slug: `${item.publisher
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-|-$/g, "")}-${date}-${hash.slice(0, 8)}`,
            summary:
              "Automated change alert only. Compare this official page with dated evidence and enter normalized pricing facts before approval.",
            confidence: "unreviewed automated lead",
            sourceUrl: url.toString(),
            sourceLabel: "Official pricing page",
            publisher: item.publisher,
            sourceType: "official",
            metadata: {
              discoveredAt: new Date().toISOString(),
              priorHash: priorHash?.slice(0, 16),
              currentHash: hash.slice(0, 16),
              priceSignals: extractPriceSignals(text),
              automated: true,
            },
            moderationRationale:
              "Created by bounded daily change detection; automation cannot approve or publish.",
          },
          "cia-daily-discovery",
        );
      }
    } catch (error) {
      errors += 1;
      console.error("CIA discovery source failed.", {
        source: item.url,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
  await sql`
    UPDATE cia_discovery_runs
    SET
      finished_at = NOW(),
      checked_count = ${checked},
      changed_count = ${changed},
      error_count = ${errors}
    WHERE run_date = (NOW() AT TIME ZONE 'UTC')::date
  `;
  return { skipped: false, checked, changed, errors };
}

export function ciaProjectPath(project: CiaProject) {
  return `/cia/${project}`;
}
