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
          <a href={`/collections/${SHOP_HANDLE}`}>Shop</a> › {eraLabel(era)}
        </p>
      ) : null}
      <CollectionGrid friends={friends} era={era} query={q ?? ""} />
    </main>
  );
}
