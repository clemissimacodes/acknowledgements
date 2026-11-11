import type { Metadata, Viewport } from "next";
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
      <h1 className="visually-hidden">Blow on a Fat Dandelion</h1>
      <Dandelion />
    </main>
  );
}
