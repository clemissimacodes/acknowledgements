import { Suspense } from "react";
import { IntroductionForm } from "@/components/IntroductionForm";

export const metadata = {
  title: "Before you come in",
  description: "A small introduction before entering Clementine's work.",
};

export default function IntroducePage() {
  return (
    <main className="unlock-page intro-page">
      <h1>before you come in</h1>
      <p className="intro-lede">
        I put a lot of myself in here. It feels nicer if we are introduced
        first.
      </p>
      <Suspense>
        <IntroductionForm />
      </Suspense>
    </main>
  );
}
