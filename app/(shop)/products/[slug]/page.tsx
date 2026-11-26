import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductPage } from "@/components/friends/ProductPage";
import { SHOP_NAME, formatPrice, friendPrice } from "@/lib/friend-types";
import { getFriendBySlug } from "@/lib/friends";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const friend = await getFriendBySlug(slug);
  if (!friend) return { title: SHOP_NAME };
  const title = friend.productName ? `${friend.nickname} — ${friend.productName}` : friend.nickname;
  return {
    title,
    description: `$ ${formatPrice(friendPrice(friend.metOn))} USD. One of one. ${(friend.favoriteTrait || friend.description).slice(0, 140)}`,
    openGraph: friend.heroUrl ? { images: [{ url: friend.heroUrl }] } : undefined,
  };
}

export default async function Product({ params }: Props) {
  const { slug } = await params;
  const friend = await getFriendBySlug(slug);
  if (!friend) notFound();
  return <ProductPage friend={friend} />;
}
