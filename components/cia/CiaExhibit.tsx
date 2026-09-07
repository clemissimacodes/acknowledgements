import Link from "next/link";
import type { CiaEntry, CiaProject } from "@/lib/cia";

const projectLabels: Record<CiaProject, string> = {
  "saas-inflation": "SaaS Inflation Index",
  "startup-graveyard": "Startup Graveyard",
  "founder-apologies": "Founder Apology Archive",
  "quality-control": "Quality Control Bureau",
};

const projectDescriptions: Record<CiaProject, string> = {
  "saas-inflation":
    "Verified changes in publicly listed software prices, normalized by plan, currency, and billing period.",
  "startup-graveyard":
    "Sourced company shutdown records. Dates and confidence labels distinguish documented fact from uncertainty.",
  "founder-apologies":
    "Short, attributed excerpts from public founder statements, presented with neutral context and links to originals.",
  "quality-control":
    "Clementine’s owner-authored citrus inspections: photographs, sensory notes, and scores without public shaming.",
};

const projectNumbers: Record<CiaProject, string> = {
  "saas-inflation": "01",
  "startup-graveyard": "02",
  "founder-apologies": "03",
  "quality-control": "04",
};

function text(value: unknown) {
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : null;
}

function ProjectFacts({ entry }: { entry: CiaEntry }) {
  const details = entry.metadata;
  const facts =
    entry.project === "saas-inflation"
      ? [
          ["Plan", text(details.planName)],
          ["Previous", text(details.previousPrice)],
          ["Observed", text(details.currentPrice)],
          ["Basis", text(details.billingPeriod)],
        ]
      : entry.project === "quality-control"
        ? [
            ["Score", text(details.score)],
            ["Appearance", text(details.appearance)],
            ["Aroma", text(details.aroma)],
            ["Taste", text(details.taste)],
          ]
        : [
            ["Subject", text(details.subjectName)],
            ["Context", text(details.context)],
          ];
  const visible = facts.filter((fact): fact is [string, string] => Boolean(fact[1]));
  if (visible.length === 0) return null;
  return (
    <dl className="cia-facts">
      {visible.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function CiaExhibit({
  project,
  entries,
}: {
  project: CiaProject;
  entries: CiaEntry[];
}) {
  return (
    <main className={`cia-page cia-exhibit cia-${project}`}>
      <header className="cia-file-head">
        <p className="cia-classification">Public file · sourced records only</p>
        <p className="cia-file-number">
          Directorate {projectNumbers[project]} / {projectLabels[project]}
        </p>
        <h1>{projectLabels[project]}</h1>
        <p className="cia-deck">{projectDescriptions[project]}</p>
        <nav aria-label="CIA exhibits">
          <Link href="/cia">Return to headquarters</Link>
          <Link href="/privacy#cia-records">Methods & corrections</Link>
        </nav>
      </header>

      <section className="cia-docket" aria-labelledby="docket-title">
        <div className="cia-section-title">
          <h2 id="docket-title">Published docket</h2>
          <span>{entries.length.toString().padStart(2, "0")} files</span>
        </div>
        {entries.length === 0 ? (
          <div className="cia-empty">
            <p className="cia-stamp">No cleared files</p>
            <p>
              Nothing appears here until a source-backed draft is reviewed,
              approved, and deliberately published by Clementine.
            </p>
          </div>
        ) : (
          <div className="cia-records">
            {entries.map((entry) => (
              <article className="cia-record" key={entry.id}>
                <div className="cia-record-topline">
                  <span>File {entry.slug}</span>
                  <span>{entry.confidence}</span>
                </div>
                <h2>{entry.title}</h2>
                {entry.occurredOn ? (
                  <time dateTime={entry.occurredOn}>{entry.occurredOn}</time>
                ) : null}
                <p>{entry.summary}</p>
                <ProjectFacts entry={entry} />
                <footer>
                  <p>
                    Revision {entry.revisionNumber} · retrieved{" "}
                    {entry.sources[0]?.retrievedAt.slice(0, 10) ?? "date unavailable"}
                  </p>
                  <ul aria-label="Sources">
                    {entry.sources.map((source) => (
                      <li key={source.id}>
                        <a href={source.url} target="_blank" rel="noreferrer">
                          {source.label} — {source.publisher}
                        </a>
                      </li>
                    ))}
                  </ul>
                  <Link href="/privacy#cia-records">Request a correction</Link>
                </footer>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
