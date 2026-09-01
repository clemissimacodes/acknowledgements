import Link from "next/link";

export default function HomePage() {
  return (
    <div className="doc-body" style={{ minHeight: "100dvh" }}>
      <main className="doc">
        <h1>Clementine Shao</h1>
        <p className="lede">
          The phone is face-up beside a water glass. Rain on the bay window, the
          list already open. She has been writing these in other rooms for years.
          Tonight they sit in blue.
        </p>
        <h2>Contents</h2>
        <ol className="toc">
          <li>
            <Link href="/acknowledgements">Acknowledgements</Link>
          </li>
        </ol>
      </main>
    </div>
  );
}
