import { NextResponse } from "next/server";
import { createReceipt } from "@/lib/friends";
import { visitorHash } from "@/lib/recording-visitor";
import { canSeeShop } from "@/lib/shop-access";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!(await canSeeShop())) return NextResponse.json({ error: "Not open yet." }, { status: 404 });
  let body: { slugs?: unknown; items?: unknown; note?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  type CheckoutLine = { slug: string; colorName?: string; colorHex?: string };
  const lines: Array<string | CheckoutLine> = Array.isArray(body.items)
    ? body.items
        .flatMap((entry): CheckoutLine[] => {
          if (!entry || typeof entry !== "object") return [];
          const row = entry as { slug?: unknown; colorName?: unknown; colorHex?: unknown };
          if (typeof row.slug !== "string") return [];
          const line: CheckoutLine = { slug: row.slug };
          if (typeof row.colorName === "string") line.colorName = row.colorName;
          if (typeof row.colorHex === "string") line.colorHex = row.colorHex;
          return [line];
        })
        .slice(0, 24)
    : Array.isArray(body.slugs)
      ? body.slugs.filter((s): s is string => typeof s === "string").slice(0, 24)
      : [];
  try {
    const hash = await visitorHash({ create: true });
    const id = await createReceipt(lines, body.note, hash);
    return NextResponse.json({ id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Checkout failed." },
      { status: 400 },
    );
  }
}
