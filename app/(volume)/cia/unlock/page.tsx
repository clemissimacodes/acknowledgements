import { Suspense } from "react";
import { CiaUnlockForm } from "@/components/CiaUnlockForm";

export const metadata = {
  title: "CIA Clearance",
};

export default function CiaUnlockPage() {
  return (
    <main className="cia-page cia-unlock-page">
      <section className="cia-unlock-card">
        <p className="cia-classification">Restricted files</p>
        <p className="cia-file-number">
          Clementine Intelligence Agency · clearance desk
        </p>
        <h1>Present the phrase.</h1>
        <p className="cia-deck">
          These records are available only to readers with current clearance.
        </p>
        <Suspense>
          <CiaUnlockForm />
        </Suspense>
      </section>
    </main>
  );
}
