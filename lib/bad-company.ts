import "server-only";

import { readFile } from "fs/promises";
import path from "path";
import { cache } from "react";
import example from "@/data/bad-company.example.json";
import { slugifyFriend } from "@/lib/friend-types";

export const BAD_SHOP_NAME = "Bad Company";
export const BAD_PATH = "/bad-company";
export const BAD_DIARY_PATH = "/bad-company/diary";

/* Owner only, always. Flip this and the whole roster is public on clemissima.com. */
export const BAD_COMPANY_LIVE = false;

export const BAD_BADGES = {
  none: "",
  "final-sale": "Final Sale",
  recalled: "Recalled",
  discontinued: "Discontinued",
  "never-again": "Never Again in Stock",
  "returned": "Returned to Sender",
} as const;
export type BadBadge = keyof typeof BAD_BADGES;

export type Enemy = {
  slug: string;
  nickname: string;
  productName: string;
  badge: BadBadge;
  relationship: string; // the filter: "Former Friend", "Coworker", "Acquaintance", "Ex"…
  metHow: string;
  hometown: string;
  madeOf: string[]; // the flaws
  care: string;
  worstMemory: string;
  pairsBadlyWith: string;
  discontinued: string; // "Fall 2024": the season it ended
  condition: string;
  price: string; // free text, e.g. "0", "0.01", "What they still owe me"
  heroUrl: string | null;
  visible: boolean;
};

/* The committed file is placeholder archetypes. This repo is public on GitHub, so
   real names never go there: they load from BAD_COMPANY_ROSTER (env, JSON array)
   or the gitignored .data/bad-company.json, in that order. */
const LOCAL_FILE = path.join(process.cwd(), ".data", "bad-company.json");

function str(value: unknown, max = 2000) {
  return String(value ?? "").trim().slice(0, max);
}

function normalize(raw: unknown, index: number): Enemy | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const nickname = str(row.nickname, 80);
  if (!nickname) return null;
  const badge = str(row.badge) in BAD_BADGES ? (str(row.badge) as BadBadge) : "none";
  const hero = str(row.heroUrl, 400);
  return {
    slug: slugifyFriend(str(row.slug, 48) || nickname) || `item-${index + 1}`,
    nickname,
    productName: str(row.productName, 120),
    badge,
    relationship: str(row.relationship, 40),
    metHow: str(row.metHow, 80),
    hometown: str(row.hometown, 80),
    madeOf: Array.isArray(row.madeOf) ? row.madeOf.map((m) => str(m, 40)).filter(Boolean).slice(0, 4) : [],
    care: str(row.care, 400),
    worstMemory: str(row.worstMemory),
    pairsBadlyWith: str(row.pairsBadlyWith, 200),
    discontinued: str(row.discontinued, 40),
    condition: str(row.condition, 80),
    price: str(row.price, 60),
    heroUrl: /^https?:\/\/|^\//.test(hero) ? hero : null,
    visible: row.visible !== false,
  };
}

async function readRoster(): Promise<unknown[]> {
  const fromEnv = process.env.BAD_COMPANY_ROSTER?.trim();
  if (fromEnv) {
    try {
      const parsed = JSON.parse(fromEnv);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      console.error("BAD_COMPANY_ROSTER is not valid JSON; falling back.");
    }
  }
  try {
    const parsed = JSON.parse(await readFile(LOCAL_FILE, "utf8"));
    if (Array.isArray(parsed)) return parsed;
  } catch {
    /* no local roster */
  }
  return example;
}

export const listEnemies = cache(async (): Promise<Enemy[]> => {
  const rows = await readRoster();
  const seen = new Set<string>();
  const out: Enemy[] = [];
  rows.forEach((raw, index) => {
    const enemy = normalize(raw, index);
    if (!enemy || !enemy.visible || seen.has(enemy.slug)) return;
    seen.add(enemy.slug);
    out.push(enemy);
  });
  return out;
});

export async function getEnemyBySlug(slug: string) {
  return (await listEnemies()).find((enemy) => enemy.slug === slug) ?? null;
}

/* "$ 0 USD" for numbers; anything else is printed as written. */
export function badPriceLabel(price: string) {
  const raw = price || "0";
  const n = Number(raw.replace(/[$,\s]/g, ""));
  if (Number.isFinite(n)) {
    return `$ ${n.toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })} USD`;
  }
  return raw;
}
