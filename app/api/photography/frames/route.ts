import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { isAdminUser } from "@/lib/admin";
import { addFrame, getRollById } from "@/lib/photography";

export const runtime = "nodejs";

function validOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!validOrigin(request)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 403 });
  }
  const user = await currentUser();
  if (!isAdminUser(user)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  let payload: {
    rollId?: unknown;
    url?: unknown;
    pathname?: unknown;
    width?: unknown;
    height?: unknown;
  };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    const frame = await addFrame({
      rollId: payload.rollId,
      url: payload.url,
      pathname: payload.pathname,
      width: payload.width,
      height: payload.height,
    });
    const roll = await getRollById(payload.rollId);
    revalidatePath("/photography");
    revalidatePath("/controlroom/photography");
    if (roll) revalidatePath(`/photography/${roll.slug}`);
    return NextResponse.json({ frame });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "The frame could not be saved.",
      },
      { status: 400 },
    );
  }
}
