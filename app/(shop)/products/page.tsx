import { redirect } from "next/navigation";
import { SHOP_HANDLE } from "@/lib/friend-types";

export default function ProductsIndex() {
  redirect(`/collections/${SHOP_HANDLE}`);
}
