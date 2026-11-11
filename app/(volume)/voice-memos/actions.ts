"use server";

import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { isAdminUser } from "@/lib/admin";
import {
  createRecording,
  deleteNote,
  deleteReply,
  destroyRecording,
  restoreRecording,
  toggleFavorite,
  trashRecording,
  updateRecording,
} from "@/lib/recordings";

async function requireOwner() {
  const user = await currentUser();
  if (!isAdminUser(user)) throw new Error("Not authorized.");
}

function refresh() {
  revalidatePath("/voice-memos");
  revalidatePath("/voice-memos/[slug]", "page");
  revalidatePath("/controlroom/voice-memos");
  revalidatePath("/controlroom");
}

export async function publishRecording(input: {
  title: string;
  folder: string;
  durationMs: number;
  url: string;
  pathname: string;
  peaks: number[] | null;
  recordedAt?: string;
}) {
  await requireOwner();
  const recording = await createRecording(input);
  refresh();
  return recording;
}

export async function setFavorite(id: string) {
  await requireOwner();
  const favorite = await toggleFavorite(id);
  refresh();
  return favorite;
}

export async function renameRecording(formData: FormData) {
  await requireOwner();
  await updateRecording(formData.get("id"), {
    title: formData.get("title"),
    folder: formData.get("folder"),
    recordedAt: formData.get("recordedAt"),
  });
  refresh();
}

export async function toggleFavoriteForm(formData: FormData) {
  await requireOwner();
  await toggleFavorite(formData.get("id"));
  refresh();
}

export async function moveToTrash(id: string) {
  await requireOwner();
  await trashRecording(id);
  refresh();
}

export async function moveToTrashForm(formData: FormData) {
  await requireOwner();
  await trashRecording(formData.get("id"));
  refresh();
}

export async function restoreForm(formData: FormData) {
  await requireOwner();
  await restoreRecording(formData.get("id"));
  refresh();
}

export async function destroyForm(formData: FormData) {
  await requireOwner();
  await destroyRecording(formData.get("id"));
  refresh();
}

export async function removeNote(id: string) {
  await requireOwner();
  await deleteNote(id);
  refresh();
}

export async function removeReply(id: string) {
  await requireOwner();
  await deleteReply(id);
  refresh();
}

export async function removeNoteForm(formData: FormData) {
  await removeNote(String(formData.get("id") ?? ""));
}

export async function removeReplyForm(formData: FormData) {
  await removeReply(String(formData.get("id") ?? ""));
}
