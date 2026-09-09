import { NextResponse } from "next/server";
import {
  CIA_COOKIE,
  OLD_CIA_COOKIES,
  createCiaCookieValue,
  passwordsMatch,
} from "@/lib/cia-gate";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  }

  let password = "";

  try {
    const body = (await request.json()) as { password?: unknown };
    password = typeof body.password === "string" ? body.password : "";
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const expectedPassword = process.env.CIA_PASSWORD?.trim();
  if (!expectedPassword) {
    return NextResponse.json(
      { error: "Secrets access is not configured." },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  if (!(await passwordsMatch(password.trim(), expectedPassword))) {
    return NextResponse.json({ error: "Wrong password." }, { status: 401 });
  }

  const response = NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } },
  );
  response.cookies.set(CIA_COOKIE, await createCiaCookieValue(expectedPassword), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
  });
  for (const oldCookie of OLD_CIA_COOKIES) {
    response.cookies.set(oldCookie, "", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: 0,
    });
  }
  return response;
}
