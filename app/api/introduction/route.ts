import { NextResponse } from "next/server";
import {
  addIntroduction,
  cleanIntroduction,
} from "@/lib/introduction";
import { INTRO_COOKIE, INTRO_COOKIE_VALUE } from "@/lib/intro-gate";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) {
        return NextResponse.json(
          { error: "That introduction came from somewhere else." },
          { status: 403 },
        );
      }
    } catch {
      return NextResponse.json(
        { error: "That introduction came from somewhere else." },
        { status: 403 },
      );
    }
  }

  let payload: {
    name?: unknown;
    location?: unknown;
    foundVia?: unknown;
    tinyThing?: unknown;
    consent?: unknown;
    website?: unknown;
  };

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Your introduction got crumpled." },
      { status: 400 },
    );
  }

  if (payload.website) {
    return NextResponse.json({ ok: true });
  }

  if (payload.consent !== true) {
    return NextResponse.json(
      { error: "Please agree before entering." },
      { status: 400 },
    );
  }

  const introduction = cleanIntroduction(payload);
  if (!introduction) {
    return NextResponse.json(
      { error: "Please answer each little question." },
      { status: 400 },
    );
  }

  if (!(await addIntroduction(introduction))) {
    return NextResponse.json(
      { error: "The little door is resting. Please try again shortly." },
      { status: 503 },
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(INTRO_COOKIE, INTRO_COOKIE_VALUE, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return response;
}
