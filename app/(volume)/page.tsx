import Link from "next/link";
import { Clemi } from "@/components/Clemi";
import { RotatingWords } from "@/components/RotatingWords";

const friendThings = [
  "wobble",
  "blabber",
  "go on very very very very very long walks",
  "attempt healthy recipes",
  "eat kbbq",
  "dance to reggaeton",
  "try martial arts",
  "philosophize about love",
  "be terrible and sad",
  "hoop at the panhandle",
  "scuttle around golden gate park",
  "lift tiny weights at equinox",
  "play pranks",
  "watch san francisco’s clouds shapeshift",
  "doodle strangers",
  "ride the bart with no end destination in mind",
  "study poetry",
  "force myself to do yoga",
] as const;

const MODELING =
  "https://www.lookmodelagency.com/divisions/new-faces/portfolios/clementine/portfolio";

const updatedAt = new Date(process.env.SITE_UPDATED_AT ?? Date.now());

function formatUpdated(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Los_Angeles",
  }).format(date);
}

export default function HomePage() {
  return (
    <main className="index">
      <h1 className="visually-hidden">Clementine Kay Shao</h1>
      <Clemi />
      <time className="index-updated" dateTime={updatedAt.toISOString()}>
        Updated {formatUpdated(updatedAt)}
      </time>
      <p className="index-bio">
        I am a being of high happiness. Frank and Elaine hatched me into the
        world some time ago and I now frolic across the great greens of San
        Francisco and, when the wind is right, across{" "}
        <Link href="/places">different countrysides around the planet</Link>. I
        maintain my cardiovascular homeostasis from my eternal pursuit of{" "}
        <Link href="/poetry">poetry</Link>,{" "}
        <Link href="/teeny-tiny-things">play</Link>, and{" "}
        <Link href="/ask">friendship with this wonderful world</Link>.
      </p>
      <p className="index-bio">
        I often think out loud and like to record{" "}
        <Link href="/voice-memos">voice memos</Link> as a palimpsest of growth.
        I also got randomly scouted to model this year, so I guess I do{" "}
        <a href={MODELING} target="_blank" rel="noreferrer">
          runways and brand shoots
        </a>
        . I feel lucky to be living a dream of a life - it might have something
        to do with my habit of{" "}
        <Link href="/blow-on-a-fat-dandelion">
          wishing on all the fat dandelions
        </Link>{" "}
        I come across. My secret to my life is{" "}
        <Link href="/secrets">here</Link>.
      </p>
      <p className="index-bio">
        You can message me{" "}
        <a href="https://x.com/clemissima" target="_blank" rel="noreferrer">
          @clemissima
        </a>{" "}
        everywhere - I’m always open to give advice or make new friends{" "}
        <RotatingWords words={friendThings} prefix="to" suffix="with." />
      </p>
    </main>
  );
}
