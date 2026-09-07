import Link from "next/link";
import { CIA_PROJECTS, getPublishedCiaEntries } from "@/lib/cia";

const exhibits = [
  {
    slug: "saas-inflation",
    number: "01",
    title: "SaaS Inflation Index",
    description: "Public software pricing changes, normalized and sourced.",
  },
  {
    slug: "startup-graveyard",
    number: "02",
    title: "Startup Graveyard",
    description: "Documented shutdowns with dates and confidence labels.",
  },
  {
    slug: "founder-apologies",
    number: "03",
    title: "Founder Apology Archive",
    description: "Brief attributed excerpts in their original context.",
  },
  {
    slug: "quality-control",
    number: "04",
    title: "Quality Control Bureau",
    description: "Clementine’s rigorous, owner-authored citrus inspections.",
  },
] as const;

export const metadata = {
  title: "Secrets",
  description: "Private acknowledgements and sourced investigations from Clementine.",
};

export default async function CiaPage() {
  const published = await getPublishedCiaEntries();
  const counts = new Map(CIA_PROJECTS.map((project) => [project, 0]));
  for (const entry of published) {
    counts.set(entry.project, (counts.get(entry.project) ?? 0) + 1);
  }

  return (
    <main className="cia-page cia-hq">
      <header className="cia-hero">
        <p className="cia-classification">Secrets</p>
        <p className="cia-file-number">Headquarters memorandum · public copy</p>
        <h1>Small facts, thoroughly peeled.</h1>
        <p className="cia-deck">
          Four deliberately modest investigations. Every public record has a
          source, retrieval date, confidence label, and correction path. Robots
          may notice changes; only Clementine may publish them.
        </p>
      </header>

      <section className="cia-directorates" aria-labelledby="directorates-title">
        <div className="cia-section-title">
          <h2 id="directorates-title">Inside Secrets</h2>
          <span>Protected index</span>
        </div>
        <ol>
          {exhibits.map((exhibit) => (
            <li key={exhibit.slug}>
              <Link href={`/secrets/${exhibit.slug}`}>
                <span className="cia-directorate-number">{exhibit.number}</span>
                <span>
                  <strong>{exhibit.title}</strong>
                  <small>{exhibit.description}</small>
                </span>
                <span className="cia-file-count">
                  {counts.get(exhibit.slug) ?? 0} cleared
                </span>
              </Link>
            </li>
          ))}
          <li>
            <Link href="/acknowledgements">
              <span className="cia-directorate-number">05</span>
              <span>
                <strong>Acknowledgements</strong>
                <small>Private notes and messages kept within Secrets.</small>
              </span>
              <span className="cia-file-count">protected</span>
            </Link>
          </li>
        </ol>
      </section>

      <aside className="cia-method-note">
        <p className="cia-stamp">Provenance required</p>
        <p>
          Drafts, rejected leads, and withdrawn records are private. Public
          files expose only the exact revision that passed owner review.
        </p>
        <Link href="/privacy#secrets-records">Read the sourcing policy</Link>
      </aside>
    </main>
  );
}
