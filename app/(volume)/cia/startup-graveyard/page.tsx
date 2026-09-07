import { CiaExhibit } from "@/components/cia/CiaExhibit";
import { getPublishedCiaEntries } from "@/lib/cia";

export const metadata = { title: "Startup Graveyard · CIA" };

export default async function StartupGraveyardPage() {
  const entries = await getPublishedCiaEntries("startup-graveyard");
  return <CiaExhibit project="startup-graveyard" entries={entries} />;
}
