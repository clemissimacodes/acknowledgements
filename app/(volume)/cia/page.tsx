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
        <p className="cia-file-number">Private workspace</p>
        <h1>Everything in progress.</h1>
        <p className="cia-deck">
          Work lives here before it goes live.
        </p>
      </header>

      <section className="cia-directorates" aria-labelledby="directorates-title">
        <div className="cia-section-title">
          <h2 id="directorates-title">In progress</h2>
          <span>Private hub</span>
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
            <Link href="/secrets/radar">
              <span className="cia-directorate-number">05</span>
              <span>
                <strong>Clemi Radar</strong>
                <small>
                  City-level signals and Clemi’s approved travel constellation.
                </small>
              </span>
              <span className="cia-file-count">in progress</span>
            </Link>
          </li>
          <li>
            <Link href="/acknowledgements">
              <span className="cia-directorate-number">06</span>
              <span>
                <strong>Acknowledgements</strong>
                <small>Private notes and messages kept within Secrets.</small>
              </span>
              <span className="cia-file-count">protected</span>
            </Link>
          </li>
          <li>
            <Link href="/secrets/shop">
              <span className="cia-directorate-number">07</span>
              <span>
                <strong>Clemi Store</strong>
                <small>One-of-one personal secrets available for purchase.</small>
              </span>
              <span className="cia-file-count">private shop</span>
            </Link>
          </li>
          <li>
            <Link href="/secrets/sunday-posties">
              <span className="cia-directorate-number">08</span>
              <span>
                <strong>Sunday Posties</strong>
                <small>Doodles and caboodles mailed to verified friendlies.</small>
              </span>
              <span className="cia-file-count">in progress</span>
            </Link>
          </li>
          <li>
            <Link href="/secrets/dont-try">
              <span className="cia-directorate-number">09</span>
              <span>
                <strong>Don’t Try</strong>
                <small>The private Don’t Try challenge and daily field log.</small>
              </span>
              <span className="cia-file-count">private</span>
            </Link>
          </li>
        </ol>
      </section>

    </main>
  );
}
