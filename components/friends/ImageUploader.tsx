"use client";

import { upload } from "@vercel/blob/client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { attachFriendImage } from "@/app/(shop)/actions";
import { FRIEND_IMAGE_MAX_BYTES } from "@/lib/friend-types";

type Props = { id: string; which: "hero" | "alt"; label: string };

export function ImageUploader({ id, which, label }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > FRIEND_IMAGE_MAX_BYTES) {
      setError("That image is over 12 MB.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
      const blob = await upload(`friends-and-family/${id}/${which}.${ext}`, file, {
        access: "public",
        handleUploadUrl: "/api/friends/upload",
        contentType: file.type || "image/png",
      });
      await attachFriendImage({ id, which, url: blob.url, pathname: blob.pathname });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <label className="admin-friend-upload">
      <span>{busy ? "Uploading…" : label}</span>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/avif"
        disabled={busy}
        onChange={(event) => void onFile(event.target.files?.[0])}
      />
      {error ? <em>{error}</em> : null}
    </label>
  );
}
