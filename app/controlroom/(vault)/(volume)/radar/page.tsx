import { ClemiMap } from "@/components/radar/ClemiMap";
import { getPublicTrackerData } from "@/lib/tracker";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Clemi Tracker",
  description: "City-level signals and Clemi’s approved travel constellation.",
};

export default async function RadarPage() {
  const tracker = await getPublicTrackerData();

  return <ClemiMap current={tracker.current} places={tracker.places} />;
}
