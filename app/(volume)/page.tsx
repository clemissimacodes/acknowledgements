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
] as const;

const works = [
  { title: "Teeny Tiny Things", href: "/teeny-tiny-things" },
  {
    title: "Modeling",
    href: "https://www.lookmodelagency.com/divisions/new-faces/portfolios/clementine/portfolio",
    external: true,
  },
  { title: "Poetry", href: "/poetry" },
  { title: "Voice Memos", href: "/voice-memos" },
  { title: "Leave a Note", href: "/ask" },
  { title: "Blow on a Fat Dandelion", href: "/blow-on-a-fat-dandelion" },
  { title: "Secrets", href: "/secrets" },
];

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
        Francisco. I maintain my cardiovascular homeostasis from my eternal
        pursuit of <Link href="/poetry">poetry</Link>,{" "}
        <Link href="/teeny-tiny-things">play</Link>, and{" "}
        <Link href="/ask">friendship with the world</Link>. Message me on X{" "}
        <a href="https://x.com/clemissima" target="_blank" rel="noreferrer">
          @clemissima
        </a>{" "}
        - I’m always open to new friends to <RotatingWords words={friendThings} />{" "}
        with.
      </p>
      <nav className="toc" aria-label="Contents">
        <h2>Contents</h2>
        <ol>
          {works.map((work) => (
            <li key={work.href}>
              {work.external ? (
                <a href={work.href} target="_blank" rel="noreferrer">
                  {work.title}
                </a>
              ) : (
                <Link href={work.href}>{work.title}</Link>
              )}
            </li>
          ))}
        </ol>
      </nav>
    </main>
  );
}
