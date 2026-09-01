import type { Metadata } from "next";
import { getNotes } from "@/lib/notes";
import { MessagesShell } from "@/components/messages/MessagesShell";

export const metadata: Metadata = {
  title: "Messages",
};

export default function AcknowledgementsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const notes = getNotes();

  return <MessagesShell notes={notes}>{children}</MessagesShell>;
}
