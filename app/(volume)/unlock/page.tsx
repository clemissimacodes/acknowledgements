import { redirect } from "next/navigation";
import { safeProtectedNext } from "@/lib/cia-gate";

export default async function UnlockPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const next = (await searchParams).next;
  const destination = safeProtectedNext(
    typeof next === "string" ? next : "/acknowledgements",
  );
  redirect(`/secrets/unlock?next=${encodeURIComponent(destination)}`);
}
