"use server";

import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { isAdminUser } from "@/lib/admin";
import {
  createFriend,
  deleteFriend,
  setFriendImage,
  setFriendVisible,
  updateFriend,
  updateFriendRoster,
  type FriendInput,
} from "@/lib/friends";

async function requireOwner() {
  const user = await currentUser();
  if (!isAdminUser(user)) throw new Error("Not authorized.");
}

function refresh() {
  revalidatePath("/collections/[handle]", "page");
  revalidatePath("/products/[slug]", "page");
  revalidatePath("/controlroom/friends-and-family");
}

function fromForm(form: FormData): FriendInput {
  const get = (key: string) => form.get(key) ?? undefined;
  return {
    nickname: get("nickname"),
    slug: get("slug"),
    productName: get("productName"),
    era: get("era"),
    badge: get("badge"),
    metOn: get("metOn"),
    metHow: get("metHow"),
    hometown: get("hometown"),
    madeOf: get("madeOf"),
    care: get("care"),
    description: get("description"),
    favoriteMemory: get("favoriteMemory"),
    favoriteTrait: get("favoriteTrait"),
    notes: get("notes"),
    poem: get("poem"),
    relationship: get("relationship"),
    relationshipOptions: get("relationshipOptions"),
    colors: get("colors"),
    pairsWith: get("pairsWith"),
    visible: get("visible"),
    sortOrder: get("sortOrder"),
  };
}

export async function rosterUpdateForm(form: FormData) {
  await requireOwner();
  const ids = form.getAll("ids").map(String);
  for (const id of ids) {
    await updateFriendRoster(id, {
      metOn: form.get(`metOn-${id}`) ?? undefined,
      era: form.get(`era-${id}`) ?? undefined,
      relationship: form.get(`relationship-${id}`) ?? undefined,
      visible: form.get(`visible-${id}`) ?? undefined,
      poem: form.get(`poem-${id}`) ?? undefined,
    });
  }
  refresh();
}

export async function createFriendForm(form: FormData) {
  await requireOwner();
  await createFriend(fromForm(form));
  refresh();
}

export async function updateFriendForm(form: FormData) {
  await requireOwner();
  const id = String(form.get("id") ?? "");
  if (!id) throw new Error("Missing id.");
  await updateFriend(id, fromForm(form));
  refresh();
}

export async function toggleVisibleForm(form: FormData) {
  await requireOwner();
  const id = String(form.get("id") ?? "");
  await setFriendVisible(id, form.get("visible") === "true");
  refresh();
}

export async function deleteFriendForm(form: FormData) {
  await requireOwner();
  await deleteFriend(String(form.get("id") ?? ""));
  refresh();
}

export async function attachFriendImage(input: {
  id: string;
  which: "hero" | "alt";
  url: string;
  pathname: string;
}) {
  await requireOwner();
  if (!/^[a-f0-9-]{36}$/.test(input.id)) throw new Error("Bad id.");
  if (!input.pathname.startsWith("friends-and-family/")) throw new Error("Bad path.");
  await setFriendImage(input.id, input.which, { url: input.url, pathname: input.pathname });
  refresh();
}

export async function clearFriendImageForm(form: FormData) {
  await requireOwner();
  const id = String(form.get("id") ?? "");
  const which = form.get("which") === "alt" ? "alt" : "hero";
  await setFriendImage(id, which, null);
  refresh();
}
