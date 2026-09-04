import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { ACK_COOKIE, hasAcknowledgementsCookie } from "@/lib/ack-gate";
import {
  hasIntroductionCookie,
  INTRO_COOKIE,
} from "@/lib/intro-gate";

export default clerkMiddleware(async (auth, request) => {
  const pathname = request.nextUrl.pathname;
  const isAdmin =
    pathname === "/admin" ||
    (pathname.startsWith("/admin/") && pathname !== "/admin/login");
  const isPoetry = pathname === "/poetry" || pathname.startsWith("/poetry/");
  const isAcknowledgements =
    pathname === "/acknowledgements" ||
    pathname.startsWith("/acknowledgements/");

  if (isAdmin) {
    const { userId } = await auth();
    if (!userId) {
      const login = new URL("/admin/login", request.url);
      return NextResponse.redirect(login);
    }
  }

  if (!isPoetry && !isAcknowledgements) {
    return NextResponse.next();
  }

  if (!hasIntroductionCookie(request.cookies.get(INTRO_COOKIE)?.value)) {
    const introduction = new URL("/introduce", request.url);
    introduction.searchParams.set(
      "next",
      request.nextUrl.pathname + request.nextUrl.search,
    );
    return NextResponse.redirect(introduction);
  }

  if (!isAcknowledgements) {
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
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
