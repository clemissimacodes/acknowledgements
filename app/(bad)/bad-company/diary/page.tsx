import type { Metadata } from "next";
import { Ballet, Bodoni_Moda, EB_Garamond } from "next/font/google";
import Link from "next/link";
import { BAD_PATH, BAD_SHOP_NAME, listEnemies } from "@/lib/bad-company";

export const dynamic = "force-dynamic";

const script = Ballet({ subsets: ["latin"], weight: "400", display: "swap", variable: "--ff-script" });
const didone = Bodoni_Moda({ subsets: ["latin"], weight: "400", display: "swap", variable: "--ff-didone" });
const garamond = EB_Garamond({
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--ff-garamond",
});

export const metadata: Metadata = {
  title: "Studio Diary: Bad Company",
  description: "A Black Friday grudge, dressed as a clearance rack.",
};

const LETTER: Array<{ before: string; pull: string } | { body: string; closing?: boolean }> = [
  {
    before:
      "Good Company is the front of the store: the window display, the soft lighting, the people I would carry out of a burning building. Every store also has a back room. This is mine.",
    pull: "I am grateful for so many people. These are not them.",
  },
  {
    body: "Some people polish you like a river stone. Others are a pebble in your shoe for six to eight business years. I have been very gracious about the pebbles. I have smiled at the pebbles at parties. I have said \u201Cno worries!\u201D to the pebbles. There were worries.",
  },
  {
    body: "Nothing here is for sale, because nobody would buy it. Every item is final sale, one of one, and has been tried on more times than I would like to admit. I am not sorry. I am, at most, a little sorry.",
  },
  {
    body: "To everyone on this rack: thank you for teaching me exactly what kind of friend I don\u2019t want to be. That is the only thank-you you are getting.",
    closing: true,
  },
];

export default async function BadCompanyDiary() {
  const count = (await listEnemies()).length;
  const total = String(LETTER.length).padStart(2, "0");

  return (
    <main className={`ff-diary ${script.variable} ${didone.variable} ${garamond.variable}`}>
      <section className="ff-diary-hero" aria-label="Studio Diary">
        <div className="ff-diary-pane ff-diary-pane-left">
          <span className="ff-diary-scrawl" aria-hidden="true">
            $0
          </span>
        </div>
        <div className="ff-diary-pane ff-diary-pane-right">
          <div className="ff-diary-ghost" aria-hidden="true">
            <span>GOOD</span>
            <span>COMPANY</span>
          </div>
          <p className="ff-diary-script">Enemies &amp; Acquaintances</p>
          <ul className="ff-diary-bottom">
            <li>Anywhere but here</li>
            <li>clemissima.com</li>
            <li>{count} listings · 0 wanted</li>
          </ul>
        </div>
      </section>

      <article className="ff-diary-body">
        <header className="ff-diary-mast">
          <p className="ff-diary-tagline">Studio Diary</p>
          <h1 className="ff-diary-h1">{BAD_SHOP_NAME}</h1>
          <p className="ff-diary-index">01 — {total}</p>
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
                    <span>{total}</span>
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
                    <p className={`ff-diary-plate-p${closing ? " ff-diary-plate-p-close" : ""}`}>{part.body}</p>
                  )}
                </div>
              </section>
            );
          })}
        </div>

        <p className="ff-diary-cta">
          <Link href={BAD_PATH}>Browse the clearance rack</Link>
        </p>
      </article>
    </main>
  );
}
