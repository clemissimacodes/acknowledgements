import type { Metadata } from "next";
import { BadGrid, type EnemyCard } from "@/components/bad-company/BadGrid";
import { BAD_BADGES, badPriceLabel, listEnemies } from "@/lib/bad-company";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Clearance" };

type Props = { searchParams: Promise<{ q?: string }> };

export default async function BadCompanyCollection({ searchParams }: Props) {
  const [{ q }, enemies] = await Promise.all([searchParams, listEnemies()]);
  const cards: EnemyCard[] = enemies.map((e) => ({
    slug: e.slug,
    nickname: e.nickname,
    productName: e.productName,
    badgeLabel: BAD_BADGES[e.badge],
    relationship: e.relationship,
    hometown: e.hometown,
    priceLabel: badPriceLabel(e.price),
    heroUrl: e.heroUrl,
  }));

  return (
    <main className="ff-collection">
      <BadGrid enemies={cards} query={q ?? ""} />
    </main>
  );
}
