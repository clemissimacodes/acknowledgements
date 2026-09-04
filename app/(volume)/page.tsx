import Link from "next/link";
import { MailLink } from "@/components/MailLink";

const works = [
  { title: "Acknowledgements", href: "/acknowledgements" },
  {
    title: "Modeling",
    href: "https://www.lookmodelagency.com/divisions/new-faces/portfolios/clementine/portfolio",
    external: true,
  },
  { title: "Poetry", href: "/poetry" },
  { title: "Blow on a Fat Dandelion", href: "/dandelion" },
  { title: "Sunday Posties", href: "/sunday-posties" },
];

export default function HomePage() {
  return (
    <main className="index">
      <h1 className="visually-hidden">Clementine Kay Shao</h1>
      <img
        className="index-portrait"
        src="/clementine.png"
        alt="A drawing of Clementine in a clementine hood with rabbit ears"
      />
      <p className="index-bio">
        I am a being of high happiness. Frank and Elaine hatched me into the
        world some time ago and I now frolic across great green parks in San
        Francisco and New York. I maintain my cardiovascular homeostasis from my
        eternal pursuit of poetry, play, and friendship with the world.
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
      <nav className="elsewhere" aria-label="Elsewhere">
        <a
          href="https://www.instagram.com/clemissima/"
          target="_blank"
          rel="noreferrer"
          aria-label="Instagram"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <rect
              x="3.4"
              y="3.4"
              width="17.2"
              height="17.2"
              rx="5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <circle
              cx="12"
              cy="12"
              r="4.1"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <circle cx="17.15" cy="6.85" r="1.05" fill="currentColor" />
          </svg>
        </a>
        <a
          href="https://x.com/clemissima"
          target="_blank"
          rel="noreferrer"
          aria-label="Twitter"
        >
          <svg viewBox="0 0 24 24" width="17" height="18" aria-hidden="true">
            <path
              d="M4.2 4.2 10.9 12.3 4.4 19.8h3.2l5.2-6.1 5.3 6.1h3.1l-7-8.1 6.3-7.5h-3.2l-4.9 5.7L7.4 4.2H4.2z"
              fill="currentColor"
            />
          </svg>
        </a>
        <MailLink aria-label="Email Clementine">
          <svg viewBox="0 0 24 24" width="19" height="18" aria-hidden="true">
            <rect
              x="3.2"
              y="5.6"
              width="17.6"
              height="12.8"
              rx="1.6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path
              d="M4.4 7.2 12 13.1 19.6 7.2"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
        </MailLink>
      </nav>
    </main>
  );
}
