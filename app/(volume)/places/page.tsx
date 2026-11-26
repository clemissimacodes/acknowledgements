import type { Metadata, Viewport } from "next";
import { PlacesMap } from "@/components/places/PlacesMap";
import { loadPlaces } from "@/lib/places";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Places",
  description: "Where Clementine Kay Shao has been, on a map of pearls and silver thread.",
};

export const viewport: Viewport = {
  themeColor: "#f3f4f1",
};

// The public map only shows. Every change is made from /controlroom/places.
export default async function PlacesPage() {
  const { places, regions } = await loadPlaces();
  return <PlacesMap initialPlaces={places} initialRegions={regions} canEdit={false} />;
}
