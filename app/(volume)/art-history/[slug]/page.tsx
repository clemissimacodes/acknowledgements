import type { Metadata } from "next";
import { currentUser } from "@clerk/nextjs/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PhotoHeader } from "@/components/photography/PhotoHeader";
import { isAdminUser } from "@/lib/admin";
import { getPieceBySlug, listPublishedPieces } from "@/lib/art-history";
import { rollNumber } from "@/lib/photography-format";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug } = await params;
  const piece = await getPieceBySlug(slug).catch(() => null);
  if (!piece) return { title: "Art History" };
  return {
    title: `${piece.title} · ${piece.artist} · Art History`,
    description: piece.loves[0] ?? `${piece.artist}, ${piece.time}`.trim(),
    openGraph: piece.image ? { images: [{ url: piece.image.url }] } : undefined,
  };
}

function paragraphs(text: string) {
  return text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
}

export default async function ArtPiecePage({ params }: { params: Params }) {
  const { slug } = await params;
  const piece = await getPieceBySlug(slug).catch(() => null);
  if (!piece) notFound();

  if (!piece.published || !piece.image) {
    const owner = isAdminUser(await currentUser());
    if (!owner) notFound();
  }

  const published = await listPublishedPieces().catch(() => []);
  const index = published.findIndex((item) => item.slug === piece.slug);
  const previous = index > 0 ? published[index - 1] : null;
  const next =
    index >= 0 && index < published.length - 1 ? published[index + 1] : null;

  const landscape = piece.image
    ? piece.image.width >= piece.image.height
    : true;

  return (
    <main className="photo-page photo-roll art-piece">
      <PhotoHeader current="art-history" />
      <header className="photo-masthead">
        <p className="photo-roll-meta">
          {index >= 0 ? <span>{rollNumber(index)}</span> : null}
          {piece.time ? <span>{piece.time}</span> : null}
          {piece.place ? <span>{piece.place}</span> : null}
          {!piece.published ? <span>draft, only you see this</span> : null}
        </p>
        <h1>{piece.title}</h1>
        <p className="art-piece-artist">{piece.artist}</p>
      </header>

      {piece.image ? (
        <figure
          className={`art-piece-figure${landscape ? " is-landscape" : " is-portrait"}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={piece.image.url}
            alt={`${piece.title} by ${piece.artist}`}
            width={piece.image.width || undefined}
            height={piece.image.height || undefined}
            decoding="async"
          />
        </figure>
      ) : null}

      {piece.note ? (
        <div className="photo-roll-note">
          {paragraphs(piece.note).map((block, position) => (
            <p key={position}>{block}</p>
          ))}
        </div>
      ) : null}

      {piece.loves.length ? (
        <section className="art-loves" aria-labelledby="art-loves-title">
          <h2 id="art-loves-title" className="art-loves-title">
            things i love about it
          </h2>
          <ol className="art-loves-list">
            {piece.loves.map((love, position) => (
              <li key={position}>
                <span className="photo-frame-no">
                  {String(position + 1).padStart(2, "0")}
                </span>
                <span>{love}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <nav className="photo-roll-nav" aria-label="Other pieces">
        {previous ? (
          <Link href={`/art-history/${previous.slug}`} rel="prev">
            ← {previous.title}
          </Link>
        ) : (
          <span />
        )}
        <Link href="/art-history">all pieces</Link>
        {next ? (
          <Link href={`/art-history/${next.slug}`} rel="next">
            {next.title} →
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </main>
  );
}
