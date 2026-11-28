import { auth, currentUser } from "@clerk/nextjs/server";
import { isAdminUser } from "@/lib/admin";
import { BAD_COMPANY_LIVE } from "@/lib/bad-company";
import { SHOP_LIVE } from "@/lib/friend-types";

async function isOwner() {
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

/* True when the shop may be shown: live for everyone, or owner previewing. */
export async function canSeeShop() {
  if (SHOP_LIVE) return true;
  return isOwner();
}

/* Separate switch on purpose: Good Company going live must not take Bad Company with it. */
export async function canSeeBadCompany() {
  if (BAD_COMPANY_LIVE) return true;
  return isOwner();
}
