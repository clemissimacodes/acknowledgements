import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isAdminUser } from "@/lib/admin";
import { FRIEND_IMAGE_MAX_BYTES, IMAGE_CONTENT_TYPES } from "@/lib/friend-types";
import { FRIEND_BLOB_PREFIX } from "@/lib/friends";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const user = await currentUser();
        if (!isAdminUser(user)) throw new Error("Not authorized.");
        if (!pathname.startsWith(FRIEND_BLOB_PREFIX)) throw new Error("Bad path.");
        return {
          allowedContentTypes: IMAGE_CONTENT_TYPES,
          maximumSizeInBytes: FRIEND_IMAGE_MAX_BYTES,
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async () => undefined,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed." },
      { status: 400 },
    );
  }
}
