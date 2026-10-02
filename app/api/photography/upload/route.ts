import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isAdminUser } from "@/lib/admin";
import {
  FRAME_CONTENT_TYPES,
  FRAME_MAX_BYTES,
  getRollById,
} from "@/lib/photography";

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

function parsePayload(value: string | null) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as { rollId?: unknown };
    if (
      typeof parsed?.rollId === "string" &&
      /^[A-Za-z0-9-]{8,80}$/.test(parsed.rollId)
    ) {
      return { rollId: parsed.rollId };
    }
  } catch {
    return null;
  }
  return null;
}

export async function POST(request: Request) {
  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (body.type !== "blob.upload-completed" && !validOrigin(request)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 403 });
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const user = await currentUser();
        if (!isAdminUser(user)) throw new Error("Not authorized.");
        const payload = parsePayload(clientPayload);
        if (!payload) throw new Error("Invalid upload.");
        const roll = await getRollById(payload.rollId);
        if (!roll) throw new Error("Unknown roll.");
        if (!pathname.startsWith(`photography/${roll.id}/`)) {
          throw new Error("Invalid upload.");
        }
        return {
          allowedContentTypes: [...FRAME_CONTENT_TYPES],
          maximumSizeInBytes: FRAME_MAX_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ rollId: roll.id }),
        };
      },
      onUploadCompleted: async () => {
        // Frame rows are created by a follow-up POST from the client so the
        // browser can report the pixel dimensions it measured.
      },
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed." },
      { status: 400 },
    );
  }
}
