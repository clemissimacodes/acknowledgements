import { upload } from "@vercel/blob/client";
import { extensionForAudio } from "./record";

export type VoiceUploadRole =
  | { role: "memo" }
  | { role: "reply"; memoId: string };

export async function uploadVoiceFile(file: File, payload: VoiceUploadRole) {
  const type = file.type || `audio/${extensionForAudio("", file.name)}`;
  const normalized =
    file.type === type ? file : new File([file], file.name || `clip.${extensionForAudio(type)}`, { type });
  const ext = extensionForAudio(normalized.type, normalized.name);
  const pathname =
    payload.role === "memo"
      ? `out-loud/memos/${crypto.randomUUID()}.${ext}`
      : `out-loud/replies/${payload.memoId}/${crypto.randomUUID()}.${ext}`;

  return upload(pathname, normalized, {
    access: "public",
    handleUploadUrl: "/api/out-loud/upload",
    clientPayload: JSON.stringify(payload),
  });
}
