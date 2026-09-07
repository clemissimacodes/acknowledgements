import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { ACK_COOKIE, hasAcknowledgementsCookie } from "@/lib/ack-gate";
import { CIA_COOKIE, hasCiaCookie } from "@/lib/cia-gate";

export default clerkMiddleware(async (auth, request) => {
  const pathname = request.nextUrl.pathname;
  const isAdmin =
    pathname === "/controlroom" ||
    (pathname.startsWith("/controlroom/") &&
      pathname !== "/controlroom/login");
  const isPoetry = pathname === "/poetry" || pathname.startsWith("/poetry/");
  const isAcknowledgements =
    pathname === "/acknowledgements" ||
    pathname.startsWith("/acknowledgements/");
  const isCia = pathname === "/cia" || pathname.startsWith("/cia/");
  const isCiaUnlock = pathname === "/cia/unlock";

  if (isAdmin) {
    const { userId } = await auth();
    if (!userId) {
      const login = new URL("/controlroom/login", request.url);
      return NextResponse.redirect(login);
    }
  }

  if (isCia && !isCiaUnlock) {
    if (hasCiaCookie(request.cookies.get(CIA_COOKIE)?.value)) {
      return NextResponse.next();
    }

    const unlock = new URL("/cia/unlock", request.url);
    unlock.searchParams.set(
      "next",
      request.nextUrl.pathname + request.nextUrl.search,
    );
    return NextResponse.redirect(unlock);
  }

  if (!isPoetry && !isAcknowledgements) {
    return NextResponse.next();
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
