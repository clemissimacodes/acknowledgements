import { HoverIndex } from "@/components/photography/HoverIndex";
import { PhotoHeader } from "@/components/photography/PhotoHeader";
import { adoredPoems, poemsNewestFirst } from "@/lib/poems";

export const metadata = {
  title: "Poetry",
};

export default function PoetryIndexPage() {
  return (
    <main className="photo-page poetry-index-page">
      <PhotoHeader current="poetry" />
      <h1 className="visually-hidden">Poetry</h1>
      <p className="photo-lede">To read me is to know me. Read me with great care!</p>
      <HoverIndex
        labels={{
          a: { short: "P.", full: "Poem" },
          b: { short: "D.", full: "Dedication" },
          time: { short: "T.", full: "Time" },
        }}
        rows={poemsNewestFirst.map((poem) => ({
          key: poem.slug,
          href: `/poetry/${poem.slug}`,
          a: poem.title,
          b: poem.dedication ? `for ${poem.dedication}` : "—",
          time: String(poem.year),
          image: null,
        }))}
      />

      <section className="poetry-adored-index" aria-labelledby="poetry-adored-title">
        <h2 id="poetry-adored-title" className="photo-lede">
          poems i adore
        </h2>
        <HoverIndex
          labels={{
            a: { short: "A.", full: "Author" },
            b: { short: "P.", full: "Poem" },
          }}
          rows={adoredPoems.map((poem) => ({
            key: poem.href,
            href: poem.href,
            external: true,
            a: poem.author,
            b:
              "alternateTitle" in poem
                ? `${poem.title} ${poem.alternateTitle}`
                : poem.title,
            time: "",
            image: null,
          }))}
        />
      </section>
    </main>
  );
}
