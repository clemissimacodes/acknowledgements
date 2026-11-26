import { NextResponse } from "next/server";
import { toggleResponseHeart } from "@/lib/recordings";
import { viewerIsOwner } from "@/lib/recording-owner";
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
  let payload: { kind?: unknown; id?: unknown };
  try {
    payload = (await request.json()) as { kind?: unknown; id?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  try {
    const result = await toggleResponseHeart(payload.kind, payload.id, {
      visitorHash: await visitorHash({ create: true }),
      byOwner: await viewerIsOwner(),
    });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Try again." },
      { status: 400 },
    );
  }
}
