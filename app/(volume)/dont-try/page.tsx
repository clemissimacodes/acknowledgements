import { currentUser } from "@clerk/nextjs/server";
import Link from "next/link";
import { DontTryLog } from "@/components/dont-try/DontTryLog";
import { isAdminUser } from "@/lib/admin";
import {
  calculateDontTryStats,
  currentDontTryDay,
  DONT_TRY_DAYS,
  getDontTryEntries,
  type DontTryEntry,
} from "@/lib/dont-try";

export const metadata = {
  title: "DON’T TRY",
  description: "One hundred days of doing what I said I would do.",
};

const pillars = [
  {
    letter: "S",
    name: "Study",
    promise: "Deeply study one poem every day.",
  },
  {
    letter: "W",
    name: "Walk",
    promise: "Walk 12,000 steps every day.",
  },
  {
    letter: "E",
    name: "Eat",
    promise: "Whole foods. No added sugar, alcohol, or recreational drugs.",
  },
  {
    letter: "A",
    name: "Act courageously",
    promise: "Do one uncomfortable, difficult, vulnerable, or scary thing.",
  },
  {
    letter: "T",
    name: "Train",
    promise: "Complete one hard workout. Work toward an eight-minute plank.",
  },
] as const;

function plankTime(seconds: number | null) {
  if (seconds === null) return "—";
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export default async function DontTryPage() {
  const user = await currentUser();
  const canEdit = isAdminUser(user);
  let entries: DontTryEntry[] = [];
  let ownerEntries: DontTryEntry[] = [];

  try {
    ownerEntries = canEdit ? await getDontTryEntries(true) : [];
    entries = canEdit
      ? ownerEntries.filter((entry) => entry.publishedAt)
      : await getDontTryEntries();
  } catch {
    // The public explanation can remain available during a database outage.
  }

  const day = currentDontTryDay();
  const stats = calculateDontTryStats(entries);
  const progress = Math.round((day / DONT_TRY_DAYS) * 100);
  const statItems = [
    ["Recorded", `${stats.publishedDays} / ${day}`],
    ["Study", `${stats.studyDays} / ${stats.publishedDays}`],
    ["Walk", `${stats.walkDays} / ${stats.publishedDays}`],
    ["Eat", `${stats.eatDays} / ${stats.publishedDays}`],
    ["Act", `${stats.actDays} / ${stats.publishedDays}`],
    ["Train", `${stats.trainDays} / ${stats.publishedDays}`],
    ["Current plank", plankTime(stats.currentPlankSeconds)],
    ["Longest plank", plankTime(stats.longestPlankSeconds)],
    ["Total steps", stats.totalSteps.toLocaleString()],
    ["Sets abandoned", String(stats.setsAbandoned)],
  ];

  return (
    <main className="dont-try-page">
      <header className="dont-try-hero">
        <div className="dont-try-rail" aria-label="Challenge details">
          <Link href="/dont-try/protocol">SWEAT protocol</Link>
          <span>September 10 — December 18, 2026</span>
        </div>
        <p className="dont-try-kicker">A one-hundred-day field log</p>
        <h1>DON’T TRY</h1>
        <p className="dont-try-subtitle">
          One hundred days of doing what I said I would do.
        </p>
        <div className="dont-try-progress-copy">
          <span>Day {String(day).padStart(2, "0")} / 100</span>
          <span>{progress}%</span>
        </div>
        <div
          className="dont-try-progress"
          role="progressbar"
          aria-label="One hundred day progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
        >
          <span style={{ width: `${progress}%` }} />
        </div>
      </header>

      <section className="dont-try-premise">
        <p className="dont-try-pullquote">Someone once told me: don’t try. Do.</p>
        <p>
          My weakness is consistency. I can be intensely motivated in spurts,
          but I want to become someone who does what she said she would do when
          motivation disappears.
        </p>
        <p>
          This is an experiment in whether discipline can become habitual:
          one hundred days, five promises, and no hiding the record.
        </p>
      </section>

      <section className="dont-try-protocol" aria-labelledby="sweat-title">
        <div className="dont-try-section-heading">
          <h2 id="sweat-title">The SWEAT protocol</h2>
          <span>Five promises, daily</span>
        </div>
        <ol>
          {pillars.map((pillar) => (
            <li key={pillar.letter}>
              <span>{pillar.letter}</span>
              <div>
                <h3>{pillar.name}</h3>
                <p>{pillar.promise}</p>
              </div>
            </li>
          ))}
        </ol>
        <Link className="dont-try-protocol-link" href="/dont-try/protocol">
          Read the full protocol →
        </Link>
      </section>

      <section className="dont-try-ledger" aria-labelledby="ledger-title">
        <div className="dont-try-section-heading">
          <h2 id="ledger-title">Ledger</h2>
          <span>Published records only</span>
        </div>
        <dl>
          {statItems.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <p className="dont-try-honesty">
          Success is not a perfect record. Success is an accurate record.
        </p>
      </section>

      <DontTryLog
        entries={entries}
        ownerEntries={ownerEntries}
        currentDay={day}
        canEdit={canEdit}
      />

      <section className="dont-try-results" aria-labelledby="results-title">
        <div className="dont-try-section-heading">
          <h2 id="results-title">Results</h2>
          <span>{day < 100 ? "Locked until Day 100" : "Day 100"}</span>
        </div>
        <p>
          {day < 100
            ? "The final record stays closed until the experiment is complete."
            : "What changed, what did not, and what I learned will live here."}
        </p>
      </section>

      <footer className="dont-try-footer">
        <p>DON’T TRY.</p>
        <p>100 DAYS.</p>
        <p>JUST DO.</p>
      </footer>
    </main>
  );
}
