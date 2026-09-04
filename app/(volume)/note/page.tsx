import { NoteForm } from "@/components/NoteForm";

export const metadata = {
  title: "A note",
};

export default function NotePage() {
  return (
    <main className="unlock-page note-page">
      <h1>a note</h1>
      <p className="unlock-lede">
        Ask me a question, or leave a note. I will read it.
      </p>
      <NoteForm />
    </main>
  );
}
