import { notFound } from "next/navigation";
import { getNote, getNotes } from "@/lib/notes";
import { ContactCard } from "@/components/messages/ContactCard";

export const dynamicParams = true;

export async function generateStaticParams() {
  const notes = await getNotes();
  return notes.map((note) => ({ slug: note.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const note = await getNote(slug);
  return { title: note ? note.name : "Messages" };
}

export default async function ContactPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const note = await getNote(slug);
  if (!note) notFound();
  return <ContactCard note={note} />;
}
