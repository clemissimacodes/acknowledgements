import Link from "next/link";
import { poems } from "@/lib/poems";

const adoredPoems = [
  {
    title: "The Quiet World",
    author: "Jeffrey McDaniel",
    href: "https://www.poetryfoundation.org/poems/49238/the-quiet-world",
  },
  {
    title: "The Vase",
    author: "Jeffrey McDaniel",
    href: "https://www.are.na/block/45010448",
  },
  {
    title: "Crossing Half of China to Sleep with You",
    alternateTitle: "穿过大半个中国去睡你",
    alternateHref: "https://baike.so.com/doc/7927612-32387111.html",
    author: "Yu Xiuhua 余秀华",
    href: "https://onbeing.org/poetry/crossing-half-of-china-to-sleep-with-you/",
  },
  {
    title: "Zazen on Ching-t’ing Mountain",
    author: "Li Po, translated by Sam Hamill",
    href: "https://www.poetryfoundation.org/poems/48711/zazen-on-ching-ting-mountain",
  },
  {
    title: "[love is more thicker than forget]",
    author: "E. E. Cummings",
    href: "https://www.poetryfoundation.org/poetrymagazine/poems/22224/love-is-more-thicker-than-forget",
  },
] as const;

export const metadata = {
  title: "Poetry",
};

export default function PoetryIndexPage() {
  return (
    <main className="poetry-page">
      <div className="poetry-inner">
        <h1>Poetry</h1>
        <p className="poetry-lede">
          My writing kaleidoscopes my being. Please, read with great care.
        </p>
        <ol className="poetry-index">
          {poems.map((poem) => (
            <li key={poem.slug}>
              <Link href={`/poetry/${poem.slug}`}>{poem.title}</Link>
            </li>
          ))}
        </ol>
        <section className="poetry-adored" aria-labelledby="poetry-adored-title">
          <h2 id="poetry-adored-title">poems i adore</h2>
          <ul className="poetry-adored-list">
            {adoredPoems.map((poem) => (
              <li key={`${poem.title}-${poem.author}`}>
                <span className="poetry-adored-name">
                  <a href={poem.href} target="_blank" rel="noreferrer">
                    {poem.title}
                  </a>
                  {"alternateTitle" in poem ? (
                    <a
                      href={poem.alternateHref}
                      target="_blank"
                      rel="noreferrer"
                      lang="zh-Hans"
                    >
                      {poem.alternateTitle}
                    </a>
                  ) : null}
                </span>
                <span className="poetry-adored-author">by {poem.author}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
