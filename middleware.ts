import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// /secrets gates itself (see app/(volume)/secrets/page.tsx). Everything that
// used to sit behind that password now lives in the control room vault, which
// needs a Clerk session here and the configured owner in the vault layout.
export default clerkMiddleware(async (auth, request) => {
  const pathname = request.nextUrl.pathname;
  const isControlRoom =
    pathname === "/controlroom" ||
    (pathname.startsWith("/controlroom/") &&
      pathname !== "/controlroom/login");
  const isOwnerApi =
    pathname === "/api/shop/checkout" || pathname === "/api/sunday-posties";

  if (isControlRoom || isOwnerApi) {
    const { userId } = await auth();
    if (!userId) {
      if (isOwnerApi) {
        return NextResponse.json({ error: "Not authorized." }, { status: 401 });
      }
      return NextResponse.redirect(new URL("/controlroom/login", request.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!api/radar/shortcut(?:/|$)|_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
  ],
};
