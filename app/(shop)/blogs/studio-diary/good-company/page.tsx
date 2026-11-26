import type { Metadata } from "next";
import Link from "next/link";
import { SHOP_HANDLE, SHOP_NAME } from "@/lib/friend-types";
import { listFriends } from "@/lib/friends";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Studio Diary: Good Company",
  description: "How a Black Friday sale of my friends and family came to be, and how to shop it.",
};

type QA = { q: string; a: string };

const QA: QA[] = [
  {
    q: "What is this?",
    a: "A Black Friday sale where every product is a real person in my life. The site is built to look like a fashion store on purpose: a grid, a product page for each listing, a bag, a checkout. The inventory is my friends and my family.",
  },
  {
    q: "Why does it look like a store?",
    a: "Because on Black Friday the internet puts a price on everything, and I wanted to see what it would feel like to do that to the only things I actually can\u2019t buy. It turns out a product page is a very good format for paying attention to someone.",
  },
  {
    q: "Why are the prices so strange?",
    a: "The price is the date we met, read as dollars. September 15 is $915. December 24 is $1,224. It isn\u2019t a valuation and it isn\u2019t negotiable. It is the one number about a friendship that never changes, which makes it the only honest price tag I could think of.",
  },
  {
    q: "What happens when I check out?",
    a: "You get a receipt. Nothing is charged and nothing ships. The receipt has a link you can send to the people on it, or to anyone. That is the whole transaction: a way to say, out loud and itemized, these are the people I would pay anything for.",
  },
  {
    q: "What is on a listing?",
    a: "Only true things. My nickname for them and their real name. Where they\u2019re from, under Made In. How we met. The season we met, filed as a collection, the way a store would say Fall 2024. A trait I love and a memory I keep. A poem by someone else that reminds me of them, under Pairs Well With.",
  },
  {
    q: "What do Friend and Family mean?",
    a: "They are the two sizes. Friend: I will pick you up from the airport. Family: I will pick you up from the airport at 5 a.m. and not bring it up again. Each listing comes in exactly one of these, and the other is marked sold out.",
  },
  {
    q: "What are the eras?",
    a: "Where I was when we met. Childhood, Vanderbilt, San Francisco, New York City. New Arrivals is for the people I\u2019ve met most recently. It is the front table.",
  },
  {
    q: "Can I buy someone?",
    a: "No. Nothing is for sale and no one ever was. You can put them in your bag, which is a different thing: it means you would, if you could.",
  },
  {
    q: "I\u2019m on here. Can I change it?",
    a: "Yes. Anything edited or taken down, immediately and without questions. Text me. If you\u2019re on here, you have my number.",
  },
  {
    q: "Why Good Company?",
    a: "Because that is what the inventory is, literally, and because it is the receipt line I wanted: you\u2019re in good company.",
  },
];

export default async function GoodCompanyDiary() {
  const friends = await listFriends();
  const count = friends.length;
  const family = friends.filter((f) => f.relationship === "Family").length;
  const hometowns = new Set(friends.map((f) => f.hometown).filter(Boolean)).size;

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
          <dl className="ff-diary-credits">
            <div>
              <dt>Concept &amp; Words</dt>
              <dd>Clementine Shao</dd>
            </div>
            <div>
              <dt>Inventory</dt>
              <dd>{count} people</dd>
            </div>
            <div>
              <dt>After</dt>
              <dd>Orseund Iris</dd>
            </div>
          </dl>
          <ul className="ff-diary-bottom">
            <li>San Francisco → New York</li>
            <li>clemissima.com</li>
            <li>Black Friday &rsquo;26 Collection</li>
          </ul>
        </div>
      </section>

      <article className="ff-diary-body">
        <p className="ff-diary-tagline">Studio Diary:</p>
        <h1 className="ff-diary-h1">{SHOP_NAME}</h1>
        <hr className="ff-diary-rule" />

        <p className="ff-diary-lede">
          <span className="ff-diary-dropcap" aria-hidden="true">
            E
          </span>
          very year on the last Friday of November the internet prices everything it can find. This year I
          did too. Good Company is a store where every product is a real person I love, listed the way a
          store would list a shirt: a title, a hero image, a description, the materials, where it was made,
          and a price. {count} listings. {family} of them family. {hometowns} hometowns. Nothing for sale.
        </p>

        <p className="ff-diary-p">
          What follows is the only interview I could get on short notice, which is to say with myself. The
          answers are the premise. If you only read one, read the third.
        </p>

        <div className="ff-diary-qa-grid">
          {QA.slice(0, 2).map((item, index) => (
            <Question key={item.q} n={index + 1} {...item} />
          ))}
        </div>

        <p className="ff-diary-p">
          The site borrows its bones from a real one. The cream paper, the thin grotesk, the italic serif for
          the names, the scrawled price, the three-column product page: all of it is an homage to a shop I
          love, because the joke only works if the store is convincing. Everything in it, though, is true.
        </p>

        <div className="ff-diary-qa-grid">
          {QA.slice(2, 4).map((item, index) => (
            <Question key={item.q} n={index + 3} {...item} />
          ))}
        </div>

        <div className="ff-diary-qa-grid">
          {QA.slice(4, 6).map((item, index) => (
            <Question key={item.q} n={index + 5} {...item} />
          ))}
        </div>

        <p className="ff-diary-p">
          A note on the receipts. They are the point. When you check out, the people in your bag are printed
          on a receipt with an order number, a subtotal, a Black Friday discount of zero, and a link. Send it
          to them. Send it to someone else. It is a very small way to make a list of who you&rsquo;d keep, on
          the one day of the year the world is mostly making lists of what it wants.
        </p>

        <div className="ff-diary-qa-grid">
          {QA.slice(6, 8).map((item, index) => (
            <Question key={item.q} n={index + 7} {...item} />
          ))}
        </div>

        <div className="ff-diary-qa-grid">
          {QA.slice(8, 10).map((item, index) => (
            <Question key={item.q} n={index + 9} {...item} />
          ))}
        </div>

        <dl className="ff-diary-colophon">
          <div>
            <dt>Concept &amp; words:</dt>
            <dd>Clementine Shao</dd>
          </div>
          <div>
            <dt>Inventory:</dt>
            <dd>
              <Link href={`/collections/${SHOP_HANDLE}`}>{count} friends and family</Link>
            </dd>
          </div>
          <div>
            <dt>Poems:</dt>
            <dd>
              <a href="https://www.poetryfoundation.org" target="_blank" rel="noreferrer">
                Poetry Foundation
              </a>
            </dd>
          </div>
          <div>
            <dt>Design after:</dt>
            <dd>
              <a href="https://orseundiris.com" target="_blank" rel="noreferrer">
                Orseund Iris
              </a>
            </dd>
          </div>
        </dl>

        <p className="ff-diary-cta">
          <Link href={`/collections/${SHOP_HANDLE}`}>Shop the collection</Link>
          <span aria-hidden="true"> &amp; </span>
          <Link href="/collections/new-arrivals">the New Arrivals</Link>
        </p>
      </article>
    </main>
  );
}

function Question({ n, q, a }: QA & { n: number }) {
  return (
    <div className="ff-diary-qa">
      <span className="ff-diary-num" aria-hidden="true">
        {n}.
      </span>
      <div className="ff-diary-qa-text">
        <p className="ff-diary-q">{q}</p>
        <p className="ff-diary-a">&ldquo;{a}&rdquo;</p>
      </div>
    </div>
  );
}
