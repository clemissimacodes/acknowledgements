import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isAdminUser } from "@/lib/admin";
import {
  ART_CONTENT_TYPES,
  ART_IMAGE_MAX_BYTES,
  getPieceById,
} from "@/lib/art-history";

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
    const parsed = JSON.parse(value) as { pieceId?: unknown };
    if (
      typeof parsed?.pieceId === "string" &&
      /^[A-Za-z0-9-]{8,80}$/.test(parsed.pieceId)
    ) {
      return { pieceId: parsed.pieceId };
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
        const piece = await getPieceById(payload.pieceId);
        if (!piece) throw new Error("Unknown piece.");
        if (!pathname.startsWith(`art-history/${piece.id}/`)) {
          throw new Error("Invalid upload.");
        }
        return {
          allowedContentTypes: [...ART_CONTENT_TYPES],
          maximumSizeInBytes: ART_IMAGE_MAX_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ pieceId: piece.id }),
        };
      },
      onUploadCompleted: async () => {
        // The record is updated by a follow-up POST from the client so the
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
