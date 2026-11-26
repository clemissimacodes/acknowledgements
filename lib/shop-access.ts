import { currentUser } from "@clerk/nextjs/server";
import { isAdminUser } from "@/lib/admin";
import { SHOP_LIVE } from "@/lib/friend-types";

/* True when the shop may be shown to this request: either it is live,
   or the visitor is the owner previewing from the backroom. */
export async function canSeeShop() {
  if (SHOP_LIVE) return true;
  try {
    return isAdminUser(await currentUser());
  } catch {
    return false;
  }
}
