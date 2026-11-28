import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { Albert_Sans, Caveat, Instrument_Serif } from "next/font/google";
import { BadChatPill, BadFooter, BadHeader } from "@/components/bad-company/BadChrome";
import { BAD_SHOP_NAME } from "@/lib/bad-company";
import { canSeeBadCompany } from "@/lib/shop-access";
import "@/components/friends/shop.css";
import "@/components/bad-company/bad.css";

const grotesk = Albert_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  display: "swap",
  variable: "--ff-sans",
});

const editorial = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
  variable: "--ff-serif",
});

const scrawl = Caveat({
  subsets: ["latin"],
  weight: ["500", "600"],
  display: "swap",
  variable: "--ff-scrawl",
});

export const metadata: Metadata = {
  title: {
    default: BAD_SHOP_NAME,
    template: `%s – ${BAD_SHOP_NAME}`,
  },
  description: "The clearance rack. Every item is a person, and every item is final sale.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#14110d",
};

export default async function BadCompanyLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  if (!(await canSeeBadCompany())) notFound();
  return (
    <div className={`ff bc ${grotesk.variable} ${editorial.variable} ${scrawl.variable}`}>
      <BadHeader />
      {children}
      <BadFooter />
      <BadChatPill />
    </div>
  );
}
