import { NextResponse } from "next/server";
import { countPoemRead, poemReads } from "@/lib/poem-reads";
import { viewerIsOwner } from "@/lib/recording-owner";

export const runtime = "nodejs";

const noStore = { "Cache-Control": "no-store" };

function validOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  try {
    const reads = await poemReads(new URL(request.url).searchParams.get("slug"));
    return NextResponse.json({ reads }, { headers: noStore });
  } catch {
    return NextResponse.json({ reads: null }, { status: 400, headers: noStore });
  }
}

export async function POST(request: Request) {
  if (!validOrigin(request)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 403 });
  }
  let payload: { slug?: unknown };
  try {
    payload = (await request.json()) as { slug?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  try {
    if (await viewerIsOwner()) {
      return NextResponse.json(
        { counted: false, reads: await poemReads(payload.slug) },
        { headers: noStore },
      );
    }
    const reads = await countPoemRead(payload.slug);
    return NextResponse.json({ counted: true, reads }, { headers: noStore });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Try again." },
      { status: 400 },
    );
  }
}
