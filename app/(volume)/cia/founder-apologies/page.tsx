import { CiaExhibit } from "@/components/cia/CiaExhibit";
import { getPublishedCiaEntries } from "@/lib/cia";

export const metadata = { title: "Founder Apology Archive · CIA" };

export default async function FounderApologiesPage() {
  const entries = await getPublishedCiaEntries("founder-apologies");
  return <CiaExhibit project="founder-apologies" entries={entries} />;
}
