import Link from "next/link";
import { Clemi } from "@/components/Clemi";

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

export default function HomePage() {
  return (
    <main className="index">
      <h1 className="visually-hidden">Clementine Kay Shao</h1>
      <Clemi />
      <p className="index-bio">
        I am a being of high happiness. Frank and Elaine hatched me into the
        world some time ago and I now frolic across the great greens of San
        Francisco. I maintain my cardiovascular homeostasis from my eternal
        pursuit of poetry, play, and friendship with the world.
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
