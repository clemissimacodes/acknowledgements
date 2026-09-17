import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { isAdminUser } from "@/lib/admin";
import { deleteMemo, getMemoById } from "@/lib/voice-memos";

export const runtime = "nodejs";

function validOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!validOrigin(request) || !isAdminUser(await currentUser())) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }
  const { id } = await params;
  if (!/^[A-Za-z0-9-]{8,80}$/.test(id)) {
    return NextResponse.json({ error: "Unknown memo." }, { status: 404 });
  }
  try {
    const existing = await getMemoById(id);
    const deleted = await deleteMemo(id);
    if (!deleted) {
      return NextResponse.json({ error: "Unknown memo." }, { status: 404 });
    }
    revalidatePath("/secrets/out-loud");
    if (existing) revalidatePath(`/secrets/out-loud/${existing.slug}`);
    revalidatePath("/controlroom");
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "The memo could not be deleted." },
      { status: 503 },
    );
  }
}
