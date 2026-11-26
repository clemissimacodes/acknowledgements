import type { Metadata } from "next";
import Link from "next/link";
import { SHOP_HANDLE } from "@/lib/friend-types";

export const metadata: Metadata = { title: "Apply to Be Listed" };

export default function Apply() {
  return (
    <main className="ff-page">
      <p className="ff-crumbs">
        <Link href={`/collections/${SHOP_HANDLE}`}>Home</Link>
        <span className="ff-crumb-sep" aria-hidden="true">&gt;</span>
        <em>Apply to Be Listed</em>
      </p>
      <h1 className="ff-title">Apply to Be Listed</h1>
      <div className="ff-prose">
        <p>
          Every listing in this store is a real friend or family member of mine. The only requirement is
          that we have actually met, because the price is the date we did.
        </p>
        <p>
          To apply, or to ask that your listing be edited or taken down (done immediately, no questions),
          send a note through the <Link href="/ask">Ask Me Anything</Link> page, or text me. If you belong
          here, you have my number.
        </p>
      </div>
    </main>
  );
}
