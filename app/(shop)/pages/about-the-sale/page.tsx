import { redirect } from "next/navigation";
import { DIARY_PATH } from "@/lib/friend-types";

export default function AboutTheSale() {
  redirect(DIARY_PATH);
}
