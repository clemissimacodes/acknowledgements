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
          We are always sourcing. Listing requirements: we have met at least once, you have made me laugh at
          least twice, and you are comfortable being described as “100% loyalty, trace amounts of chaos.”
        </p>
        <p>
          To apply, or to request that your listing be edited or taken down (we honor these immediately, no
          questions), send a note through the{" "}
          <Link href="/ask">Ask Me Anything</Link> page or text me — you have my number if you belong here.
        </p>
        <p>Applications are reviewed on a rolling basis. Decisions are final but friendly.</p>
      </div>
    </main>
  );
}
