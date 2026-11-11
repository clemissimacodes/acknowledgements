import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isAdminUser } from "@/lib/admin";
import {
  AUDIO_CONTENT_TYPES,
  RECORDING_BLOB_PREFIX,
  REPLY_BLOB_PREFIX,
  getRecordingById,
} from "@/lib/recordings";
import { RECORDING_MAX_BYTES, REPLY_MAX_BYTES } from "@/lib/recording-types";

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

type Payload = { role: "recording" } | { role: "reply"; recordingId: string };

function parsePayload(value: string | null): Payload | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Payload;
    if (parsed?.role === "recording") return { role: "recording" };
    if (
      parsed?.role === "reply" &&
      typeof parsed.recordingId === "string" &&
      /^[A-Za-z0-9-]{8,80}$/.test(parsed.recordingId)
    ) {
      return { role: "reply", recordingId: parsed.recordingId };
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
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const payload = parsePayload(clientPayload);
        if (!payload) throw new Error("Invalid upload.");
        if (payload.role === "recording") {
          const user = await currentUser();
          if (!isAdminUser(user)) throw new Error("Not authorized.");
          if (!pathname.startsWith(RECORDING_BLOB_PREFIX)) {
            throw new Error("Invalid upload.");
          }
          return {
            allowedContentTypes: [...AUDIO_CONTENT_TYPES],
            maximumSizeInBytes: RECORDING_MAX_BYTES,
            addRandomSuffix: true,
            tokenPayload: JSON.stringify(payload),
          };
        }
        const recording = await getRecordingById(payload.recordingId);
        if (!recording || recording.deletedAt) throw new Error("Unknown recording.");
        if (!pathname.startsWith(`${REPLY_BLOB_PREFIX}${recording.id}/`)) {
          throw new Error("Invalid upload.");
        }
        return {
          allowedContentTypes: [...AUDIO_CONTENT_TYPES],
          maximumSizeInBytes: REPLY_MAX_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify(payload),
        };
      },
      onUploadCompleted: async () => {
        // Rows are written by the follow-up request from the client.
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed." },
      { status: 400 },
    );
  }
}
