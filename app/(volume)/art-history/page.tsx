import { HoverIndex } from "@/components/photography/HoverIndex";
import { PhotoHeader } from "@/components/photography/PhotoHeader";
import { listPublishedPieces } from "@/lib/art-history";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Art History",
  description:
    "Clementine Kay Shao’s favourite pieces, and the things she loves about each one.",
};

export default async function ArtHistoryIndexPage() {
  const pieces = await listPublishedPieces().catch(() => []);

  return (
    <main className="photo-page">
      <PhotoHeader current="art-history" />
      <h1 className="visually-hidden">Art History</h1>
      {pieces.length ? (
        <HoverIndex
          labels={{
            a: { short: "A.", full: "Artist" },
            b: { short: "W.", full: "Work" },
            time: { short: "T.", full: "Time" },
          }}
          rows={pieces.map((piece) => ({
            key: piece.slug,
            href: `/art-history/${piece.slug}`,
            a: piece.artist,
            b: piece.title,
            time: piece.time,
            image: piece.image,
          }))}
        />
      ) : (
        <p className="photo-empty">The gallery is being hung.</p>
      )}
    </main>
  );
}
