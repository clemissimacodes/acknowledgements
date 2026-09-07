import { Suspense } from "react";
import { CiaUnlockForm } from "@/components/CiaUnlockForm";

export const metadata = {
  title: "Secrets · Unlock",
};

export default function CiaUnlockPage() {
  return (
    <main className="cia-page cia-unlock-page">
      <section className="cia-unlock-card">
        <h1>what do u thin kthe password is?</h1>
        <Suspense>
          <CiaUnlockForm />
        </Suspense>
      </section>
    </main>
  );
}
