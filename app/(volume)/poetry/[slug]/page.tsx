import { notFound } from "next/navigation";
import { PoemSheet } from "@/components/poetry/PoemSheet";
import { TurnipChase } from "@/components/poetry/TurnipChase";
import { getPoem, poemLines, poems } from "@/lib/poems";

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

  return (
    <main className="poetry-page poetry-read">
      {poem.swarm ? <TurnipChase /> : null}
      <div className="poetry-inner">
        <PoemSheet
          title={poem.title}
          dedication={poem.dedication}
          lines={poemLines(poem)}
          companion={poem.companion}
        />
      </div>
    </main>
  );
}
