import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { isAdminUser } from "@/lib/admin";
import { createMemo, listPublishedMemos } from "@/lib/voice-memos";

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

function cleanTitle(value: unknown) {
  return String(value ?? "")
    .replace(/\0/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

export async function GET() {
  try {
    const memos = await listPublishedMemos();
    return NextResponse.json(
      {
        memos: memos.map((memo) => ({
          slug: memo.slug,
          kind: memo.kind,
          title: memo.title,
          recordedAt: memo.recordedAt,
          durationMs: memo.durationMs,
          replyCount: memo.replyCount,
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "The archive is unavailable.", memos: [] },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  if (!validOrigin(request)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 403 });
  }
  const user = await currentUser();
  if (!isAdminUser(user)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  let payload: {
    kind?: unknown;
    title?: unknown;
    durationMs?: unknown;
    url?: unknown;
    pathname?: unknown;
    recordedAt?: unknown;
    published?: unknown;
  };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const kind = payload.kind === "person" ? "person" : payload.kind === "thought" ? "thought" : null;
  const title = cleanTitle(payload.title);
  if (!kind) {
    return NextResponse.json({ error: "Choose people or thoughts." }, { status: 400 });
  }
  if (kind === "person" && title.length < 2) {
    return NextResponse.json({ error: "Name the person." }, { status: 400 });
  }

  const durationMs = Number(payload.durationMs);
  const url = String(payload.url ?? "").trim();
  const pathname = String(payload.pathname ?? "").trim().replace(/^\//, "");
  const recordedAt = String(payload.recordedAt ?? "").trim() || null;
  if (recordedAt && Number.isNaN(new Date(recordedAt).getTime())) {
    return NextResponse.json({ error: "Check the date." }, { status: 400 });
  }

  try {
    const memo = await createMemo({
      kind,
      title,
      durationMs,
      blobUrl: url,
      blobPathname: pathname,
      recordedAt,
      published: payload.published !== false,
    });
    revalidatePath("/secrets/out-loud");
    revalidatePath(`/secrets/out-loud/${memo.slug}`);
    revalidatePath("/controlroom");
    return NextResponse.json({ memo });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "The memo could not be saved.",
      },
      { status: 400 },
    );
  }
}
