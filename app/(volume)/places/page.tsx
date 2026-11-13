import type { Metadata, Viewport } from "next";
import { PlacesMap } from "@/components/places/PlacesMap";
import { loadPlaces } from "@/lib/places";
import { viewerIsOwner } from "@/lib/recording-owner";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Places",
  description: "Where Clementine Kay Shao has been, on a map of pearls and silver thread.",
};

export const viewport: Viewport = {
  themeColor: "#f3f4f1",
};

export default async function PlacesPage() {
  const [{ places, live }, owner] = await Promise.all([loadPlaces(), viewerIsOwner()]);
  return <PlacesMap initialPlaces={places} canEdit={owner && live} />;
}
