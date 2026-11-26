import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CollectionGrid } from "@/components/friends/CollectionGrid";
import { SHOP_HANDLE, SHOP_NAME, eraLabel, isFriendEra } from "@/lib/friend-types";
import { listFriends } from "@/lib/friends";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ q?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;
  if (handle === SHOP_HANDLE || handle === "all" || handle === "shop") {
    return { title: "Shop All" };
  }
  return { title: isFriendEra(handle) ? eraLabel(handle) : SHOP_NAME };
}

export default async function CollectionPage({ params, searchParams }: Props) {
  const { handle } = await params;
  const { q } = await searchParams;
  if (handle === "all" || handle === "shop" || handle === "friends-and-family") redirect(`/collections/${SHOP_HANDLE}`);
  const era = handle === SHOP_HANDLE ? null : isFriendEra(handle) ? handle : null;
  if (handle !== SHOP_HANDLE && !era) notFound();

  const friends = await listFriends();

  return (
    <main className="ff-collection">
      {era ? (
        <p className="ff-crumbs">
          <a href={`/collections/${SHOP_HANDLE}`}>Shop</a>
          <span className="ff-crumb-sep" aria-hidden="true">&gt;</span>
          <em>{eraLabel(era)}</em>
        </p>
      ) : (
        <section className="ff-intro" aria-label="The premise">
          <h1>Friends &amp; Family Sale</h1>
          <p>
            Every product in this store is a real person in my life. The price is the date we met, read as
            dollars: September 15 is $915. Add people to your bag, check out, and you get a receipt to share.
            Nothing ships and no one is charged. <a href="/pages/about-the-sale">The whole premise →</a>
          </p>
        </section>
      )}
      <CollectionGrid friends={friends} era={era} query={q ?? ""} />
    </main>
  );
}
