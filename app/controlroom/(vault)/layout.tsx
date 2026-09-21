import type { Metadata } from "next";
import { currentUser } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { isAdminUser } from "@/lib/admin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false, noarchive: true },
};

// Everything that used to live behind the Secrets password now lives here.
// Middleware already requires a Clerk session for /controlroom/*; this layout
// additionally requires the configured owner and hides the pages from anyone
// else as if they never existed.
export default async function VaultLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await currentUser();
  if (!isAdminUser(user)) notFound();
  return <>{children}</>;
}
