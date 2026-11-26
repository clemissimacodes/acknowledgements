import { NextResponse } from "next/server";
import { sweepRubbishWishes } from "@/lib/dandelion";

export const dynamic = "force-dynamic";

/**
 * Weekly tidy of the dandelion field. Vercel Cron calls this on the
 * schedule in vercel.json with `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const sweep = await sweepRubbishWishes();
    console.log(
      `dandelion sweep: cleared ${sweep.swept.length} wish(es) from ${sweep.store}`,
      sweep.swept.map((wish) => wish.body),
    );
    return NextResponse.json({
      ok: true,
      store: sweep.store,
      cleared: sweep.swept.length,
      wishes: sweep.swept.map((wish) => wish.body),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "sweep failed";
    console.error("dandelion sweep failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
