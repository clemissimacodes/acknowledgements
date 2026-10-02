import { PhotoIndex } from "@/components/photography/PhotoIndex";
import { listPublishedRolls } from "@/lib/photography";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Photography",
  description: "Rolls of photographs by Clementine Kay Shao, one story each.",
};

export default async function PhotographyIndexPage() {
  const rolls = await listPublishedRolls().catch(() => []);

  const heading = (
    <header className="photo-masthead">
      <h1>Photography</h1>
      <p className="photo-lede">
        Rolls, not albums. Each one is a handful of frames that only make
        sense together.
      </p>
    </header>
  );

  return (
    <main className="photo-page">
      {rolls.length ? (
        <PhotoIndex
          heading={heading}
          rolls={rolls.map((roll) => ({
            slug: roll.slug,
            title: roll.title,
            note: roll.note.split("\n")[0] ?? "",
            year: roll.year,
            frameCount: roll.frameCount,
            cover: roll.cover
              ? {
                  url: roll.cover.url,
                  width: roll.cover.width,
                  height: roll.cover.height,
                }
              : null,
          }))}
        />
      ) : (
        <>
          {heading}
          <p className="photo-empty">The first roll is still in the camera.</p>
        </>
      )}
    </main>
  );
}
