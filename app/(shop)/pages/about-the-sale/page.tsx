import type { Metadata } from "next";
import Link from "next/link";
import { SHOP_HANDLE } from "@/lib/friend-types";

export const metadata: Metadata = { title: "The Premise" };

export default function AboutTheSale() {
  return (
    <main className="ff-page">
      <p className="ff-crumbs">
        <Link href={`/collections/${SHOP_HANDLE}`}>Home</Link>
        <span className="ff-crumb-sep" aria-hidden="true">&gt;</span>
        <em>The Premise</em>
      </p>
      <h1 className="ff-title">The Premise</h1>
      <div className="ff-prose">
        <p>
          Good Company is a Black Friday sale where every product is a real person in my life. It is built to
          look like a fashion e-commerce site on purpose: a grid of listings, a product page for each one,
          a bag, a checkout. The difference is that the inventory is my friends and my family.
        </p>
        <p>
          Each listing has the things a listing would have, filled in truthfully. My nickname for them.
          Where they&rsquo;re from. How we met. The date we met. A trait I love, a memory I keep, and a poem by
          someone else that reminds me of them.
        </p>
        <p>
          The price is the date we met, read as dollars. September 15 is $915; December 24 is $1,224. It
          isn&rsquo;t a valuation and it isn&rsquo;t negotiable. It is the one number about a friendship that
          never changes, which makes it the only honest price tag I could think of.
        </p>
        <p>
          You can add people to your bag and check out. You will get a receipt with a link you can send to
          them or to anyone. No money moves, nothing ships, and nobody is actually for sale. The receipt is
          the point: a way to say, on the day the internet puts a price on everything, these are the people
          I would pay anything for.
        </p>
        <p>
          If you are listed here: hi. I made you a product page. If you want it changed or taken down, tell
          me and it&rsquo;s done. If you aren&rsquo;t listed and think you should be,{" "}
          <Link href="/pages/apply">apply</Link>.
        </p>
        <p className="ff-prose-sig">— Clementine</p>
      </div>
    </main>
  );
}
