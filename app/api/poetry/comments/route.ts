import { cookies } from "next/headers";
import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isAdminUser } from "@/lib/admin";
import { addPoemNote, notesForPoem, type PoemNoteKind } from "@/lib/poem-comments";
import { getPoem, poemLines } from "@/lib/poems";

const RATE_COOKIE = "poetry_notes_day";
const DAILY_LIMIT = 8;

type CreateNotePayload = {
  poem?: unknown;
  line?: unknown;
  kind?: unknown;
  name?: unknown;
  body?: unknown;
  website?: unknown;
};

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
  const name = String(value ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
  if (!name) return null;
  if (name.length < 2 || /https?:\/\/|www\./i.test(name)) return undefined;
  return name;
}

function cleanBody(value: unknown) {
  const body = String(value ?? "").replace(/\0/g, "").trim().slice(0, 600);
  if (body.length < 2 || /https?:\/\/|www\./i.test(body)) return null;
  return body;
}

function cleanKind(value: unknown): PoemNoteKind {
  return value === "question" ? "question" : "note";
}

function rateState(value: string | undefined) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, rawCount] = (value ?? "").split(":");
  const count = date === today ? Number.parseInt(rawCount ?? "0", 10) || 0 : 0;
  return { today, count };
}

export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("poem") ?? "";
  if (!getPoem(slug)) {
    return NextResponse.json({ notes: [], admin: false }, { status: 404 });
  }

  try {
    const [notes, user] = await Promise.all([notesForPoem(slug), currentUser()]);
    return NextResponse.json(
      { notes, admin: isAdminUser(user) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "The margin is unavailable.", notes: [], admin: false },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  if (!validOrigin(request)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 403 });
  }
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > 5_000) {
    return NextResponse.json({ error: "That note is too large." }, { status: 413 });
  }

  let payload: CreateNotePayload;
  try {
    payload = (await request.json()) as CreateNotePayload;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (String(payload.website ?? "").trim()) {
    return NextResponse.json({ ok: true });
  }

  const poem = getPoem(String(payload.poem ?? ""));
  if (!poem) {
    return NextResponse.json({ error: "Unknown poem." }, { status: 404 });
  }
  const lines = poemLines(poem);
  const line = Number(payload.line);
  if (
    !Number.isInteger(line) ||
    line < 0 ||
    line >= lines.length ||
    !lines[line]?.trim()
  ) {
    return NextResponse.json({ error: "Choose a line with words." }, { status: 400 });
  }
  const name = cleanName(payload.name);
  const body = cleanBody(payload.body);
  if (name === undefined) {
    return NextResponse.json({ error: "Check the name." }, { status: 400 });
  }
  if (!body) {
    return NextResponse.json(
      { error: "Write a little more, without links." },
      { status: 400 },
    );
  }

  const jar = await cookies();
  const rate = rateState(jar.get(RATE_COOKIE)?.value);
  if (rate.count >= DAILY_LIMIT) {
    return NextResponse.json(
      { error: "The margin is full for today." },
      { status: 429 },
    );
  }

  try {
    const note = await addPoemNote({
      poem: poem.slug,
      line,
      kind: cleanKind(payload.kind),
      name,
      body,
    });
    const response = NextResponse.json({ note });
    response.cookies.set(RATE_COOKIE, `${rate.today}:${rate.count + 1}`, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24,
    });
    return response;
  } catch {
    return NextResponse.json(
      { error: "The margin did not take it." },
      { status: 503 },
    );
  }
}
