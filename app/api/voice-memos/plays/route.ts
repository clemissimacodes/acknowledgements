import { NextResponse } from "next/server";
import { viewerIsOwner } from "@/lib/recording-owner";
import { countPlay } from "@/lib/recordings";

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
  if (await viewerIsOwner()) {
    return NextResponse.json({ counted: false }, { headers: { "Cache-Control": "no-store" } });
  }
  try {
    const result = await countPlay(payload.id);
    return NextResponse.json(
      { counted: true, ...result },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Try again." },
      { status: 400 },
    );
  }
}
