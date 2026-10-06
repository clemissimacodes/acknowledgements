import Link from "next/link";
import { TeenyQuestionOrb } from "@/components/about/TeenyQuestionOrb";

export const metadata = {
  title: "Stick ur nose in · Control room",
};

// The "ur welcome to stick ur nose in too" orb, parked here while it is off
// the home page. Questions still land in /controlroom/teeny-questions.
export default function NoseOrbPage() {
  return (
    <main className="admin-page admin-nose">
      <header className="admin-head">
        <div>
          <p className="admin-eyebrow">
            <Link href="/controlroom">Control room</Link> · parked
          </p>
          <h1>Stick ur nose in</h1>
          <p className="admin-private">
            Off the home page for now. It still works here; anything asked
            lands in <Link href="/controlroom/teeny-questions">teeny tiny questions</Link>.
          </p>
        </div>
      </header>
      <div className="admin-nose-orb">
        <TeenyQuestionOrb />
      </div>
    </main>
  );
}
