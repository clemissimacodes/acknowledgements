import Link from "next/link";
import { notFound } from "next/navigation";
import { PhotoHeader } from "@/components/photography/PhotoHeader";
import { PoetryAnnotations } from "@/components/poetry/PoetryAnnotations";
import { TurnipChase } from "@/components/poetry/TurnipChase";
import { rollNumber } from "@/lib/photography-format";
import { getPoem, poemLines, poems, poemsNewestFirst } from "@/lib/poems";

export function generateStaticParams() {
  return poems.map((poem) => ({ slug: poem.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const poem = getPoem((await params).slug);
  return { title: poem?.title ?? "Poetry" };
}

export default async function PoemPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const poem = getPoem(slug);
  if (!poem) notFound();

  const index = poemsNewestFirst.findIndex((item) => item.slug === poem.slug);
  const previous = index > 0 ? poemsNewestFirst[index - 1] : null;
  const next =
    index >= 0 && index < poemsNewestFirst.length - 1
      ? poemsNewestFirst[index + 1]
      : null;

  return (
    <main className="poetry-page poetry-read">
      {poem.swarm ? <TurnipChase /> : null}
      <div className="poetry-inner">
        <PhotoHeader current="poetry" />
        <p className="photo-roll-meta poem-meta">
          <span>{rollNumber(index)}</span>
          <span>{poem.year}</span>
          <span>{poemLines(poem).filter(Boolean).length} lines</span>
        </p>
        <PoetryAnnotations
          slug={poem.slug}
          title={poem.title}
          dedication={poem.dedication}
          lines={poemLines(poem)}
          companion={poem.companion}
        />
        <nav className="photo-roll-nav" aria-label="Other poems">
          {previous ? (
            <Link href={`/poetry/${previous.slug}`} rel="prev">
              ← {previous.title}
            </Link>
          ) : (
            <span />
          )}
          <Link href="/poetry">all poems</Link>
          {next ? (
            <Link href={`/poetry/${next.slug}`} rel="next">
              {next.title} →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      </div>
    </main>
  );
}
