"use server";

import { currentUser } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { isAdminUser } from "@/lib/admin";
import {
  answerAskQuestion,
  deleteAskQuestion,
  submitAskQuestion,
} from "@/lib/ask";

export type AskFormState = {
  status: "idle" | "sent" | "error";
  message: string;
  id?: string;
};

function refresh(ids: Array<string | null | undefined> = []) {
  revalidatePath("/ask");
  revalidatePath("/controlroom/ask");
  revalidatePath("/controlroom");
  revalidatePath("/admin");
  for (const id of ids) if (id) revalidatePath(`/ask/${id}`);
}

export async function sendAskQuestion(
  _previous: AskFormState,
  formData: FormData,
): Promise<AskFormState> {
  try {
    const requestHeaders = await headers();
    const forwarded = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
    const id = await submitAskQuestion({
      body: formData.get("body"),
      website: formData.get("website"),
      ip: requestHeaders.get("x-real-ip")?.trim() || forwarded || "",
    });
    refresh();
    return {
      status: "sent",
      message: "sent. i usually respond day of.",
      id: id ?? undefined,
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Please try again.",
    };
  }
}

async function requireOwner() {
  const user = await currentUser();
  if (!isAdminUser(user)) throw new Error("Not authorized.");
}

export async function replyToAskQuestion(formData: FormData) {
  await requireOwner();
  const id = String(formData.get("id") ?? "");
  await answerAskQuestion(id, formData.get("answer"));
  refresh([id]);
}

export async function removeAskQuestion(formData: FormData) {
  await requireOwner();
  const id = String(formData.get("id") ?? "");
  await deleteAskQuestion(id);
  refresh([id]);
}
