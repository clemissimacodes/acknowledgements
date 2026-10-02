"use client";

import { upload } from "@vercel/blob/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

const LONG_EDGE = 2400;
const QUALITY = 0.86;

type Prepared = { file: File; width: number; height: number };

async function decode(file: File) {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return await createImageBitmap(file);
  }
}

// Downscale in the browser so a 12 MB phone photo becomes a quick-loading
// JPEG, with EXIF rotation baked in. Falls back to the original file if the
// browser cannot decode it (rare formats), letting the server reject it.
async function prepare(file: File): Promise<Prepared> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await decode(file);
  } catch {
    throw new Error(`${file.name} could not be read. Export it as JPEG first.`);
  }
  const scale = Math.min(1, LONG_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const needsEncode =
    scale < 1 || !["image/jpeg", "image/webp"].includes(file.type);
  if (!needsEncode) {
    bitmap.close();
    return { file, width, height };
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser cannot resize images.");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", QUALITY),
  );
  if (!blob) throw new Error(`${file.name} could not be encoded.`);
  const base = file.name.replace(/\.[^.]+$/, "") || "frame";
  return {
    file: new File([blob], `${base}.jpg`, { type: "image/jpeg" }),
    width,
    height,
  };
}

export function RollUploader({
  rollId,
  remaining,
}: {
  rollId: string;
  remaining: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");

  async function onFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;
    if (files.length > remaining) {
      setError(`Only ${remaining} more ${remaining === 1 ? "frame fits" : "frames fit"} on this roll.`);
      return;
    }
    setBusy(true);
    setError("");
    let done = 0;
    try {
      for (const file of files) {
        setProgress(`Developing ${done + 1} of ${files.length}…`);
        const prepared = await prepare(file);
        const uploaded = await upload(
          `photography/${rollId}/${crypto.randomUUID()}.${
            prepared.file.type === "image/webp" ? "webp" : "jpg"
          }`,
          prepared.file,
          {
            access: "public",
            handleUploadUrl: "/api/photography/upload",
            clientPayload: JSON.stringify({ rollId }),
          },
        );
        const response = await fetch("/api/photography/frames", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rollId,
            url: uploaded.url,
            pathname: uploaded.pathname,
            width: prepared.width,
            height: prepared.height,
          }),
        });
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        if (!response.ok) {
          throw new Error(data.error ?? "The frame could not be saved.");
        }
        done += 1;
      }
      setProgress(
        done === 1 ? "1 frame added." : `${done} frames added.`,
      );
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "The upload did not finish.",
      );
      if (done) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-roll-uploader">
      <label className={`admin-roll-drop${busy ? " is-busy" : ""}`}>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          multiple
          disabled={busy || remaining <= 0}
          onChange={(event) => void onFiles(event)}
        />
        <span>
          {busy
            ? progress
            : remaining > 0
              ? `Add frames · ${remaining} left on this roll`
              : "This roll is full"}
        </span>
      </label>
      {!busy && progress ? <p className="admin-muted">{progress}</p> : null}
      {error ? <p className="admin-error">{error}</p> : null}
    </div>
  );
}
