import type { Metadata } from "next";
import Link from "next/link";
import { DONT_TRY_WORKOUTS } from "@/lib/dont-try-workouts";

export const metadata: Metadata = {
  title: "The SWEAT Protocol",
  description: "Five daily promises for becoming someone who does what they said they would do.",
};

const pillars = [
  {
    letter: "S",
    name: "Study",
    mine: "Deeply study one poem.",
    yours: "Choose something you want to understand, then define one daily unit.",
  },
  {
    letter: "W",
    name: "Walk",
    mine: "Walk 12,000 steps.",
    yours: "Choose a distance, step count, or amount of time that makes you leave the house.",
  },
  {
    letter: "E",
    name: "Eat",
    mine: "Whole foods. No added sugar, alcohol, or recreational drugs.",
    yours: "Write a food rule simple enough to follow and specific enough to score.",
  },
  {
    letter: "A",
    name: "Act courageously",
    mine: "Do one uncomfortable, difficult, vulnerable, or scary thing.",
    yours: "Name the action you are avoiding. Courage must leave evidence.",
  },
  {
    letter: "T",
    name: "Train",
    mine: "Complete one hard workout. Work toward an eight-minute plank.",
    yours: "Choose a repeatable training practice and one result you want to move.",
  },
] as const;

const rules = [
  ["Write it first", "Define each promise before the challenge begins. Do not move the line after seeing the result."],
  ["Make it measurable", "At night, every pillar should have a plain yes or no answer."],
  ["Record the truth", "A partial or missed day is information, not a reason to hide the day."],
  ["Adjust for safety", "Discomfort is part of training. Pain, injury, and illness are not failures of courage."],
  ["Review, don’t bargain", "Notice patterns during the challenge. Save major protocol changes for the next cycle."],
] as const;

export default function SweatProtocolPage() {
  return (
    <main className="dont-try-page dont-try-protocol-page">
      <header className="dont-try-hero dont-try-protocol-hero">
        <div className="dont-try-rail">
          <Link href="/dont-try">← Field log</Link>
          <span>Version 1.0 · 2026</span>
        </div>
        <p className="dont-try-kicker">The lighter protocol</p>
        <h1>SWEAT</h1>
        <p className="dont-try-subtitle">
          Five promises for becoming someone who does what they said they would do.
        </p>
      </header>

      <section className="dont-try-protocol-letter">
        <p>Hi, friend.</p>
        <p>
          Most protocols ask you to optimize your entire life. This one asks you to keep five
          promises for one day, then wake up and do it again.
        </p>
        <p>
          The pillars always stay the same: study, walk, eat, act courageously, and train. The
          promises underneath them belong to you.
        </p>
        <p>
          Mine is a one-hundred-day experiment. Yours can be smaller. Start with rules you can
          understand, tell the truth about what happened, and let repetition do the interesting
          work.
        </p>
        <p className="dont-try-protocol-signoff">Do, don’t try. — Clementine</p>
      </section>

      <section className="dont-try-protocol" aria-labelledby="protocol-pillars">
        <div className="dont-try-section-heading">
          <h2 id="protocol-pillars">The five pillars</h2>
          <span>Fixed structure · personal promises</span>
        </div>
        <ol>
          {pillars.map((pillar) => (
            <li key={pillar.letter}>
              <span>{pillar.letter}</span>
              <div>
                <h3>{pillar.name}</h3>
                <p>
                  <strong>Mine:</strong> {pillar.mine}
                </p>
                <p className="dont-try-protocol-yours">
                  <strong>Yours:</strong> {pillar.yours}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="dont-try-protocol-rules" aria-labelledby="protocol-rules">
        <div className="dont-try-section-heading">
          <h2 id="protocol-rules">How to practice</h2>
          <span>Five rules</span>
        </div>
        <ol>
          {rules.map(([title, description], index) => (
            <li key={title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <h3>{title}</h3>
                <p>{description}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="dont-try-protocol-day" aria-labelledby="protocol-day">
        <div className="dont-try-section-heading">
          <h2 id="protocol-day">One day on the protocol</h2>
          <span>Use any order</span>
        </div>
        <div>
          <p><span>Morning</span> Read the five promises. Decide when each one will happen.</p>
          <p><span>Day</span> Do the work. Capture only the evidence you will need to score it.</p>
          <p><span>Evening</span> Mark each pillar complete, partial, or missed. Add one honest note.</p>
          <p><span>Next morning</span> Begin again without punishment, catch-up, or mythology.</p>
        </div>
      </section>

      <section className="dont-try-workouts" aria-labelledby="workouts-title">
        <div className="dont-try-section-heading">
          <h2 id="workouts-title">My training rotation</h2>
          <span>Four workouts · John Benton</span>
        </div>
        {DONT_TRY_WORKOUTS.map((workout) => (
          <details key={workout.number}>
            <summary>
              <span>Workout {workout.number}</span>
              <small>{workout.duration} · {workout.equipment}</small>
            </summary>
            <div className="dont-try-workout-body">
              {workout.sections.map(([name, ...movements], index) => (
                <section key={`${name}-${index}`}>
                  <h3>{name}</h3>
                  <ul>
                    {movements.map((movement) => <li key={movement}>{movement}</li>)}
                  </ul>
                </section>
              ))}
            </div>
          </details>
        ))}
        <p className="dont-try-safety">
          This is my reference, not medical advice. Adapt training to your body and stop for pain
          or injury.
        </p>
      </section>

      <section className="dont-try-protocol-copy">
        <p className="dont-try-kicker">Make it yours</p>
        <h2>Keep SWEAT.<br />Rewrite the promises.</h2>
        <p>
          Pick a duration. Write one measurable promise beneath each pillar. Keep a visible,
          honest record. That is the whole protocol.
        </p>
        <Link href="/dont-try">See the field log →</Link>
      </section>

      <footer className="dont-try-footer">
        <p>STUDY.</p>
        <p>WALK.</p>
        <p>EAT.</p>
        <p>ACT.</p>
        <p>TRAIN.</p>
      </footer>
    </main>
  );
}
