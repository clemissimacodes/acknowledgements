import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { isAdminUser } from "@/lib/admin";
import { getPieceById, setPieceImage } from "@/lib/art-history";

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
    pieceId?: unknown;
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
    await setPieceImage({
      id: payload.pieceId,
      url: payload.url,
      pathname: payload.pathname,
      width: payload.width,
      height: payload.height,
    });
    const piece = await getPieceById(payload.pieceId);
    revalidatePath("/art-history");
    revalidatePath("/controlroom/art-history");
    if (piece) revalidatePath(`/art-history/${piece.slug}`);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "The image could not be saved.",
      },
      { status: 400 },
    );
  }
}
