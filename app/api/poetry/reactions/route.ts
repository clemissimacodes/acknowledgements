import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getPoem } from "@/lib/poems";
import {
  isReactionId,
  reactionsForPoem,
  toggleReaction,
} from "@/lib/poem-reactions";

const VISITOR_COOKIE = "poetry_visitor";

function validOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

function cleanVisitorId(value: string | undefined) {
  return value && /^[a-f0-9-]{36}$/.test(value) ? value : null;
}

export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("poem") ?? "";
  if (!getPoem(slug)) {
    return NextResponse.json({ error: "Unknown poem." }, { status: 404 });
  }
  const visitorId = cleanVisitorId((await cookies()).get(VISITOR_COOKIE)?.value);
  try {
    return NextResponse.json(await reactionsForPoem(slug, visitorId), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "Reactions are unavailable." },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  if (!validOrigin(request)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 403 });
  }
  let payload: { poem?: unknown; reaction?: unknown };
  try {
    payload = (await request.json()) as { poem?: unknown; reaction?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const poem = getPoem(String(payload.poem ?? ""));
  if (!poem) {
    return NextResponse.json({ error: "Unknown poem." }, { status: 404 });
  }
  if (!isReactionId(payload.reaction)) {
    return NextResponse.json({ error: "Unknown reaction." }, { status: 400 });
  }

  const jar = await cookies();
  const visitorId = cleanVisitorId(jar.get(VISITOR_COOKIE)?.value) ?? randomUUID();

  try {
    const state = await toggleReaction({
      poem: poem.slug,
      reaction: payload.reaction,
      visitorId,
    });
    const response = NextResponse.json(state);
    response.cookies.set(VISITOR_COOKIE, visitorId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    return response;
  } catch {
    return NextResponse.json(
      { error: "The reaction did not land." },
      { status: 503 },
    );
  }
}
