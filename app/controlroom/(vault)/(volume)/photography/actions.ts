"use server";

import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { isAdminUser } from "@/lib/admin";
import {
  createRoll,
  deleteFrame,
  deleteRoll,
  getRollById,
  moveFrame,
  setRollCover,
  setRollPublished,
  updateFrameCaption,
  updateRoll,
} from "@/lib/photography";

async function requireOwner() {
  const user = await currentUser();
  if (!isAdminUser(user)) throw new Error("Not authorized.");
  return user;
}

function refresh(slugs: Array<string | null | undefined> = []) {
  revalidatePath("/photography");
  revalidatePath("/controlroom/photography");
  revalidatePath("/controlroom");
  for (const slug of slugs) {
    if (slug) revalidatePath(`/photography/${slug}`);
  }
}

export async function createRollAction(formData: FormData) {
  await requireOwner();
  await createRoll({
    title: formData.get("title"),
    note: formData.get("note"),
    when: formData.get("when"),
  });
  refresh();
}

export async function updateRollAction(formData: FormData) {
  await requireOwner();
  const before = await getRollById(formData.get("id"));
  const after = await updateRoll({
    id: formData.get("id"),
    title: formData.get("title"),
    note: formData.get("note"),
    when: formData.get("when"),
    slug: formData.get("slug"),
  });
  refresh([before?.slug, after.slug]);
}

export async function publishRollAction(formData: FormData) {
  await requireOwner();
  const slug = await setRollPublished(
    formData.get("id"),
    formData.get("published") === "true",
  );
  refresh([slug]);
}

export async function deleteRollAction(formData: FormData) {
  await requireOwner();
  const slug = await deleteRoll(formData.get("id"));
  refresh([slug]);
}

async function rollSlugForFrame(rollId: FormDataEntryValue | null) {
  const roll = await getRollById(rollId).catch(() => null);
  return roll?.slug ?? null;
}

export async function captionFrameAction(formData: FormData) {
  await requireOwner();
  await updateFrameCaption(formData.get("id"), formData.get("caption"));
  refresh([await rollSlugForFrame(formData.get("rollId"))]);
}

export async function coverFrameAction(formData: FormData) {
  await requireOwner();
  await setRollCover(formData.get("rollId"), formData.get("id"));
  refresh([await rollSlugForFrame(formData.get("rollId"))]);
}

export async function moveFrameAction(formData: FormData) {
  await requireOwner();
  await moveFrame(
    formData.get("id"),
    formData.get("direction") === "up" ? "up" : "down",
  );
  refresh([await rollSlugForFrame(formData.get("rollId"))]);
}

export async function deleteFrameAction(formData: FormData) {
  await requireOwner();
  await deleteFrame(formData.get("id"));
  refresh([await rollSlugForFrame(formData.get("rollId"))]);
}
