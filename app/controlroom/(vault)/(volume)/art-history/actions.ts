"use server";

import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isAdminUser } from "@/lib/admin";
import {
  createPiece,
  deletePiece,
  getPieceById,
  importPieceImageFromUrl,
  removePieceImage,
  setPiecePublished,
  updatePiece,
} from "@/lib/art-history";

async function requireOwner() {
  const user = await currentUser();
  if (!isAdminUser(user)) throw new Error("Not authorized.");
  return user;
}

function refresh(slugs: Array<string | null | undefined> = []) {
  revalidatePath("/art-history");
  revalidatePath("/controlroom/art-history");
  revalidatePath("/controlroom");
  for (const slug of slugs) {
    if (slug) revalidatePath(`/art-history/${slug}`);
  }
}

function fields(formData: FormData) {
  return {
    artist: formData.get("artist"),
    title: formData.get("title"),
    time: formData.get("time"),
    place: formData.get("place"),
    note: formData.get("note"),
    loves: formData.get("loves"),
  };
}

export async function createPieceAction(formData: FormData) {
  await requireOwner();
  const created = await createPiece(fields(formData));
  refresh();
  redirect(`/controlroom/art-history#${created.id}`);
}

export async function updatePieceAction(formData: FormData) {
  await requireOwner();
  const before = await getPieceById(formData.get("id"));
  const after = await updatePiece({
    ...fields(formData),
    id: formData.get("id"),
    slug: formData.get("slug"),
  });
  refresh([before?.slug, after.slug]);
}

export async function publishPieceAction(formData: FormData) {
  await requireOwner();
  const slug = await setPiecePublished(
    formData.get("id"),
    formData.get("published") === "true",
  );
  refresh([slug]);
}

export async function deletePieceAction(formData: FormData) {
  await requireOwner();
  const slug = await deletePiece(formData.get("id"));
  refresh([slug]);
}

export type ImportState = { error?: string; ok?: boolean };

export async function importImageAction(
  _previous: ImportState,
  formData: FormData,
): Promise<ImportState> {
  await requireOwner();
  try {
    await importPieceImageFromUrl(formData.get("id"), formData.get("source"));
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "The image could not be imported.",
    };
  }
  const piece = await getPieceById(formData.get("id"));
  refresh([piece?.slug]);
  return { ok: true };
}

export async function removeImageAction(formData: FormData) {
  await requireOwner();
  await removePieceImage(formData.get("id"));
  const piece = await getPieceById(formData.get("id"));
  refresh([piece?.slug]);
}
