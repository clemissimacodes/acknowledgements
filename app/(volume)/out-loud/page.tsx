import Link from "next/link";
import { formatVoiceDate, formatVoiceDuration } from "@/lib/format";
import { listPublishedMemos, type VoiceMemo } from "@/lib/voice-memos";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Out Loud",
};

function MemoRow({ memo }: { memo: VoiceMemo }) {
  const name =
    memo.kind === "person"
      ? memo.title
      : memo.title || formatVoiceDate(memo.recordedAt);
  return (
    <li>
      <Link href={`/out-loud/${memo.slug}`}>
        {memo.kind === "person" ? `for ${name}` : name}
      </Link>
      <span className="out-loud-index-meta">
        {formatVoiceDate(memo.recordedAt)} · {formatVoiceDuration(memo.durationMs)}
        {memo.replyCount
          ? ` · ${memo.replyCount} ${memo.replyCount === 1 ? "reply" : "replies"}`
          : ""}
      </span>
    </li>
  );
}

export default async function OutLoudIndexPage() {
  const memos = await listPublishedMemos().catch(() => []);
  const people = memos.filter((memo) => memo.kind === "person");
  const thoughts = memos.filter((memo) => memo.kind === "thought");

  return (
    <main className="out-loud-page">
      <div className="out-loud-inner">
        <h1>Out Loud</h1>
        <p className="out-loud-lede">
          Live, raw voice memos about people and thoughts. Speak back if you
          want — the reply is a voice, not a note in the margin.
        </p>
        <div className="out-loud-columns">
          <section aria-labelledby="out-loud-people-title">
            <h2 id="out-loud-people-title">People</h2>
            {people.length ? (
              <ol className="out-loud-index">
                {people.map((memo) => (
                  <MemoRow key={memo.id} memo={memo} />
                ))}
              </ol>
            ) : (
              <p className="out-loud-empty">Nobody spoken yet.</p>
            )}
          </section>
          <section
            className="out-loud-thoughts"
            aria-labelledby="out-loud-thoughts-title"
          >
            <h2 id="out-loud-thoughts-title">Thoughts</h2>
            {thoughts.length ? (
              <ol className="out-loud-index">
                {thoughts.map((memo) => (
                  <MemoRow key={memo.id} memo={memo} />
                ))}
              </ol>
            ) : (
              <p className="out-loud-empty">No thoughts spoken yet.</p>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
