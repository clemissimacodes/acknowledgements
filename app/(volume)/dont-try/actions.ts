"use server";

import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { isAdminUser } from "@/lib/admin";
import {
  saveDontTryEntry,
  setDontTryPublished,
} from "@/lib/dont-try";

async function requireOwner() {
  const user = await currentUser();
  if (!user || !isAdminUser(user)) throw new Error("Not authorized.");
}

function refresh() {
  revalidatePath("/secrets/dont-try");
}

function entryFromForm(formData: FormData) {
  return {
    day: formData.get("day"),
    status: formData.get("status"),
    studyPoem: formData.get("studyPoem"),
    studyAuthor: formData.get("studyAuthor"),
    studyNotes: formData.get("studyNotes"),
    steps: formData.get("steps"),
    eatComplete: formData.get("eatComplete"),
    eatNotes: formData.get("eatNotes"),
    eatPhoto: formData.get("eatPhoto"),
    act: formData.get("act"),
    actDifficulty: formData.get("actDifficulty"),
    workout: formData.get("workout"),
    durationMinutes: formData.get("durationMinutes"),
    plankSeconds: formData.get("plankSeconds"),
    trainNotes: formData.get("trainNotes"),
    verdict: formData.get("verdict"),
    setsAbandoned: formData.get("setsAbandoned"),
    abandonedNotes: formData.get("abandonedNotes"),
  };
}

export async function saveDontTryDay(formData: FormData) {
  await requireOwner();
  await saveDontTryEntry(entryFromForm(formData));
  refresh();
}

export async function saveAndPublishDontTryDay(formData: FormData) {
  await requireOwner();
  const entry = entryFromForm(formData);
  await saveDontTryEntry(entry);
  await setDontTryPublished(entry.day, true);
  refresh();
}

export async function publishDontTryDay(formData: FormData) {
  await requireOwner();
  await setDontTryPublished(formData.get("day"), true);
  refresh();
}

export async function unpublishDontTryDay(formData: FormData) {
  await requireOwner();
  await setDontTryPublished(formData.get("day"), false);
  refresh();
}
