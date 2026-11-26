"use client";

import { upload } from "@vercel/blob/client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { attachFriendImage, clearFriendImageForm } from "@/app/(shop)/actions";
import { cropToSlot } from "@/lib/crop-image";
import { FRIEND_IMAGE_MAX_BYTES, IMAGE_ACCEPT, IMAGE_CONTENT_TYPES, isHeicFile } from "@/lib/friend-types";

/* Live Photos arrive as HEIC. Decode in the browser and store a JPEG. */
async function heicToJpeg(file: File): Promise<File> {
  const { heicTo } = await import("heic-to");
  const jpeg = await heicTo({ blob: file, type: "image/jpeg", quality: 0.9 });
  const name = file.name.replace(/\.hei[cf]$/i, "") || "photo";
  return new File([jpeg], `${name}.jpg`, { type: "image/jpeg", lastModified: file.lastModified });
}

type Props = {
  id: string;
  which: "hero" | "alt";
  label: string;
  hint?: string;
  currentUrl: string | null;
  /* When true, an image pasted anywhere on the page lands here. */
  pasteTarget?: boolean;
};

/* A drop zone that shows the current image. Drop, click, or paste to replace. */
export function ImageUploader({ id, which, label, hint, currentUrl, pasteTarget }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<false | "converting" | "cropping" | "uploading">(false);
  const [over, setOver] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<string | null>(null);

  const onFile = async (picked: File | undefined | null) => {
    if (!picked) return;
    let file = picked;
    if (isHeicFile(picked)) {
      setBusy("converting");
      setError("");
      try {
        file = await heicToJpeg(picked);
      } catch {
        setError("Couldn't read that HEIC. Try exporting it as JPEG.");
        setBusy(false);
        return;
      }
    }
    if (!IMAGE_CONTENT_TYPES.includes(file.type)) {
      setError("PNG, JPEG, WebP, AVIF or HEIC only.");
      setBusy(false);
      return;
    }
    /* Crop to the shop's frame (4:5) right here, so Blob only ever holds what the site shows. */
    setBusy("cropping");
    setError("");
    try {
      file = await cropToSlot(file, which);
    } catch {
      setError("Couldn't read that image. Try a PNG or JPEG.");
      setBusy(false);
      return;
    }
    if (file.size > FRIEND_IMAGE_MAX_BYTES) {
      setError("That image is over 12 MB even after cropping.");
      setBusy(false);
      return;
    }
    setBusy("uploading");
    const local = URL.createObjectURL(file);
    setPreview(local);
    try {
      const ext = (file.name.split(".").pop() || file.type.split("/")[1] || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
      const blob = await upload(`friends-and-family/${id}/${which}.${ext}`, file, {
        access: "public",
        handleUploadUrl: "/api/friends/upload",
        contentType: file.type || "image/png",
      });
      await attachFriendImage({ id, which, url: blob.url, pathname: blob.pathname });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
      setPreview(null);
    } finally {
      setBusy(false);
      URL.revokeObjectURL(local);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  /* Server image arrived: drop the local preview. */
  useEffect(() => setPreview(null), [currentUrl]);

  useEffect(() => {
    if (!pasteTarget) return;
    const onPaste = (event: ClipboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA)$/.test(target.tagName)) return;
      const file = Array.from(event.clipboardData?.files ?? []).find((f) => f.type.startsWith("image/"));
      if (file) {
        event.preventDefault();
        void onFile(file);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pasteTarget, id, which]);

  const shown = preview ?? currentUrl;

  return (
    <div className="admin-drop-wrap">
      <div
        className={`admin-drop${over ? " is-over" : ""}${busy ? " is-busy" : ""}`}
        role="button"
        tabIndex={0}
        aria-label={label}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
          if (!over) setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setOver(false);
          const file =
            Array.from(event.dataTransfer.files).find((f) => f.type.startsWith("image/")) ?? event.dataTransfer.files[0];
          void onFile(file);
        }}
      >
        {shown ? <img src={shown} alt="" /> : <span className="admin-drop-empty">Drop image</span>}
        <span className="admin-drop-label">
          <strong>{busy === "converting" ? "Converting…" : busy === "cropping" ? "Cropping to 4:5…" : busy ? "Uploading…" : label}</strong>
          {hint ? <small>{hint}</small> : null}
          <small>{shown ? "Drop, click or paste to replace" : "Drop, click or paste"}</small>
        </span>
        <input
          ref={inputRef}
          type="file"
          accept={IMAGE_ACCEPT}
          disabled={Boolean(busy)}
          hidden
          onChange={(event) => void onFile(event.target.files?.[0])}
        />
      </div>
      {error ? <em className="admin-drop-error">{error}</em> : null}
      {currentUrl && !busy ? (
        <form action={clearFriendImageForm} className="admin-drop-remove">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="which" value={which} />
          <button type="submit">Remove</button>
        </form>
      ) : null}
    </div>
  );
}
