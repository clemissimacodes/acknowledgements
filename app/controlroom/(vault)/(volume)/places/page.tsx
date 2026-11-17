import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { PlacesMap } from "@/components/places/PlacesMap";
import { loadPlaces } from "@/lib/places";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Places · Control room",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#f3f4f1",
};

// The vault layout has already turned away everyone but the owner.
export default async function PlacesControlPage() {
  const { places, regions, live } = await loadPlaces();

  if (!live) {
    return (
      <main className="admin-page admin-rolls">
        <header className="admin-head">
          <div>
            <p className="admin-eyebrow">
              <Link href="/controlroom">Control room</Link> · places
            </p>
            <h1>Places</h1>
            <p className="admin-private">
              The database could not be reached, so the map cannot be changed
              right now. Try again in a moment.
            </p>
          </div>
          <Link href="/places">View the map →</Link>
        </header>
      </main>
    );
  }

  return <PlacesMap initialPlaces={places} initialRegions={regions} canEdit />;
}
