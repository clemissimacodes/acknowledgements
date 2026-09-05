"use server";

import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import {
  clearRadar,
  clearVisitRecords,
  deleteAdminRecord,
  isAdminUser,
  setRadar,
  setRadarFromCoordinates,
  setPostiesSent,
  updateIntroductionRecord,
  updatePostiesRecord,
  updateWishRecord,
} from "@/lib/admin";

async function requireOwner() {
  const user = await currentUser();
  if (!isAdminUser(user)) throw new Error("Not authorized.");
}

function refreshControlRoom() {
  revalidatePath("/controlroom");
}

export async function savePostiesRecord(formData: FormData) {
  await requireOwner();
  await updatePostiesRecord({
    id: formData.get("id"),
    name: formData.get("name"),
    platform: formData.get("platform"),
    socialUrl: formData.get("socialUrl"),
    mailingAddress: formData.get("mailingAddress"),
  });
  refreshControlRoom();
}

export async function togglePostiesSent(formData: FormData) {
  await requireOwner();
  await setPostiesSent(formData.get("id"), formData.get("sent") !== "true");
  refreshControlRoom();
}

export async function saveWishRecord(formData: FormData) {
  await requireOwner();
  await updateWishRecord({
    id: formData.get("id"),
    body: formData.get("body"),
    location: formData.get("location"),
    gender: formData.get("gender"),
    age: formData.get("age"),
  });
  refreshControlRoom();
  revalidatePath("/dandelion");
}

export async function saveIntroductionRecord(formData: FormData) {
  await requireOwner();
  await updateIntroductionRecord(
    formData.get("id"),
    formData.get("tinyThing"),
  );
  refreshControlRoom();
}

export async function removeRecord(formData: FormData) {
  await requireOwner();
  const kind = formData.get("kind");
  if (
    kind !== "posties" &&
    kind !== "wish" &&
    kind !== "introduction" &&
    kind !== "visit"
  ) {
    throw new Error("Invalid record type.");
  }
  await deleteAdminRecord(kind, formData.get("id"));
  refreshControlRoom();
  if (kind === "wish") revalidatePath("/dandelion");
}

export async function removeAllVisits() {
  await requireOwner();
  await clearVisitRecords();
  refreshControlRoom();
}

export async function updateRadar(formData: FormData) {
  await requireOwner();
  await setRadar(formData.get("area"), formData.get("note"));
  revalidatePath("/controlroom");
  revalidatePath("/radar");
}

export async function updateRadarFromDevice(input: {
  latitude: number;
  longitude: number;
  note: string;
}) {
  await requireOwner();
  try {
    const area = await setRadarFromCoordinates(
      input.latitude,
      input.longitude,
      input.note,
    );
    revalidatePath("/controlroom");
    revalidatePath("/radar");
    return { ok: true as const, area };
  } catch (error) {
    return {
      ok: false as const,
      error:
        error instanceof Error
          ? error.message
          : "The radar could not catch that signal.",
    };
  }
}

export async function removeRadar() {
  await requireOwner();
  await clearRadar();
  revalidatePath("/controlroom");
  revalidatePath("/radar");
}
