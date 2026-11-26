import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { Albert_Sans, Caveat, Courier_Prime, Instrument_Serif } from "next/font/google";
import { BagProvider } from "@/components/friends/bag";
import { BagDrawer, ChatPill, ShopFooter, ShopHeader } from "@/components/friends/ShopChrome";
import { SHOP_LIVE, SHOP_NAME } from "@/lib/friend-types";
import { canSeeShop } from "@/lib/shop-access";
import "@/components/friends/shop.css";

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

const receipt = Courier_Prime({
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
  variable: "--ff-mono",
});

export const metadata: Metadata = {
  title: {
    default: SHOP_NAME,
    template: `%s – ${SHOP_NAME}`,
  },
  description: "A shop where every item is a person and nothing is for sale.",
  robots: SHOP_LIVE ? undefined : { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#fcfbf5",
};

export default async function ShopLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  if (!(await canSeeShop())) notFound();
  return (
    <div className={`ff ${grotesk.variable} ${editorial.variable} ${scrawl.variable} ${receipt.variable}`}>
      <BagProvider>
        <ShopHeader />
        {children}
        <ShopFooter />
        <ChatPill />
        <BagDrawer />
      </BagProvider>
    </div>
  );
}
