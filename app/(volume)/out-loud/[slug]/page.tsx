import { currentUser } from "@clerk/nextjs/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MemoListen } from "@/components/out-loud/MemoListen";
import { isAdminUser } from "@/lib/admin";
import { formatVoiceDate, formatVoiceDuration } from "@/lib/format";
import { getPublishedMemo, repliesForMemo } from "@/lib/voice-memos";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const memo = await getPublishedMemo((await params).slug).catch(() => null);
  if (!memo) return { title: "Out Loud" };
  const title =
    memo.kind === "person" && memo.title
      ? `for ${memo.title}`
      : memo.title || "Out Loud";
  return { title };
}

export default async function OutLoudMemoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const memo = await getPublishedMemo(slug).catch(() => null);
  if (!memo) notFound();
  const [replies, user] = await Promise.all([
    repliesForMemo(memo.id),
    currentUser(),
  ]);
  const heading =
    memo.kind === "person" && memo.title
      ? `for ${memo.title}`
      : memo.title || "A thought";

  return (
    <main className="out-loud-page out-loud-listen">
      <div className="out-loud-inner">
        <p className="out-loud-kicker">
          <Link href="/secrets">Secrets</Link>
          {" / "}
          <Link href="/secrets/out-loud">Out Loud</Link>
        </p>
        <h1>{heading}</h1>
        <p className="out-loud-when">
          {formatVoiceDate(memo.recordedAt)} ·{" "}
          {formatVoiceDuration(memo.durationMs)}
        </p>
        <MemoListen
          memo={{
            id: memo.id,
            slug: memo.slug,
            kind: memo.kind,
            title: memo.title,
            recordedAt: memo.recordedAt,
            durationMs: memo.durationMs,
            blobUrl: memo.blobUrl,
            replyCount: memo.replyCount,
          }}
          initialReplies={replies}
          admin={isAdminUser(user)}
        />
      </div>
    </main>
  );
}
