import { NextResponse } from "next/server";
import {
  addPostiesSignup,
  cleanPostiesSignup,
  POSTIES_COOKIE,
} from "@/lib/posties";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) {
        return NextResponse.json(
          { error: "Not from this postbox." },
          { status: 403 },
        );
      }
    } catch {
      return NextResponse.json({ error: "Not from this postbox." }, { status: 403 });
    }
  }

  if (request.headers.get("cookie")?.includes(`${POSTIES_COOKIE}=yes`)) {
    return NextResponse.json(
      { error: "You are already on the posties list." },
      { status: 429 },
    );
  }

  let payload: {
    name?: unknown;
    platform?: unknown;
    social?: unknown;
    mailingAddress?: unknown;
    consent?: unknown;
    website?: unknown;
  };

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "That postie got crumpled." }, { status: 400 });
  }

  if (payload.website) {
    return NextResponse.json({ ok: true });
  }

  if (payload.consent !== true) {
    return NextResponse.json(
      { error: "Please agree to the one Sunday Posties rule." },
      { status: 400 },
    );
  }

  const signup = cleanPostiesSignup(payload);
  if (!signup) {
    return NextResponse.json(
      { error: "Please check your name, social profile, and mailing address." },
      { status: 400 },
    );
  }

  if (!(await addPostiesSignup(signup))) {
    return NextResponse.json(
      { error: "The postbox is resting. Please try again shortly." },
      { status: 503 },
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(POSTIES_COOKIE, "yes", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return response;
}
