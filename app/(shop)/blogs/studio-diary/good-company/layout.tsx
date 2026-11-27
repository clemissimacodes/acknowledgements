import { Ballet, Bodoni_Moda, Courier_Prime, EB_Garamond } from "next/font/google";

/* Diary-only display faces — kept out of the shop shell so grid/PDP stay light. */
const script = Ballet({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  variable: "--ff-script",
});

const didone = Bodoni_Moda({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  variable: "--ff-didone",
});

const garamond = EB_Garamond({
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--ff-garamond",
});

const receipt = Courier_Prime({
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
  variable: "--ff-mono",
});

export default function DiaryLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className={`${script.variable} ${didone.variable} ${garamond.variable} ${receipt.variable}`}>
      {children}
    </div>
  );
}
