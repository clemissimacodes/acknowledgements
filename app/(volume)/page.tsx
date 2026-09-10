import Link from "next/link";
import { Clemi } from "@/components/Clemi";
import { MailLink } from "@/components/MailLink";

const works = [
  { title: "Teeny Tiny Things", href: "/teeny-tiny-things" },
  {
    title: "Modeling",
    href: "https://www.lookmodelagency.com/divisions/new-faces/portfolios/clementine/portfolio",
    external: true,
  },
  { title: "Poetry", href: "/poetry" },
  { title: "Blow on a Fat Dandelion", href: "/dandelion" },
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
        <a
          href="https://open.spotify.com/user/au0r1e82mxbofd2on3lvztrkr?si=d00695766b5e4ed1"
          target="_blank"
          rel="noreferrer"
          aria-label="Spotify"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <circle
              cx="12"
              cy="12"
              r="9"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path
              d="M7.2 9.2c3.7-1 7.4-.6 10.2.9M7.9 12.2c3-.8 6.2-.5 8.7.8M8.5 15.1c2.5-.6 5-.3 7 .6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.45"
              strokeLinecap="round"
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
        <Link className="index-privacy" href="/privacy">
          privacy
        </Link>
      </nav>
    </main>
  );
}
