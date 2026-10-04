import type { Metadata } from "next";
import { currentUser } from "@clerk/nextjs/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PhotoHeader } from "@/components/photography/PhotoHeader";
import { isAdminUser } from "@/lib/admin";
import { getRollBySlug, listPublishedRolls } from "@/lib/photography";
import { formatRollTime, rollNumber } from "@/lib/photography-format";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug } = await params;
  const roll = await getRollBySlug(slug).catch(() => null);
  if (!roll) return { title: "Photography" };
  return {
    title: `${roll.title} · Photography`,
    description: roll.note.split("\n")[0] || `${roll.frameCount} frames.`,
    openGraph: roll.cover ? { images: [{ url: roll.cover.url }] } : undefined,
  };
}

function paragraphs(text: string) {
  return text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
}

export default async function PhotoRollPage({ params }: { params: Params }) {
  const { slug } = await params;
  const roll = await getRollBySlug(slug).catch(() => null);
  if (!roll) notFound();

  let owner = false;
  if (!roll.published || roll.frameCount === 0) {
    owner = isAdminUser(await currentUser());
    if (!owner) notFound();
  }

  const published = await listPublishedRolls().catch(() => []);
  const index = published.findIndex((item) => item.slug === roll.slug);
  const previous = index > 0 ? published[index - 1] : null;
  const next =
    index >= 0 && index < published.length - 1 ? published[index + 1] : null;

  return (
    <main className="photo-page photo-roll">
      <PhotoHeader current="photography" />
      <header className="photo-masthead">
        <p className="photo-roll-meta">
          {index >= 0 ? <span>{rollNumber(index)}</span> : null}
          {formatRollTime(roll) ? <span>{formatRollTime(roll)}</span> : null}
          <span>
            {roll.frameCount}{" "}
            {roll.frameCount === 1 ? "photograph" : "photographs"}
          </span>
          {!roll.published ? <span>draft, only you see this</span> : null}
        </p>
        <h1>{roll.title}</h1>
        {roll.note ? (
          <div className="photo-roll-note">
            {paragraphs(roll.note).map((block, position) => (
              <p key={position}>{block}</p>
            ))}
          </div>
        ) : null}
      </header>

      <ol className="photo-strip">
        {roll.frames.map((frame, position) => {
          const landscape =
            frame.width && frame.height ? frame.width >= frame.height : true;
          return (
            <li
              key={frame.id}
              className={`photo-frame${landscape ? " is-landscape" : " is-portrait"}`}
            >
              <figure>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={frame.url}
                  alt={frame.caption || `${roll.title}, frame ${position + 1}`}
                  width={frame.width || undefined}
                  height={frame.height || undefined}
                  loading={position < 2 ? "eager" : "lazy"}
                  decoding="async"
                />
                <figcaption>
                  <span className="photo-frame-no">
                    {String(position + 1).padStart(2, "0")}
                  </span>
                  {frame.caption ? <span>{frame.caption}</span> : null}
                </figcaption>
              </figure>
            </li>
          );
        })}
      </ol>

      <nav className="photo-roll-nav" aria-label="Other rolls">
        {previous ? (
          <Link href={`/photography/${previous.slug}`} rel="prev">
            ← {previous.title}
          </Link>
        ) : (
          <span />
        )}
        <Link href="/photography">all rolls</Link>
        {next ? (
          <Link href={`/photography/${next.slug}`} rel="next">
            {next.title} →
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </main>
  );
}
