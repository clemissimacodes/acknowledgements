"use client";

import { formatRollTime } from "@/lib/photography-format";
import { HoverIndex } from "./HoverIndex";

export type PhotoIndexRoll = {
  slug: string;
  title: string;
  photograph: string;
  year: number | null;
  month: number | null;
  cover: { url: string; width: number; height: number } | null;
};

export function PhotoIndex({ rolls }: { rolls: PhotoIndexRoll[] }) {
  return (
    <HoverIndex
      labels={{
        a: { short: "R.", full: "Roll" },
        b: { short: "P.", full: "Photograph" },
        time: { short: "T.", full: "Time" },
      }}
      rows={rolls.map((roll) => ({
        key: roll.slug,
        href: `/photography/${roll.slug}`,
        a: roll.title,
        b: roll.photograph,
        time: formatRollTime(roll),
        image: roll.cover,
      }))}
    />
  );
}
