import Link from "next/link";
import { poems } from "@/lib/poems";

const adoredPoems = [
  {
    title: "The Quiet World",
    author: "Jeffrey McDaniel",
    sources: [
      {
        label: "read",
        href: "https://www.poetryfoundation.org/poems/49238/the-quiet-world",
      },
    ],
  },
  {
    title: "The Vase",
    author: "Jeffrey McDaniel",
    sources: [],
  },
  {
    title: "Crossing Half of China to Sleep with You",
    alternateTitle: "穿过大半个中国去睡你",
    author: "Yu Xiuhua 余秀华",
    sources: [
      {
        label: "English",
        href: "https://onbeing.org/poetry/crossing-half-of-china-to-sleep-with-you/",
      },
      {
        label: "中文",
        href: "https://baike.so.com/doc/7927612-32387111.html",
      },
    ],
  },
  {
    title: "Zazen on Ching-t’ing Mountain",
    author: "Li Po, translated by Sam Hamill",
    sources: [
      {
        label: "read",
        href: "https://www.poetryfoundation.org/poems/48711/zazen-on-ching-ting-mountain",
      },
    ],
  },
  {
    title: "[love is more thicker than forget]",
    author: "E. E. Cummings",
    sources: [
      {
        label: "read",
        href: "https://www.poetryfoundation.org/poetrymagazine/poems/22224/love-is-more-thicker-than-forget",
      },
    ],
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
                  {poem.title}
                  {"alternateTitle" in poem ? (
                    <span lang="zh-Hans">{poem.alternateTitle}</span>
                  ) : null}
                </span>
                <span className="poetry-adored-author">by {poem.author}</span>
                {poem.sources.length ? (
                  <span className="poetry-adored-sources">
                    {poem.sources.map((source) => (
                      <a
                        key={source.href}
                        href={source.href}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {source.label}
                        <span aria-hidden="true"> ↗</span>
                      </a>
                    ))}
                  </span>
                ) : (
                  <span className="poetry-adored-pending">
                    send me the poem link
                  </span>
                )}
              </li>
            ))}
          </ul>
          <p className="poetry-adored-note">
            Official copies open beside this site because Poetry Foundation
            does not permit embedded readers.
          </p>
        </section>
      </div>
    </main>
  );
}
