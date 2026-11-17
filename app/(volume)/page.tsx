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
        Francisco and, when the wind is right,{" "}
        <Link href="/places">a good deal farther</Link>. I maintain my
        cardiovascular homeostasis from my eternal pursuit of{" "}
        <Link href="/poetry">poetry</Link>,{" "}
        <Link href="/teeny-tiny-things">play</Link>, and{" "}
        <Link href="/ask">friendship with the world</Link>. In between I{" "}
        <Link href="/voice-memos">think out loud</Link>,{" "}
        <a href={MODELING} target="_blank" rel="noreferrer">
          hold very still for cameras
        </a>
        , <Link href="/blow-on-a-fat-dandelion">make wishes on weeds</Link>, and{" "}
        <Link href="/secrets">keep a few things to myself</Link>.
      </p>
      <p className="index-bio">
        Message me on X{" "}
        <a href="https://x.com/clemissima" target="_blank" rel="noreferrer">
          @clemissima
        </a>{" "}
        - I’m always open to new friends
        <RotatingWords words={friendThings} prefix="to" suffix="with." />
      </p>
    </main>
  );
}
