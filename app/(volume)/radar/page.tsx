import { after } from "next/server";
import { ClemiMap } from "@/components/radar/ClemiMap";
import {
  getPublicTrackerData,
  maybeSyncStoredCalendarOwner,
} from "@/lib/tracker";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Clemi Tracker",
  description: "City-level signals and Clemi’s approved travel constellation.",
};

export default async function RadarPage() {
  after(async () => {
    try {
      await maybeSyncStoredCalendarOwner();
    } catch {
      // The public map remains usable while Calendar is unconfigured.
    }
  });
  const tracker = await getPublicTrackerData();

  return <ClemiMap current={tracker.current} places={tracker.places} />;
}
