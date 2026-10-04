"use client";

import { upload } from "@vercel/blob/client";
import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";
import {
  importImageAction,
  type ImportState,
} from "@/app/controlroom/(vault)/(volume)/art-history/actions";

const LONG_EDGE = 2600;
const QUALITY = 0.88;

async function decode(file: File) {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return await createImageBitmap(file);
  }
}

// Downscale large files in the browser; keep PNG/WebP that already fit.
async function prepare(file: File) {
  let bitmap: ImageBitmap;
  try {
    bitmap = await decode(file);
  } catch {
    throw new Error(`${file.name} could not be read. Export it as JPEG first.`);
  }
  const scale = Math.min(1, LONG_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const keep =
    scale === 1 && ["image/jpeg", "image/png", "image/webp"].includes(file.type);
  if (keep) {
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
  const base = file.name.replace(/\.[^.]+$/, "") || "piece";
  return {
    file: new File([blob], `${base}.jpg`, { type: "image/jpeg" }),
    width,
    height,
  };
}

export function ArtImageUploader({
  pieceId,
  hasImage,
}: {
  pieceId: string;
  hasImage: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [importState, importFormAction, importing] = useActionState<
    ImportState,
    FormData
  >(importImageAction, {});

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    setError("");
    setMessage("Developing…");
    try {
      const prepared = await prepare(file);
      const extension =
        prepared.file.type === "image/png"
          ? "png"
          : prepared.file.type === "image/webp"
            ? "webp"
            : "jpg";
      const uploaded = await upload(
        `art-history/${pieceId}/${crypto.randomUUID()}.${extension}`,
        prepared.file,
        {
          access: "public",
          handleUploadUrl: "/api/art-history/upload",
          clientPayload: JSON.stringify({ pieceId }),
        },
      );
      const response = await fetch("/api/art-history/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pieceId,
          url: uploaded.url,
          pathname: uploaded.pathname,
          width: prepared.width,
          height: prepared.height,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "The image could not be saved.");
      setMessage("Image saved.");
      router.refresh();
    } catch (caught) {
      setMessage("");
      setError(caught instanceof Error ? caught.message : "The upload did not finish.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-roll-uploader admin-art-uploader">
      <label className={`admin-roll-drop${busy ? " is-busy" : ""}`}>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          disabled={busy || importing}
          onChange={(event) => void onFile(event)}
        />
        <span>
          {busy ? message : hasImage ? "Replace image from a file" : "Upload an image file"}
        </span>
      </label>
      <form action={importFormAction} className="admin-art-import">
        <input type="hidden" name="id" value={pieceId} />
        <input
          type="url"
          name="source"
          required
          placeholder="…or paste a direct image URL (Wikipedia, museum open access)"
          disabled={busy || importing}
        />
        <button type="submit" disabled={busy || importing}>
          {importing ? "Fetching…" : "Import"}
        </button>
      </form>
      {!busy && message ? <p className="admin-muted">{message}</p> : null}
      {error ? <p className="admin-error">{error}</p> : null}
      {importState.error ? <p className="admin-error">{importState.error}</p> : null}
    </div>
  );
}
