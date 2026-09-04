import Link from "next/link";
import { AboutList } from "@/components/about/AboutList";

export const metadata = {
  title: "teeny tiny things about me",
};

const notes = [
  "My lucky numbers are those that sum. My birthday is March 25: 3 + 2 = 5.",
  "My best friends are William and Daniel.",
  "I stare often. I find all people beautiful.",
  "Costco croissants, toasted eight minutes at 350°, are supreme. I grew up poor, so my palate does not fancy fancier alternatives.",
  "Sumo mandarins are the best citrus variety and this is an objective truth.",
  "I spent my very first paycheck on a $2,000 teacup yorkie from Craigslist. Kuzma unfortunately was picked up by a coyote, and I am still waiting to heal from this wound.",
];

export default function AboutPage() {
  return (
    <main className="about-page">
      <p className="poetry-kicker">
        <Link href="/">Clementine Kay Shao</Link>
      </p>
      <h1>teeny tiny things about me</h1>
      <AboutList notes={notes} />
    </main>
  );
}
