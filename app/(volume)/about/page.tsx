import Link from "next/link";
import { AboutList, type AboutNote } from "@/components/about/AboutList";

export const metadata = {
  title: "teeny tiny things about me",
};

const notes: AboutNote[] = [
  {
    text: "My lucky numbers are those that sum. My birthday is March 25: 3 + 2 = 5.",
  },
  { text: "My best friends are William and Daniel." },
  { text: "I stare often. I find all people beautiful." },
  {
    text: "Costco croissants, toasted eight minutes at 350°, are supreme. I grew up poor, so my palate does not fancy fancier alternatives.",
    image: {
      src: "/about/costco-croissants.png",
      alt: "A tray of Costco croissants",
    },
  },
  {
    text: "Dekopons are the best citrus variety and this is an objective truth.",
    href: "https://www.thrillist.com/eat/nation/what-is-sumo-citrus-dekopon-mandarins",
  },
  {
    text: "I spent my very first paycheck on a $2,000 teacup yorkie from Craigslist. Kuzma unfortunately was picked up by a coyote, and I am still waiting to heal from this wound.",
  },
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
