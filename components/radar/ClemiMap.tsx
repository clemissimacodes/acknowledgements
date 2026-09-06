"use client";

import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import type { CurrentLocation, TravelPlace } from "@/lib/tracker";

function years(place: TravelPlace) {
  return place.firstYear === place.lastYear
    ? String(place.firstYear)
    : `${place.firstYear}–${place.lastYear}`;
}

function marker(
  map: maplibregl.Map,
  longitude: number,
  latitude: number,
  label: string,
  current = false,
) {
  const element = document.createElement("button");
  element.type = "button";
  element.className = `clemi-map-marker${current ? " is-current" : ""}`;
  element.setAttribute("aria-label", label);
  element.title = label;

  const popup = new maplibregl.Popup({
    closeButton: false,
    offset: current ? 34 : 18,
  });
  const copy = document.createElement("span");
  copy.textContent = label;
  popup.setDOMContent(copy);

  return new maplibregl.Marker({ element, anchor: "center" })
    .setLngLat([longitude, latitude])
    .setPopup(popup)
    .addTo(map);
}

export function ClemiMap({
  current,
  places,
}: {
  current: CurrentLocation | null;
  places: TravelPlace[];
}) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!container.current) return;

    const map = new maplibregl.Map({
      container: container.current,
      style: "https://tiles.openfreemap.org/styles/liberty",
      center: [0, 25],
      zoom: 1.25,
      minZoom: 1,
      maxZoom: 15,
      attributionControl: false,
      cooperativeGestures: true,
    });
    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "bottom-right",
    );
    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      "bottom-left",
    );

    const bounds = new maplibregl.LngLatBounds();
    const markers = places.map((place) => {
      bounds.extend([place.longitude, place.latitude]);
      return marker(
        map,
        place.longitude,
        place.latitude,
        `${place.city}, ${place.country} — ${years(place)}`,
      );
    });
    if (current) {
      bounds.extend([current.longitude, current.latitude]);
      markers.push(
        marker(
          map,
          current.longitude,
          current.latitude,
          `Clemi is currently in ${current.city}, ${current.country}`,
          true,
        ),
      );
    }

    if (!bounds.isEmpty()) {
      if (places.length + (current ? 1 : 0) === 1) {
        map.setCenter(bounds.getCenter());
        map.setZoom(4);
      } else {
        map.fitBounds(bounds, {
          padding: { top: 90, right: 70, bottom: 70, left: 70 },
          maxZoom: 5,
          duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ? 0
            : 900,
        });
      }
    }

    return () => {
      markers.forEach((item) => item.remove());
      map.remove();
    };
  }, [current, places]);

  return (
    <div className="clemi-map-shell">
      <div className="clemi-map" ref={container} />
      <aside className="clemi-map-panel" aria-label="Clemi locations">
        <div className="clemi-map-panel-head">
          <h1>Clemi</h1>
        </div>
        <section className="clemi-map-current">
          <span className="clemi-map-avatar" aria-hidden="true" />
          <span className="clemi-map-current-copy">
            <strong>Clementine</strong>
            {current ? (
              <>
                <span>
                  {current.city}, {current.country}
                </span>
                <small>Now</small>
              </>
            ) : (
              <>
                <span>No Location Found</span>
                <small>Offline</small>
              </>
            )}
          </span>
        </section>
        <section className="clemi-map-history">
          <h2>Places</h2>
          <ol>
            {places.map((place) => (
              <li key={place.id}>
                <span className="clemi-map-place-icon" aria-hidden="true">
                  c
                </span>
                <span>
                  <strong>{place.city}</strong>
                  <small>
                    {place.country} · {years(place)}
                  </small>
                </span>
              </li>
            ))}
          </ol>
          {places.length === 0 ? <p>No saved places</p> : null}
        </section>
      </aside>
    </div>
  );
}
