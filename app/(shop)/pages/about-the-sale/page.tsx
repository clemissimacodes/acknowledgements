import type { Metadata } from "next";
import Link from "next/link";
import { SHOP_HANDLE } from "@/lib/friend-types";

export const metadata: Metadata = { title: "About the Sale" };

export default function AboutTheSale() {
  return (
    <main className="ff-page">
      <p className="ff-crumbs">
        <Link href={`/collections/${SHOP_HANDLE}`}>Home</Link>
        <span className="ff-crumb-sep" aria-hidden="true">&gt;</span>
        <em>About the Sale</em>
      </p>
      <h1 className="ff-title">About the Sale</h1>
      <div className="ff-prose">
        <p>
          Every Black Friday the internet puts a price on everything. This year I did too. Every item in
          this shop is a person I love, listed the way a store would list a pant: a hero photo, a
          description, care instructions, a colorway, a price.
        </p>
        <p>
          The price is the day we met. September 15th is $915. It has never been discounted and it never
          will be, because it only ever goes up from there.
        </p>
        <p>
          You can add people to your bag. You can check out. You will receive a receipt. Nothing ships,
          nothing is charged, and all sales are final — they were final the day we met.
        </p>
        <p>
          If you are on here: hi. I made you a product page. If you aren’t yet and think you should be,{" "}
          <Link href="/pages/apply">apply</Link>.
        </p>
        <p className="ff-prose-sig">— Clementine</p>
      </div>
    </main>
  );
}
