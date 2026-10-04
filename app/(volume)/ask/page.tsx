import { AskComposer } from "@/components/ask/AskComposer";
import { HoverIndex } from "@/components/photography/HoverIndex";
import { PhotoHeader } from "@/components/photography/PhotoHeader";
import { ASK_MAX_LENGTH, listAskQuestions } from "@/lib/ask";
import { formatRollTime } from "@/lib/photography-format";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Ask Me Anything",
  description: "i welcome all questions, thoughts, & well wishes — anonymously.",
};

function askTime(iso: string) {
  const date = new Date(iso);
  return formatRollTime({ year: date.getFullYear(), month: date.getMonth() + 1 });
}

export default async function AskIndexPage() {
  const questions = await listAskQuestions().catch(() => []);

  return (
    <main className="photo-page ask-page">
      <PhotoHeader current="ask" />
      <h1 className="visually-hidden">Ask Me Anything</h1>
      <p className="ask-welcome">i welcome all questions, thoughts, &amp; well wishes</p>
      <AskComposer maxLength={ASK_MAX_LENGTH} />
      {questions.length ? (
        <HoverIndex
          labels={{
            a: { short: "Q.", full: "Question" },
            b: { short: "R.", full: "Reply" },
            time: { short: "T.", full: "Time" },
          }}
          rows={questions.map((question) => ({
            key: question.id,
            href: `/ask/${question.id}`,
            a: question.body,
            b: question.answer ? question.answer.split("\n")[0] : "—",
            time: askTime(question.createdAt),
            image: null,
            peekText: question.answer ?? question.body,
          }))}
        />
      ) : (
        <p className="photo-empty">Nothing asked yet. You could be first.</p>
      )}
    </main>
  );
}
