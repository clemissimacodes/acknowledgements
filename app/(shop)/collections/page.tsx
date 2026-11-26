import { redirect } from "next/navigation";
import { SHOP_HANDLE } from "@/lib/friend-types";

export default function CollectionsIndex() {
  redirect(`/collections/${SHOP_HANDLE}`);
}
