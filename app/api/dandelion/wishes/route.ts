import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  DANDELION_COOKIE,
  DANDELION_COOKIE_VALUE,
  DANDELION_COUNT_COOKIE,
  DANDELION_MAX_WISHES,
  DANDELION_VISIBLE,
  addWish,
  cleanExtras,
  cleanWish,
  hasBlown,
  listWishes,
  wishCount,
} from "@/lib/dandelion";
import { WIND_MISS } from "@/lib/dandelion-types";

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  };
}

function openField(response: NextResponse, count: number) {
  response.cookies.set(DANDELION_COOKIE, DANDELION_COOKIE_VALUE, cookieOptions());
  response.cookies.set(DANDELION_COUNT_COOKIE, String(count), cookieOptions());
}

export async function GET() {
  const jar = await cookies();
  const opened = hasBlown(jar.get(DANDELION_COOKIE)?.value);
  if (!opened) {
    return NextResponse.json({ opened: false, wishes: [] });
  }
  return NextResponse.json({
    opened: true,
    wishes: await listWishes(),
  });
}

export async function POST(request: Request) {
  const payload = (await request.json()) as {
    wish?: string;
    location?: string;
    gender?: string;
    age?: string;
  };
  const wish = cleanWish(String(payload.wish ?? ""));
  if (!wish) {
    return NextResponse.json({ error: "Whisper a little more." }, { status: 400 });
  }
  const extras = cleanExtras(payload);
  if (!extras.location || !extras.gender || !extras.age) {
    return NextResponse.json(
      { error: "Drop a pin, then choose your gender and age." },
      { status: 400 },
    );
  }

  const jar = await cookies();
  const count = wishCount(jar.get(DANDELION_COUNT_COOKIE)?.value);
  if (count >= DANDELION_MAX_WISHES) {
    return NextResponse.json(
      { error: "The dandelion is tired." },
      { status: 429 },
    );
  }

  try {
    const created = await addWish(wish, extras);
    let wishes = await listWishes();
    if (!wishes.some((item) => item.id === created.id)) {
      wishes = [created, ...wishes].slice(0, DANDELION_VISIBLE);
    }
    const response = NextResponse.json({ opened: true, wishes });
    openField(response, count + 1);
    return response;
  } catch {
    return NextResponse.json({ error: WIND_MISS }, { status: 500 });
  }
}
