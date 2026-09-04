"use server";

import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import {
  clearRadar,
  isAdminUser,
  setRadar,
  setRadarFromCoordinates,
} from "@/lib/admin";

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
    revalidatePath("/admin");
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
  revalidatePath("/admin");
  revalidatePath("/radar");
}
