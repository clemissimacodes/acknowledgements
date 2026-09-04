import type { CSSProperties } from "react";
import { getActiveRadar } from "@/lib/admin";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Clemi Radar",
  description: "A fuzzy little signal from somewhere in Clemi’s orbit.",
};

function blipPosition(area: string) {
  let hash = 0;
  for (const character of area) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return {
    "--radar-x": `${25 + (hash % 51)}%`,
    "--radar-y": `${25 + ((hash >>> 8) % 51)}%`,
  } as CSSProperties;
}

function spottedAt(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Los_Angeles",
  }).format(new Date(value));
}

export default async function RadarPage() {
  const radar = await getActiveRadar();

  return (
    <main className="radar-page">
      <div className="radar-copy">
        <p className="radar-kicker">soft signals from the clemiverse</p>
        <h1>Clemi Radar</h1>
        {radar ? (
          <>
            <p className="radar-status">
              Clemi was last spotted frolicking around{" "}
              <strong>{radar.area}</strong>.
            </p>
            {radar.note ? <p className="radar-note">“{radar.note}”</p> : null}
            <p className="radar-time">
              Signal transmitted {spottedAt(radar.updatedAt)} PT. Radar signals
              dissolve after 12 hours.
            </p>
          </>
        ) : (
          <>
            <p className="radar-status">No Clemi signal is currently bouncing.</p>
            <p className="radar-time">
              She may be underground, asleep, or moving too whimsically to
              detect.
            </p>
          </>
        )}
      </div>

      <div
        className={`radar-scope${radar ? " is-live" : ""}`}
        style={radar ? blipPosition(radar.area) : undefined}
        role="img"
        aria-label={
          radar
            ? `Approximate Clemi radar signal around ${radar.area}`
            : "Clemi radar with no current signal"
        }
      >
        <span className="radar-cross radar-cross-x" />
        <span className="radar-cross radar-cross-y" />
        <span className="radar-ring radar-ring-one" />
        <span className="radar-ring radar-ring-two" />
        <span className="radar-ring radar-ring-three" />
        <span className="radar-sweep" />
        {radar ? (
          <span className="radar-blip">
            <span>c</span>
          </span>
        ) : null}
      </div>
    </main>
  );
}
