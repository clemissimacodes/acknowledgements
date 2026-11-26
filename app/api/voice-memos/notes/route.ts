import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { addNote } from "@/lib/recordings";
import { visitorHash } from "@/lib/recording-visitor";
import { viewerIsOwner } from "@/lib/recording-owner";

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
  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  try {
    const note = await addNote({
      recordingId: payload.id,
      name: payload.name,
      body: payload.body,
      website: payload.website,
      parentKind: payload.parentKind,
      parentId: payload.parentId,
      visitorHash: await visitorHash({ create: true }),
      byOwner: await viewerIsOwner(),
    });
    if (!note) return NextResponse.json({ note: null });
    revalidatePath("/voice-memos");
    revalidatePath("/controlroom/voice-memos");
    return NextResponse.json({ note }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Try again." },
      { status: 400 },
    );
  }
}
