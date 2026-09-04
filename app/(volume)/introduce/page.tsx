import { Suspense } from "react";
import { IntroductionForm } from "@/components/IntroductionForm";

export const metadata = {
  title: "Before you come in",
  description: "A small introduction before entering Clementine's work.",
};

export default function IntroducePage() {
  return (
    <main className="unlock-page intro-page">
      <h1>
        before you discover things about me, tell me one teeny tiny thing
        about you
      </h1>
      <Suspense>
        <IntroductionForm />
      </Suspense>
    </main>
  );
}
