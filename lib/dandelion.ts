import { randomUUID } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { postgresAddWish, postgresConfigured, postgresListWishes } from "@/lib/dandelion-db";
import type { Wish, WishExtras } from "@/lib/dandelion-types";

export type { Wish, WishExtras } from "@/lib/dandelion-types";

export const DANDELION_COOKIE = "dandelion_ok";
export const DANDELION_COOKIE_VALUE = "open";
export const DANDELION_COUNT_COOKIE = "dandelion_n";
export const DANDELION_MAX_WISHES = 20;
export const DANDELION_WISH_MAX = 100;
export const DANDELION_LOCATION_MAX = 40;
export const DANDELION_GENDER_MAX = 24;
export const DANDELION_AGE_MAX = 12;
export const DANDELION_VISIBLE = 40;
export const DANDELION_GENDERS = ["m", "f", "other", "fruit", "bunny"] as const;

const FILE = path.join(process.cwd(), ".data", "wishes.json");
const NOTION_VERSION = "2022-06-28";

type NotionProp = {
  type?: string;
  title?: { plain_text?: string }[];
  rich_text?: { plain_text?: string }[];
  number?: number | null;
  select?: { name?: string } | null;
};

function readFileWishes(): Wish[] {
  try {
    if (!existsSync(FILE)) return [];
    const parsed = JSON.parse(readFileSync(FILE, "utf8")) as Wish[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const memory = globalThis as typeof globalThis & { __dandelionWishes?: Wish[] };

function remembered(): Wish[] {
  if (!memory.__dandelionWishes) memory.__dandelionWishes = [];
  return memory.__dandelionWishes;
}

function remember(wishes: Wish[]) {
  memory.__dandelionWishes = wishes.slice(0, DANDELION_VISIBLE);
}

function writeFileWishes(wishes: Wish[]) {
  try {
    mkdirSync(path.dirname(FILE), { recursive: true });
    writeFileSync(FILE, JSON.stringify(wishes, null, 2) + "\n");
  } catch {
    // Vercel’s filesystem is read-only; memory still holds the field.
  }
}

function gatheredWishes(): Wish[] {
  const byId = new Map<string, Wish>();
  for (const wish of [...readFileWishes(), ...remembered()]) {
    byId.set(wish.id, wish);
  }
  return [...byId.values()]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, DANDELION_VISIBLE);
}

function cleanLine(raw: string, max: number): string | undefined {
  const body = raw.replace(/\s+/g, " ").trim().slice(0, max);
  if (!body) return undefined;
  if (/https?:\/\//i.test(body)) return undefined;
  return body;
}

export function cleanWish(raw: string): string | null {
  return cleanLine(raw, DANDELION_WISH_MAX) ?? null;
}

export function cleanExtras(raw: {
  location?: string;
  gender?: string;
  age?: string;
}): WishExtras {
  const location = cleanLine(
    String(raw.location ?? ""),
    DANDELION_LOCATION_MAX,
  );
  const gender = cleanLine(String(raw.gender ?? ""), DANDELION_GENDER_MAX);
  const age = Number(String(raw.age ?? "").trim());
  return {
    location:
      location &&
      /^\d{1,2}(?:\.\d)° [NS], \d{1,3}(?:\.\d)° [EW]$/.test(location)
        ? location
        : undefined,
    gender: DANDELION_GENDERS.includes(
      gender as (typeof DANDELION_GENDERS)[number],
    )
      ? gender
      : undefined,
    age:
      Number.isInteger(age) && age >= 10 && age <= 100
        ? String(age).slice(0, DANDELION_AGE_MAX)
        : undefined,
  };
}

function notionConfigured() {
  return Boolean(process.env.NOTION_TOKEN && process.env.DANDELION_DATABASE_ID);
}

function propText(prop: NotionProp | undefined): string | undefined {
  if (!prop) return undefined;
  if (typeof prop.number === "number") return String(prop.number);
  if (prop.select?.name) return prop.select.name.trim() || undefined;
  const text = [...(prop.title ?? []), ...(prop.rich_text ?? [])]
    .map((part) => part.plain_text ?? "")
    .join("")
    .trim();
  return text || undefined;
}

function pickProp(
  properties: Record<string, NotionProp>,
  names: string[],
): NotionProp | undefined {
  for (const name of names) {
    if (properties[name]) return properties[name];
  }
  return undefined;
}

function richText(value: string | undefined) {
  if (!value) return undefined;
  return { rich_text: [{ type: "text" as const, text: { content: value } }] };
}

function extrasFromProperties(properties: Record<string, NotionProp>): WishExtras {
  return {
    location: propText(pickProp(properties, ["Location", "location"])),
    gender: propText(pickProp(properties, ["Gender", "gender"])),
    age: propText(pickProp(properties, ["Age", "age"])),
  };
}

async function notionQuery(): Promise<Wish[] | null> {
  const token = process.env.NOTION_TOKEN;
  const databaseId = process.env.DANDELION_DATABASE_ID;
  if (!token || !databaseId) return null;

  const wishes: Wish[] = [];
  let cursor: string | undefined;

  do {
    const response = await fetch(
      `https://api.notion.com/v1/databases/${databaseId}/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Notion-Version": NOTION_VERSION,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          page_size: 100,
          start_cursor: cursor,
          sorts: [{ timestamp: "created_time", direction: "descending" }],
        }),
        cache: "no-store",
      },
    );
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      results?: Array<{
        id: string;
        created_time?: string;
        properties?: Record<string, NotionProp>;
      }>;
      has_more?: boolean;
      next_cursor?: string | null;
    };
    for (const page of payload.results ?? []) {
      const properties = page.properties ?? {};
      const wishProp =
        properties.Wish ??
        properties.Name ??
        properties.Title ??
        Object.values(properties)[0];
      const text = propText(wishProp);
      if (!text) continue;
      wishes.push({
        id: page.id,
        body: text.slice(0, DANDELION_WISH_MAX),
        createdAt: page.created_time ?? new Date().toISOString(),
        ...extrasFromProperties(properties),
      });
    }
    cursor = payload.has_more && payload.next_cursor ? payload.next_cursor : undefined;
  } while (cursor && wishes.length < DANDELION_VISIBLE);

  return wishes.slice(0, DANDELION_VISIBLE);
}

async function notionCreate(
  token: string,
  databaseId: string,
  properties: Record<string, unknown>,
) {
  return fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      parent: { database_id: databaseId },
      properties,
    }),
  });
}

async function titlePropertyName(
  token: string,
  databaseId: string,
): Promise<string> {
  try {
    const response = await fetch(
      `https://api.notion.com/v1/databases/${databaseId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Notion-Version": NOTION_VERSION,
        },
        cache: "no-store",
      },
    );
    if (!response.ok) return "Wish";
    const database = (await response.json()) as {
      properties?: Record<string, { type?: string }>;
    };
    const titled = Object.entries(database.properties ?? {}).find(
      ([, prop]) => prop.type === "title",
    );
    return titled?.[0] ?? "Wish";
  } catch {
    return "Wish";
  }
}

async function notionAdd(body: string, extras: WishExtras): Promise<Wish | null> {
  const token = process.env.NOTION_TOKEN;
  const databaseId = process.env.DANDELION_DATABASE_ID;
  if (!token || !databaseId) return null;

  const titleKey = await titlePropertyName(token, databaseId);
  const wishProperties = {
    [titleKey]: {
      title: [{ type: "text", text: { content: body } }],
    },
  };
  const extraProperties = {
    ...(richText(extras.location) ? { Location: richText(extras.location) } : {}),
    ...(richText(extras.gender) ? { Gender: richText(extras.gender) } : {}),
    ...(richText(extras.age) ? { Age: richText(extras.age) } : {}),
  };

  let response = await notionCreate(token, databaseId, {
    ...wishProperties,
    ...extraProperties,
  });
  if (!response.ok && Object.keys(extraProperties).length > 0) {
    response = await notionCreate(token, databaseId, wishProperties);
  }
  if (!response.ok) return null;
  const page = (await response.json()) as { id?: string; created_time?: string };
  if (!page.id) return null;
  return {
    id: page.id,
    body,
    createdAt: page.created_time ?? new Date().toISOString(),
    ...extras,
  };
}

export async function listWishes(): Promise<Wish[]> {
  if (postgresConfigured()) {
    const fromPostgres = await postgresListWishes();
    if (fromPostgres) {
      remember(fromPostgres);
      return fromPostgres;
    }
  }
  if (notionConfigured()) {
    const fromNotion = await notionQuery();
    if (fromNotion) {
      remember(fromNotion);
      return fromNotion;
    }
  }
  return gatheredWishes();
}

export async function addWish(body: string, extras: WishExtras = {}): Promise<Wish> {
  const cleaned = cleanWish(body);
  if (!cleaned) {
    throw new Error("empty");
  }
  const extra = cleanExtras(extras);
  const wish: Wish = {
    id: randomUUID(),
    body: cleaned,
    createdAt: new Date().toISOString(),
    ...extra,
  };
  if (postgresConfigured()) {
    const created = await postgresAddWish(wish, extra);
    if (created) {
      remember([created, ...remembered()]);
      return created;
    }
  }
  if (notionConfigured()) {
    const created = await notionAdd(cleaned, extra);
    if (created) {
      remember([created, ...remembered()]);
      return created;
    }
  }
  const wishes = gatheredWishes();
  wishes.unshift(wish);
  remember(wishes);
  writeFileWishes(wishes);
  return wish;
}

export function hasBlown(value: string | undefined) {
  return value === DANDELION_COOKIE_VALUE;
}

export function wishCount(value: string | undefined) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}
