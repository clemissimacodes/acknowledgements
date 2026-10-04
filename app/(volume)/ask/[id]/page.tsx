import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PhotoHeader } from "@/components/photography/PhotoHeader";
import { getAskQuestion, listAskQuestions, openAskQuestion } from "@/lib/ask";
import { formatRollTime, rollNumber } from "@/lib/photography-format";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

function when(iso: string) {
  const date = new Date(iso);
  return formatRollTime({ year: date.getFullYear(), month: date.getMonth() + 1 });
}

function paragraphs(text: string) {
  return text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const question = await getAskQuestion(id).catch(() => null);
  if (!question) return { title: "Ask Me Anything" };
  const short = question.body.length > 70 ? `${question.body.slice(0, 70).trimEnd()}…` : question.body;
  return {
    title: `${short} · Ask Me Anything`,
    description: question.answer ?? "not yet answered",
    robots: { index: false, follow: true },
  };
}

export default async function AskQuestionPage({ params }: { params: Params }) {
  const { id } = await params;
  const question = await openAskQuestion(id).catch(() => null);
  if (!question) notFound();

  const all = await listAskQuestions().catch(() => []);
  const index = all.findIndex((item) => item.id === question.id);
  const previous = index > 0 ? all[index - 1] : null;
  const next = index >= 0 && index < all.length - 1 ? all[index + 1] : null;
  const opens = question.opens;

  return (
    <main className="photo-page photo-roll ask-thread">
      <PhotoHeader current="ask" />
      <header className="photo-masthead">
        <p className="photo-roll-meta">
          {index >= 0 ? <span>{rollNumber(index)}</span> : null}
          <span>asked {when(question.createdAt)}</span>
          <span>
            opened {opens} {opens === 1 ? "time" : "times"}
          </span>
        </p>
        <h1>{question.body}</h1>
        <p className="art-piece-artist">anon</p>
      </header>

      <section className="ask-reply" aria-labelledby="ask-reply-title">
        <h2 id="ask-reply-title" className="art-loves-title">
          {question.answer ? "reply" : "reply, pending"}
        </h2>
        {question.answer ? (
          <div className="photo-roll-note ask-reply-body">
            {paragraphs(question.answer).map((block, position) => (
              <p key={position}>{block}</p>
            ))}
            {question.answeredAt ? (
              <p className="ask-reply-meta">— clementine, {when(question.answeredAt)}</p>
            ) : null}
          </div>
        ) : (
          <p className="photo-roll-note ask-reply-body is-pending">
            check back tomorrow
          </p>
        )}
      </section>

      <nav className="photo-roll-nav" aria-label="Other questions">
        {previous ? (
          <Link href={`/ask/${previous.id}`} rel="prev">
            ← newer
          </Link>
        ) : (
          <span />
        )}
        <Link href="/ask">all questions</Link>
        {next ? (
          <Link href={`/ask/${next.id}`} rel="next">
            older →
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </main>
  );
}
