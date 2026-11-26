import "server-only";

import { currentUser } from "@clerk/nextjs/server";
import { isAdminUser } from "@/lib/admin";

/** True only when Clementine is signed in; visitors cannot claim it. */
export async function viewerIsOwner() {
  const user = await currentUser().catch(() => null);
  return isAdminUser(user);
}
