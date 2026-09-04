import type { Metadata, Viewport } from "next";
import { EB_Garamond } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const bookSerif = EB_Garamond({
  subsets: ["latin"],
  display: "swap",
  style: ["normal", "italic"],
  weight: ["400", "500", "600"],
  variable: "--font-book",
});

export const metadata: Metadata = {
  title: {
    default: "Clementine Kay Shao",
    template: "%s",
  },
  description: "Personal work by Clementine Kay Shao.",
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f6f1e8",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={bookSerif.variable} suppressHydrationWarning>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("ack-theme");if(t==="light"||t==="dark"||t==="aquamarine")document.documentElement.setAttribute("data-theme",t);}catch(e){}})();`,
          }}
        />
        <header className="site-masthead">
          <Link className="site-anchor" href="/about">
            Clementine Kay Shao
          </Link>
        </header>
        {children}
      </body>
    </html>
  );
}
