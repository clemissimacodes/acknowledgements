"use server";

import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { clearRadar, isAdminUser, setRadar } from "@/lib/admin";

async function requireOwner() {
  const user = await currentUser();
  if (!isAdminUser(user)) throw new Error("Not authorized.");
}

export async function updateRadar(formData: FormData) {
  await requireOwner();
  await setRadar(formData.get("area"), formData.get("note"));
  revalidatePath("/admin");
  revalidatePath("/radar");
}

export async function removeRadar() {
  await requireOwner();
  await clearRadar();
  revalidatePath("/admin");
  revalidatePath("/radar");
}
