import { AboutList, type AboutNote } from "@/components/about/AboutList";

export const metadata = {
  title: "teeny tiny things about me",
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
    label: "beautiful people",
  },
  {
    text: "Costco croissants, toasted eight minutes at 350°, are supreme. I grew up poor, so my palate does not fancy fancier alternatives.",
    label: "8 min / 350°",
    image: {
      src: "/about/costco-croissants.png",
      alt: "A tray of Costco croissants",
    },
  },
  {
    text: "Dekopons are the best citrus variety. God-tier juiciness, I'm telling you.",
    label: "dekopon",
    href: "https://www.thrillist.com/eat/nation/what-is-sumo-citrus-dekopon-mandarins",
  },
  {
    text: "I spent my first paycheck on a $2,000 teacup yorkie from Craigslist and raised him in my college dorm. Unfortunately, Kuzma was picked up by a coyote.",
    label: "Kuzma",
  },
];

export default function AboutPage() {
  return (
    <main className="about-page">
      <AboutList title="teeny tiny things about me" notes={notes} />
    </main>
  );
}
