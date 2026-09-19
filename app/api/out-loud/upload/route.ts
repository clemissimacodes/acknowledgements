import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isAdminUser } from "@/lib/admin";
import { isSampleMemoId } from "@/lib/out-loud-samples";
import {
  AUDIO_CONTENT_TYPES,
  MEMO_MAX_BYTES,
  VISITOR_MAX_BYTES,
  getMemoById,
} from "@/lib/voice-memos";

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

type ClientPayload =
  | { role: "memo" }
  | { role: "reply"; memoId: string };

function parsePayload(value: string | null): ClientPayload | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as ClientPayload;
    if (parsed?.role === "memo") return { role: "memo" };
    if (
      parsed?.role === "reply" &&
      typeof parsed.memoId === "string" &&
      /^[A-Za-z0-9-]{8,80}$/.test(parsed.memoId)
    ) {
      return { role: "reply", memoId: parsed.memoId };
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
        const payload = parsePayload(clientPayload);
        if (!payload) throw new Error("Invalid upload.");

        if (payload.role === "memo") {
          const user = await currentUser();
          if (!isAdminUser(user)) throw new Error("Not authorized.");
          if (!pathname.startsWith("out-loud/memos/")) {
            throw new Error("Invalid upload.");
          }
          return {
            allowedContentTypes: [...AUDIO_CONTENT_TYPES],
            maximumSizeInBytes: MEMO_MAX_BYTES,
            addRandomSuffix: true,
            tokenPayload: JSON.stringify({ role: "memo" }),
          };
        }

        if (isSampleMemoId(payload.memoId)) {
          throw new Error("Replies to this memo are not being kept yet.");
        }
        const memo = await getMemoById(payload.memoId);
        if (!memo?.published) throw new Error("Unknown memo.");
        if (!pathname.startsWith(`out-loud/replies/${memo.id}/`)) {
          throw new Error("Invalid upload.");
        }
        return {
          allowedContentTypes: [...AUDIO_CONTENT_TYPES],
          maximumSizeInBytes: VISITOR_MAX_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({
            role: "reply",
            memoId: memo.id,
          }),
        };
      },
      onUploadCompleted: async () => {
        // Records are created by a follow-up POST from the client.
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
