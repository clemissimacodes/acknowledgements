import { Suspense } from "react";
import { UnlockForm } from "@/components/UnlockForm";

export const metadata = {
  title: "Acknowledgements",
};

export default function UnlockPage() {
  return (
    <main className="unlock-page">
      <h1>Acknowledgements</h1>
      <p className="unlock-lede">only 2 people have this password.. for now..</p>
      <Suspense>
        <UnlockForm />
      </Suspense>
    </main>
  );
}
