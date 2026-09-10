import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isAdminUser } from "@/lib/admin";
import { recordVisit, removeVisitsFromRequest } from "@/lib/visits";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) {
        return NextResponse.json({ ok: false }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ ok: false }, { status: 403 });
    }
  }

  const user = await currentUser();
  if (isAdminUser(user)) {
    try {
      await removeVisitsFromRequest(request);
    } catch {
      // Analytics cleanup should never interfere with the site.
    }
    return NextResponse.json({ ok: true });
  }

  let payload: { path?: unknown; referrer?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  try {
    await recordVisit(request, payload);
  } catch {
    // Analytics should never interfere with the visitor's page.
  }
  return NextResponse.json({ ok: true });
}
