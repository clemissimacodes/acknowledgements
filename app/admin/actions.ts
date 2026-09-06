"use server";

import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import {
  clearVisitRecords,
  deleteAdminRecord,
  isAdminUser,
  setPostiesSent,
  updateIntroductionRecord,
  updatePostiesRecord,
  updateWishRecord,
} from "@/lib/admin";
import {
  clearCurrentLocation,
  deleteTravelPlace,
  saveTravelPlace,
  setTravelPlaceStatus,
  syncGoogleCalendar,
} from "@/lib/tracker";

async function requireOwner() {
  const user = await currentUser();
  if (!user) throw new Error("Not authorized.");
  if (!isAdminUser(user)) throw new Error("Not authorized.");
  return user;
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

export async function syncCalendarNow() {
  const user = await requireOwner();
  const result = await syncGoogleCalendar(user.id);
  revalidatePath("/controlroom");
  revalidatePath("/radar");
  return result;
}

export async function removeRadar() {
  await requireOwner();
  await clearCurrentLocation();
  revalidatePath("/controlroom");
  revalidatePath("/radar");
}

export async function savePlace(formData: FormData) {
  await requireOwner();
  await saveTravelPlace({
    id: formData.get("id") || undefined,
    city: formData.get("city"),
    country: formData.get("country"),
    firstYear: formData.get("firstYear"),
    lastYear: formData.get("lastYear"),
    status: formData.get("status"),
  });
  revalidatePath("/controlroom");
  revalidatePath("/radar");
}

export async function changePlaceStatus(formData: FormData) {
  await requireOwner();
  await setTravelPlaceStatus(formData.get("id"), formData.get("status"));
  revalidatePath("/controlroom");
  revalidatePath("/radar");
}

export async function removePlace(formData: FormData) {
  await requireOwner();
  await deleteTravelPlace(formData.get("id"));
  revalidatePath("/controlroom");
  revalidatePath("/radar");
}
