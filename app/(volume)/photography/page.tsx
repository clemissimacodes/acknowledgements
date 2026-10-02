import { PhotoHeader } from "@/components/photography/PhotoHeader";
import { PhotoIndex } from "@/components/photography/PhotoIndex";
import { listPublishedRolls } from "@/lib/photography";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Photography",
  description: "Rolls of photographs by Clementine Kay Shao, one story each.",
};

export default async function PhotographyIndexPage() {
  const rolls = await listPublishedRolls().catch(() => []);

  return (
    <main className="photo-page">
      <PhotoHeader current="photography" />
      <h1 className="visually-hidden">Photography</h1>
      {rolls.length ? (
        <PhotoIndex
          rolls={rolls.map((roll) => ({
            slug: roll.slug,
            title: roll.title,
            photograph: roll.note.split("\n")[0] ?? "",
            year: roll.year,
            month: roll.month,
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
        <p className="photo-empty">The first roll is still in the camera.</p>
      )}
    </main>
  );
}
