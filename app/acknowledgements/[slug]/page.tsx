import { notFound } from "next/navigation";
import { getNote, getNotes } from "@/lib/notes";
import { Thread } from "@/components/messages/Thread";

export function generateStaticParams() {
  return getNotes().map((note) => ({ slug: note.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const note = getNote(slug);
  return { title: note ? note.name : "Messages" };
}

export default async function ThreadPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const note = getNote(slug);
  if (!note) notFound();
  return <Thread note={note} />;
}
