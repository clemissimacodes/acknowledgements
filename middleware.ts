import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { CIA_COOKIE, hasCiaCookie } from "@/lib/cia-gate";

export default clerkMiddleware(async (auth, request) => {
  const pathname = request.nextUrl.pathname;
  const isAdmin =
    pathname === "/controlroom" ||
    (pathname.startsWith("/controlroom/") &&
      pathname !== "/controlroom/login");
  const isAcknowledgements =
    pathname === "/acknowledgements" ||
    pathname.startsWith("/acknowledgements/");
  const isSecrets =
    pathname === "/secrets" || pathname.startsWith("/secrets/");
  const isCia = pathname === "/cia" || pathname.startsWith("/cia/");
  const isSecretsUnlock =
    pathname === "/secrets/unlock" || pathname === "/cia/unlock";
  const isPasswordProtected = isSecrets || isCia || isAcknowledgements;

  if (isAdmin) {
    const { userId } = await auth();
    if (!userId) {
      const login = new URL("/controlroom/login", request.url);
      return NextResponse.redirect(login);
    }
  }

  if (isPasswordProtected && !isSecretsUnlock) {
    if (hasCiaCookie(request.cookies.get(CIA_COOKIE)?.value)) {
      return NextResponse.next();
    }

    const unlock = new URL("/secrets/unlock", request.url);
    unlock.searchParams.set(
      "next",
      request.nextUrl.pathname + request.nextUrl.search,
    );
    return NextResponse.redirect(unlock);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
