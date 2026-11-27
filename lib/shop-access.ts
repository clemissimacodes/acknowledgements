import { auth, currentUser } from "@clerk/nextjs/server";
import { isAdminUser } from "@/lib/admin";
import { SHOP_LIVE } from "@/lib/friend-types";

/* True when the shop may be shown: live for everyone, or owner previewing. */
export async function canSeeShop() {
  if (SHOP_LIVE) return true;
  try {
    const ownerId = process.env.ADMIN_USER_ID?.trim();
    if (ownerId) {
      const { userId } = await auth();
      return userId === ownerId;
    }
    return isAdminUser(await currentUser());
  } catch {
    return false;
  }
}
