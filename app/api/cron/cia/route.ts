import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runCiaDiscovery } from "@/lib/cia";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!secret || !supplied) return false;
  const expectedBytes = Buffer.from(secret);
  const suppliedBytes = Buffer.from(supplied);
  return (
    expectedBytes.length === suppliedBytes.length &&
    timingSafeEqual(expectedBytes, suppliedBytes)
  );
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await runCiaDiscovery();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("CIA discovery run failed.", error);
    return NextResponse.json(
      { error: "Discovery run failed safely; nothing was published." },
      { status: 500 },
    );
  }
}
