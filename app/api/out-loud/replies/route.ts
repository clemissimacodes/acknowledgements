import { cookies } from "next/headers";
import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { isAdminUser } from "@/lib/admin";
import {
  createReply,
  getPublishedMemo,
  repliesForMemo,
} from "@/lib/voice-memos";

export const runtime = "nodejs";

const RATE_COOKIE = "out_loud_replies_day";
const DAILY_LIMIT = 8;

function validOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

function cleanName(value: unknown) {
  const name = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
  if (!name) return null;
  if (name.length < 2 || /https?:\/\/|www\./i.test(name)) return undefined;
  return name;
}

function rateState(value: string | undefined) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, rawCount] = (value ?? "").split(":");
  const count = date === today ? Number.parseInt(rawCount ?? "0", 10) || 0 : 0;
  return { today, count };
}

export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("memo") ?? "";
  const memo = await getPublishedMemo(slug).catch(() => null);
  if (!memo) {
    return NextResponse.json({ replies: [], admin: false }, { status: 404 });
  }
  try {
    const [replies, user] = await Promise.all([
      repliesForMemo(memo.id),
      currentUser(),
    ]);
    return NextResponse.json(
      { replies, admin: isAdminUser(user) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "The replies are unavailable.", replies: [], admin: false },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  if (!validOrigin(request)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 403 });
  }

  let payload: {
    memo?: unknown;
    name?: unknown;
    durationMs?: unknown;
    url?: unknown;
    pathname?: unknown;
    website?: unknown;
  };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (String(payload.website ?? "").trim()) {
    return NextResponse.json({ ok: true });
  }

  const memo = await getPublishedMemo(String(payload.memo ?? "")).catch(
    () => null,
  );
  if (!memo) {
    return NextResponse.json({ error: "Unknown memo." }, { status: 404 });
  }
  const name = cleanName(payload.name);
  if (name === undefined) {
    return NextResponse.json({ error: "Check the name." }, { status: 400 });
  }

  const jar = await cookies();
  const rate = rateState(jar.get(RATE_COOKIE)?.value);
  if (rate.count >= DAILY_LIMIT) {
    return NextResponse.json(
      { error: "The tape is full for today." },
      { status: 429 },
    );
  }

  try {
    const reply = await createReply({
      memoId: memo.id,
      name,
      durationMs: Number(payload.durationMs),
      blobUrl: String(payload.url ?? "").trim(),
      blobPathname: String(payload.pathname ?? "").trim().replace(/^\//, ""),
    });
    revalidatePath(`/out-loud/${memo.slug}`);
    revalidatePath("/out-loud");
    revalidatePath("/controlroom");
    const response = NextResponse.json({ reply });
    response.cookies.set(RATE_COOKIE, `${rate.today}:${rate.count + 1}`, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24,
    });
    return response;
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The reply could not be kept.",
      },
      { status: 400 },
    );
  }
}
