import Link from "next/link";
import { poems } from "@/lib/poems";

export const metadata = {
  title: "Poetry",
};

export default function PoetryIndexPage() {
  return (
    <main className="poetry-page">
      <div className="poetry-inner">
        <p className="poetry-kicker">
          <Link href="/">Clementine Kay Shao</Link>
        </p>
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
      </div>
    </main>
  );
}
