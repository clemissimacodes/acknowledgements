"use server";

import { revalidatePath } from "next/cache";
import {
  createPlace,
  createPlaces,
  deletePlace,
  getPlaces,
  searchPlaceMatches,
  setRegionVisited,
  updatePlace,
} from "@/lib/places";
import type { Place, PlaceBatchInput, PlaceInput, PlaceMatch } from "@/lib/place-types";
import { viewerIsOwner } from "@/lib/recording-owner";

export type PlacesResult = { places: Place[]; id?: string; ids?: string[] } | { error: string };

function revalidatePlaces() {
  revalidatePath("/places");
  revalidatePath("/controlroom/places");
}

async function requireOwner() {
  if (!(await viewerIsOwner())) throw new Error("Not authorized.");
}

// A thrown message never reaches the browser in production, so what she can
// fix (a bad year, an empty name) comes back as a value instead.
async function settle(work: () => Promise<string | void>): Promise<PlacesResult> {
  try {
    const id = await work();
    revalidatePlaces();
    return { places: await getPlaces(), id: id || undefined };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "That did not save." };
  }
}

export async function addPlace(input: PlaceInput) {
  await requireOwner();
  return settle(() => createPlace(input));
}

export async function savePlace(id: string, input: Omit<PlaceInput, "lat" | "lng">) {
  await requireOwner();
  return settle(() => updatePlace(id, input));
}

export async function removePlace(id: string) {
  await requireOwner();
  return settle(() => deletePlace(id));
}

/** Everything from "add many", in one write. */
export async function addPlaces(inputs: PlaceBatchInput[]): Promise<PlacesResult> {
  await requireOwner();
  try {
    const ids = await createPlaces(inputs);
    revalidatePlaces();
    return { places: await getPlaces(), ids };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "That did not save." };
  }
}

/**
 * Checks one state or country off, or unchecks it. The map has already shown
 * the change, so all that comes back is whether it held. /places is rendered
 * fresh on every visit, so there is nothing to revalidate.
 */
export async function markRegion(
  id: string,
  visited: boolean,
): Promise<{ ok: true } | { error: string }> {
  await requireOwner();
  try {
    await setRegionVisited(id, visited);
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "That did not save." };
  }
}

export async function findPlaces(
  query: string,
): Promise<{ matches: PlaceMatch[] } | { error: string }> {
  await requireOwner();
  try {
    return { matches: await searchPlaceMatches(query) };
  } catch {
    return { error: "The search is not answering. Tap the map to drop the pin instead." };
  }
}
