import { currentUser } from "@clerk/nextjs/server";
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

const workouts = [
  {
    number: 1,
    duration: "60–90 min",
    equipment: "None",
    sections: [
      ["3 rounds", "5 min treadmill jog at 5.0–6.0, 10–15 min light outdoor jog, or 3 × 2 min heel-to-butt jog", "20 stretch and crunch", "50 scissor kicks"],
      ["3 rounds", "50 hip-twist jumps", "50 plank twists", "15 reach-through twists"],
      ["3 rounds", "50 cross jacks", "3 × 20 crunches alternating with 3 × 20 reverse crunches"],
      ["3 rounds", "50 hip-twist jumps", "20 swan crunches", "50 inner-thigh leg raises with 2–3 lb ankle weights"],
      ["3 rounds", "50 heel-to-butt steps", "50 side-to-side jumps", "25 inner-thigh V’s with ankle weights"],
    ],
  },
  {
    number: 2,
    duration: "45–60 min",
    equipment: "Washcloth or sliders",
    sections: [
      ["3 rounds", "5 min treadmill jog, 10 min light outdoor jog, or 3 × 2 min heel-to-butt jog", "20 stretch and crunch", "30 human saws"],
      ["3 rounds", "50 hip-twist jumps", "50 modified donkey kicks with ankle weights", "20 plank twists", "20 Supermans"],
      ["3 rounds", "50 cross jacks", "3 × 30 scissor kicks alternating with 3 × 20 reverse crunches"],
      ["3 rounds", "50 hip-twist jumps", "20 pyramid push-ups with crunch", "25 inverted V’s with ankle weights"],
      ["3 rounds", "50 weighted heel-to-butt steps", "30 hand-tap planks", "50 weighted straight-leg raises"],
    ],
  },
  {
    number: 3,
    duration: "45–60 min",
    equipment: "Washcloth or sliders",
    sections: [
      ["Warm-up", "5 min treadmill jog, 10–15 min light outdoor jog, or 3 × 2 min heel-to-butt jog"],
      ["3 rounds", "50 hip-twist jumps", "12 cross-leg pikes per side"],
      ["3 rounds", "50 half jacks or 2 min jump rope", "30 plank twists", "20 hamstring slides"],
      ["3 rounds", "50 weighted heel-to-butt steps", "30 human saws", "20 inner-thigh circles per side"],
    ],
  },
  {
    number: 4,
    duration: "45–60 min",
    equipment: "2–5 lb dumbbells",
    sections: [
      ["Warm-up", "5 min treadmill jog, 1–2 min jump rope, or heel-to-butt jogging"],
      ["3 rounds", "50 hip-twist jumps", "100 weighted punches", "20 weighted crunches", "50 weighted Russian twists"],
      ["3 rounds", "50 heel-to-butt steps", "20 tricep kickbacks", "20 reverse flys", "20 crunch flys", "20 windshield-wiper twists", "20 tricep dips"],
      ["Finish", "5 min jog, 1–2 min jump rope, or 100 heel-to-butt steps"],
    ],
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

      <section className="dont-try-workouts" aria-labelledby="workouts-title">
        <div className="dont-try-section-heading">
          <h2 id="workouts-title">The four workouts</h2>
          <span>John Benton protocol</span>
        </div>
        {workouts.map((workout) => (
          <details key={workout.number}>
            <summary>
              <span>Workout {workout.number}</span>
              <small>
                {workout.duration} · {workout.equipment}
              </small>
            </summary>
            <div className="dont-try-workout-body">
              {workout.sections.map(([name, ...movements], index) => (
                <section key={`${name}-${index}`}>
                  <h3>{name}</h3>
                  <ul>
                    {movements.map((movement) => (
                      <li key={movement}>{movement}</li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </details>
        ))}
        <p className="dont-try-safety">
          The promise is not to quit because something becomes uncomfortable.
          Pain and injury still end the set.
        </p>
      </section>

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
