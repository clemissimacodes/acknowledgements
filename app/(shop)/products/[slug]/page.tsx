import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductPage } from "@/components/friends/ProductPage";
import { SHOP_NAME, pickAlsoLike, priceLabel } from "@/lib/friend-types";
import { getFriendBySlug, listFriends } from "@/lib/friends";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const friend = await getFriendBySlug(slug);
  if (!friend) return { title: SHOP_NAME };
  const title = friend.productName ? `${friend.nickname} — ${friend.productName}` : friend.nickname;
  return {
    title,
    description: `${priceLabel(friend.birthday)}. One of one. ${(friend.favoriteMemory || "").slice(0, 140)}`,
    openGraph: friend.heroUrl ? { images: [{ url: friend.heroUrl }] } : undefined,
  };
}

export default async function Product({ params }: Props) {
  const { slug } = await params;
  const [friend, all] = await Promise.all([getFriendBySlug(slug), listFriends()]);
  if (!friend) notFound();
  const alsoLike = pickAlsoLike(friend, all, 4);
  return <ProductPage friend={friend} alsoLike={alsoLike} />;
}
