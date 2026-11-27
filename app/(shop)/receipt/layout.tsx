import { Courier_Prime } from "next/font/google";

const receipt = Courier_Prime({
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
  variable: "--ff-mono",
});

export default function ReceiptLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className={receipt.variable}>{children}</div>;
}
