import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ACK_COOKIE, hasAcknowledgementsCookie } from "@/lib/ack-gate";

export function middleware(request: NextRequest) {
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
  matcher: ["/acknowledgements", "/acknowledgements/:path*"],
};
