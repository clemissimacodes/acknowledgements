import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Dandelion } from "@/components/dandelion/Dandelion";

export const metadata: Metadata = {
  title: "Blow on a Fat Dandelion",
};

export const viewport: Viewport = {
  themeColor: "#000000",
};

export default function DandelionPage() {
  return (
    <main className="dandelion-page">
      <p className="poetry-kicker">
        <Link href="/">Clementine Kay Shao</Link>
      </p>
      <h1 className="visually-hidden">Blow on a Fat Dandelion</h1>
      <Dandelion />
    </main>
  );
}
