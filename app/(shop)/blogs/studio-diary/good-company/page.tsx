import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { SHOP_HANDLE, SHOP_NAME } from "@/lib/friend-types";
import { listFriends } from "@/lib/friends";

export const metadata: Metadata = {
  title: "Studio Diary: Good Company",
  description: "A Black Friday love letter to my friends and family, dressed as a store.",
};

function Person({ slug, children }: { slug: string; children: ReactNode }) {
  return (
    <Link href={`/products/${slug}`} className="ff-diary-person">
      {children}
    </Link>
  );
}

const LETTER: Array<
  | { before: string; pull: string }
  | { body: ReactNode; closing?: boolean }
> = [
  {
    before:
      "It\u2019s difficult for me to impress on others how ludicrous my year has been. I see myself often as just a little girl still, lacking the hardiness needed to reckon with the supposed cruelty and danger of the world. So much of my fear evaporates when the good people in my life surround me like they do.",
    pull: "I sit like an exposed river stone, and the steady thrush of my friends and family\u2019s love spilling over me, hushing me, consoling me, striking courage in me, has polished me into the woman I am now.",
  },
  {
    body: (
      <>
        I owe everything to the people in my life. There are long golden lifetime friends, like{" "}
        <Person slug="baby-cow">Nick Gebo</Person> and <Person slug="ray">Ray</Person> and my dear
        brothers <Person slug="billiam">Billiam</Person> and <Person slug="dandan">Dandan</Person>, who
        are so very special, but there are also electric new friends that shine a little indigo in my
        soul, whom I have only met this year, like <Person slug="paulio">Paulio</Person> and{" "}
        <Person slug="max">Max</Person> and <Person slug="max-loeffler">the other Max</Person> and my new
        roommate <Person slug="hubby">Arden</Person>. My friends are all so very different and I adore
        each of them more than I let on.
      </>
    ),
  },
  {
    body: "I\u2019ve been taught many a thing about friendship, as well. I have been told by 2 different friends this year that I was not meeting their standard for friendship, and oh golly gee did I step it up. I\u2019m proud of this, too, for having no ego or pride or fear in friendship. I care to be a good friend, and I think it\u2019s made me a better Clem overall.",
  },
  {
    body: "Thank you to all my friends for spending time in your life partaking in mine. I pledge my allegiance and affection and sparkles to you!",
    closing: true,
  },
];

export default async function GoodCompanyDiary() {
  const friends = await listFriends();
  const count = friends.length;

  return (
    <main className="ff-diary">
      <section className="ff-diary-hero" aria-label="Studio Diary">
        <div className="ff-diary-pane ff-diary-pane-left">
          <span className="ff-diary-scrawl" aria-hidden="true">
            $915
          </span>
        </div>
        <div className="ff-diary-pane ff-diary-pane-right">
          <div className="ff-diary-ghost" aria-hidden="true">
            <span>GOOD</span>
            <span>COMPANY</span>
          </div>
          <p className="ff-diary-script">Friends &amp; Family</p>
          <ul className="ff-diary-bottom">
            <li>San Francisco → New York</li>
            <li>clemissima.com</li>
            <li>{count} listings · 0 for sale</li>
          </ul>
        </div>
      </section>

      <article className="ff-diary-body">
        <header className="ff-diary-mast">
          <p className="ff-diary-tagline">Studio Diary</p>
          <h1 className="ff-diary-h1">{SHOP_NAME}</h1>
          <p className="ff-diary-index">01 — 04</p>
        </header>

        <div className="ff-diary-letter">
          {LETTER.map((part, index) => {
            const n = String(index + 1).padStart(2, "0");
            const align = index % 2 === 0 ? "left" : "right";
            const closing = "closing" in part && part.closing;
            return (
              <section
                key={n}
                className={`ff-diary-plate ff-diary-plate-${align}${closing ? " ff-diary-plate-close" : ""}`}
              >
                <span className="ff-diary-plate-num" aria-hidden="true">
                  {n}
                </span>
                <div className="ff-diary-plate-copy">
                  <p className="ff-diary-plate-meta">
                    <span>{n}</span>
                    <span aria-hidden="true">/</span>
                    <span>04</span>
                  </p>
                  {"before" in part ? (
                    <>
                      <p className="ff-diary-plate-p">
                        <span className="ff-diary-dropcap" aria-hidden="true">
                          {part.before.charAt(0)}
                        </span>
                        {part.before.slice(1)}
                      </p>
                      <blockquote className="ff-diary-plate-pull">{part.pull}</blockquote>
                    </>
                  ) : (
                    <p className={`ff-diary-plate-p${closing ? " ff-diary-plate-p-close" : ""}`}>
                      {part.body}
                    </p>
                  )}
                </div>
              </section>
            );
          })}
        </div>

        <p className="ff-diary-cta">
          <Link href={`/collections/${SHOP_HANDLE}`}>Shop the collection</Link>
        </p>
      </article>
    </main>
  );
}
