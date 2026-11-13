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
import { markNotificationsSeen } from "@/lib/notifications";
import { clearSecretsAttempts } from "@/lib/secrets-attempts";
import {
  clearCurrentLocation,
  createTrackerToken,
  deleteTravelPlace,
  goDark,
  revokeTrackerToken,
  saveTravelPlace,
  setTravelPlaceStatus,
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

export async function markNotificationsAsSeen(formData: FormData) {
  await requireOwner();
  await markNotificationsSeen(
    formData.get("through"),
    formData.get("counters"),
  );
  refreshControlRoom();
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
  revalidatePath("/blow-on-a-fat-dandelion");
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
  if (kind === "wish") revalidatePath("/blow-on-a-fat-dandelion");
}

export async function removeAllVisits() {
  await requireOwner();
  await clearVisitRecords();
  refreshControlRoom();
}

function refreshRadar() {
  revalidatePath("/controlroom");
  revalidatePath("/controlroom/radar");
}

export async function createShortcutToken(formData: FormData) {
  await requireOwner();
  const result = await createTrackerToken(formData.get("label"));
  refreshRadar();
  return result;
}

export async function revokeShortcutToken(formData: FormData) {
  await requireOwner();
  await revokeTrackerToken(formData.get("id"));
  refreshRadar();
}

export async function removeRadar() {
  await requireOwner();
  await clearCurrentLocation();
  refreshRadar();
}

export async function emergencyGoDark() {
  await requireOwner();
  await goDark();
  refreshRadar();
}

export async function savePlace(formData: FormData) {
  await requireOwner();
  await saveTravelPlace({
    id: formData.get("id") || undefined,
    city: formData.get("city"),
    country: formData.get("country"),
    firstYear: formData.get("firstYear"),
    lastYear: formData.get("lastYear"),
    confidence: formData.get("confidence"),
    evidenceCategory: formData.get("evidenceCategory"),
  });
  refreshRadar();
}

export async function changePlaceStatus(formData: FormData) {
  await requireOwner();
  await setTravelPlaceStatus(formData.get("id"), formData.get("status"));
  refreshRadar();
}

export async function removePlace(formData: FormData) {
  await requireOwner();
  await deleteTravelPlace(formData.get("id"));
  refreshRadar();
}

export async function clearSecretsAttemptLog() {
  await requireOwner();
  await clearSecretsAttempts();
  refreshControlRoom();
}
