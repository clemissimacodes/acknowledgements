import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ACK_COOKIE, hasAcknowledgementsCookie } from "@/lib/ack-gate";
import {
  hasIntroductionCookie,
  INTRO_COOKIE,
} from "@/lib/intro-gate";

export function middleware(request: NextRequest) {
  if (!hasIntroductionCookie(request.cookies.get(INTRO_COOKIE)?.value)) {
    const introduction = new URL("/introduce", request.url);
    introduction.searchParams.set(
      "next",
      request.nextUrl.pathname + request.nextUrl.search,
    );
    return NextResponse.redirect(introduction);
  }

  if (!request.nextUrl.pathname.startsWith("/acknowledgements")) {
    return NextResponse.next();
  }

  if (hasAcknowledgementsCookie(request.cookies.get(ACK_COOKIE)?.value)) {
    return NextResponse.next();
  }

  const unlock = new URL("/unlock", request.url);
  unlock.searchParams.set(
    "next",
    request.nextUrl.pathname + request.nextUrl.search,
  );
  return NextResponse.redirect(unlock);
}

export const config = {
  matcher: [
    "/poetry",
    "/poetry/:path*",
    "/acknowledgements",
    "/acknowledgements/:path*",
  ],
};
