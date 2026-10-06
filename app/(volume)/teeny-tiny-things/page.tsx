import { AboutList, type AboutNote } from "@/components/about/AboutList";

export const metadata = {
  title: "Teeny Tiny Things",
};

const notes: AboutNote[] = [
  {
    text: "My lucky numbers are those that sum, in any order (e.g. 325 or 211).",
    label: "3 + 2 = 5",
  },
  {
    text: "My best friends are my brothers, William and Daniel.",
    label: "William + Daniel",
  },
  {
    text: "I stare often. I find all people beautiful.",
    label: "Beautiful people",
  },
  {
    text: "I see every being as a strange gift bestowed by whatever intelligence, accident, or higher order moves beneath the universe, and I wish upon each—mollusk, human, and every form of life between—the maximal capacity their physiology permits for experiencing joy. To exist at all is already an improbable cosmic event; to experience that existence joyfully is its highest expression.",
    label: "My life philosophy",
  },
  {
    text: "Dekopons are the best citrus variety. God-tier juiciness, I'm telling you.",
    label: "Dekopon",
    href: "https://www.thrillist.com/eat/nation/what-is-sumo-citrus-dekopon-mandarins",
  },
  {
    text: "I spent my first paycheck on a $2,000 teacup yorkie from Craigslist and raised him in my college dorm. Unfortunately, Kuzma was picked up by a coyote.",
    label: "Kuzma",
  },
  {
    text: "I defer anger. When another does a wrongdoing toward me, the inherent burden of that wrongdoing is on their shoulders. If I anger, that burden now falls to my shoulders.",
    label: "Deferred anger",
  },
];

export default function AboutPage() {
  return (
    <main className="about-page">
      <AboutList title="Teeny Tiny Things" notes={notes} />
    </main>
  );
}
