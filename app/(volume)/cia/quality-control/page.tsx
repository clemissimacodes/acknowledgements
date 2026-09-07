import { CiaExhibit } from "@/components/cia/CiaExhibit";
import { getPublishedCiaEntries } from "@/lib/cia";

export const metadata = { title: "Quality Control Bureau · CIA" };

export default async function QualityControlPage() {
  const entries = await getPublishedCiaEntries("quality-control");
  return <CiaExhibit project="quality-control" entries={entries} />;
}
