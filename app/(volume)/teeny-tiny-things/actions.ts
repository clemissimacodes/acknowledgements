"use server";

import { currentUser } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { isAdminUser } from "@/lib/admin";
import {
  answerTeenyQuestion,
  deleteTeenyQuestion,
  submitTeenyQuestion,
} from "@/lib/teeny-questions";

export type TeenyQuestionFormState = {
  status: "idle" | "sent" | "error";
  message: string;
  submissionId?: string;
};

export async function sendTeenyQuestion(
  _previous: TeenyQuestionFormState,
  formData: FormData,
): Promise<TeenyQuestionFormState> {
  try {
    const requestHeaders = await headers();
    const forwarded = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
    await submitTeenyQuestion({
      question: formData.get("question"),
      name: formData.get("name"),
      website: formData.get("website"),
      nosePhoto: formData.get("nosePhoto"),
      noseShy: formData.get("noseShy"),
      ip: requestHeaders.get("x-real-ip")?.trim() || forwarded || "",
    });
    return {
      status: "sent",
      message: "Your tiny thing is in my orbit ◡̈",
      submissionId: crypto.randomUUID(),
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

export async function replyToTeenyQuestion(formData: FormData) {
  await requireOwner();
  await answerTeenyQuestion(formData.get("id"), formData.get("answer"));
  revalidatePath("/teeny-tiny-things");
  revalidatePath("/controlroom/teeny-questions");
  revalidatePath("/controlroom");
  revalidatePath("/admin");
}

export async function removeTeenyQuestion(formData: FormData) {
  await requireOwner();
  await deleteTeenyQuestion(formData.get("id"));
  revalidatePath("/teeny-tiny-things");
  revalidatePath("/controlroom/teeny-questions");
  revalidatePath("/controlroom");
  revalidatePath("/admin");
}
