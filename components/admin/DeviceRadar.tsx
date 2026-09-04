"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateRadarFromDevice } from "@/app/admin/actions";

export function DeviceRadar() {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [status, setStatus] = useState("");
  const [locating, setLocating] = useState(false);

  function transmit() {
    if (!navigator.geolocation) {
      setStatus("This browser does not offer a location signal.");
      return;
    }

    setLocating(true);
    setStatus("Listening for this device…");
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const result = await updateRadarFromDevice({
          latitude: coords.latitude,
          longitude: coords.longitude,
          note,
        });
        setLocating(false);
        if (!result.ok) {
          setStatus(result.error);
          return;
        }
        setStatus(`Clemi is now fuzzily near ${result.area}.`);
        router.refresh();
      },
      (error) => {
        setLocating(false);
        setStatus(
          error.code === error.PERMISSION_DENIED
            ? "Location permission was not granted."
            : "This device could not find its location.",
        );
      },
      {
        enableHighAccuracy: false,
        maximumAge: 5 * 60 * 1000,
        timeout: 15_000,
      },
    );
  }

  return (
    <div className="admin-device-radar">
      <label>
        Optional radar transmission
        <input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={140}
          placeholder="foraging for perfect citrus"
        />
      </label>
      <button type="button" onClick={transmit} disabled={locating}>
        {locating ? "Finding Clemi…" : "Use this device’s location"}
      </button>
      <p aria-live="polite">{status}</p>
      <small>
        Works from this laptop or your phone. The precise coordinates are
        reduced to roughly a two-mile area before lookup and are never saved.
      </small>
    </div>
  );
}
