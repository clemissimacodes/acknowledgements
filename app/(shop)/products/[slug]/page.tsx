import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductPage } from "@/components/friends/ProductPage";
import { SHOP_NAME, formatPrice, friendPrice } from "@/lib/friend-types";
import { getFriendBySlug, listFriends } from "@/lib/friends";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const friend = await getFriendBySlug(slug);
  if (!friend) return { title: SHOP_NAME };
  const title = friend.productName ? `${friend.nickname} — ${friend.productName}` : friend.nickname;
  return {
    title,
    description: `$ ${formatPrice(friendPrice(friend.metOn))} USD. One of one. ${friend.description.slice(0, 140)}`,
    openGraph: friend.heroUrl ? { images: [{ url: friend.heroUrl }] } : undefined,
  };
}

export default async function Product({ params }: Props) {
  const { slug } = await params;
  const friend = await getFriendBySlug(slug);
  if (!friend) notFound();
  const all = await listFriends();
  const wanted = new Set(friend.pairsWith);
  let pairs = all.filter((f) => f.slug !== friend.slug && wanted.has(f.slug));
  if (pairs.length < 4) {
    const same = all.filter((f) => f.slug !== friend.slug && !wanted.has(f.slug) && f.era === friend.era);
    pairs = [...pairs, ...same].slice(0, 4);
  }
  return <ProductPage friend={friend} pairs={pairs.slice(0, 4)} />;
}
