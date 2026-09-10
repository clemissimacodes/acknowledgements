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
    promise: "Study 1 poem deeply.",
  },
  {
    letter: "W",
    name: "Walk",
    promise: "Walk 12,000 steps at the very least.",
  },
  {
    letter: "E",
    name: "Eat",
    promise: "Eat whole foods only. No added sugar, no ultra-processed foods, no alcohol.",
  },
  {
    letter: "A",
    name: "Act courageously",
    promise: "Act on one uncomfortable, difficult, vulnerable, or scary thing. I expect this usually to be emotional rather than physical.",
  },
  {
    letter: "T",
    name: "Train",
    promise: "Complete one HAF (hard as f) workout of my choice.",
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
          <Link href="/secrets/dont-try/protocol">SWEAT protocol</Link>
          <span>September 10 — December 18, 2026</span>
        </div>
        <h1>DON’T TRY</h1>
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
        <p className="dont-try-statement">
          I&apos;m a model, which means I&apos;m pretty in shape. It also means
          I&apos;ve become too comfortable with mediocrity in mindset and
          training, because I look like I&apos;m in shape. In actuality,
          I&apos;m abandoning sets at the gym and scrimping on my workouts. I
          despise this feeling of not doing what I set out to do, so this is my
          way of proving myself that when I try to do something, I don&apos;t
          just try, I do.
        </p>
      </section>

      <section className="dont-try-protocol" aria-labelledby="sweat-title">
        <div className="dont-try-section-heading">
          <h2 id="sweat-title">SWEAT daily.</h2>
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
        <Link className="dont-try-protocol-link" href="/secrets/dont-try/protocol">
          Read the full protocol →
        </Link>
      </section>

      <section className="dont-try-ledger" aria-labelledby="ledger-title">
        <div className="dont-try-section-heading">
          <h2 id="ledger-title">Ledger</h2>
        </div>
        <dl>
          {statItems.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <DontTryLog
        entries={entries}
        ownerEntries={ownerEntries}
        currentDay={day}
        canEdit={canEdit}
      />

    </main>
  );
}
