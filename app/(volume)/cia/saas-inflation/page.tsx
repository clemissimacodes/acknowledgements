import { CiaExhibit } from "@/components/cia/CiaExhibit";
import { getPublishedCiaEntries } from "@/lib/cia";

export const metadata = { title: "SaaS Inflation Index · Secrets" };

export default async function SaasInflationPage() {
  const entries = await getPublishedCiaEntries("saas-inflation");
  return <CiaExhibit project="saas-inflation" entries={entries} />;
}
