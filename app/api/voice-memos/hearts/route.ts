import { NextResponse } from "next/server";
import { toggleHeart } from "@/lib/recordings";
import { visitorHash } from "@/lib/recording-visitor";

export const runtime = "nodejs";

function validOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!validOrigin(request)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 403 });
  }
  let payload: { id?: unknown };
  try {
    payload = (await request.json()) as { id?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  try {
    const hash = await visitorHash({ create: true });
    if (!hash) {
      return NextResponse.json({ error: "Hearts are unavailable." }, { status: 503 });
    }
    const result = await toggleHeart(payload.id, hash);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Try again." },
      { status: 400 },
    );
  }
}
