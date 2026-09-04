import { NextResponse } from "next/server";
import {
  ACK_COOKIE,
  ACK_COOKIE_VALUE,
  checkAcknowledgementsPassword,
} from "@/lib/ack-gate";

export async function POST(request: Request) {
  const { password } = (await request.json()) as { password?: string };
  if (!checkAcknowledgementsPassword(String(password ?? ""))) {
    return NextResponse.json({ error: "Wrong password." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ACK_COOKIE, ACK_COOKIE_VALUE, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
