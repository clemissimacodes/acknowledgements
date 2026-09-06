import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { EB_Garamond } from "next/font/google";
import { SiteAnchor } from "@/components/SiteAnchor";
import { VisitTracker } from "@/components/VisitTracker";
import "maplibre-gl/dist/maplibre-gl.css";
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
        <ClerkProvider dynamic>
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(){try{var t=localStorage.getItem("ack-theme");if(t==="light"||t==="dark"||t==="aquamarine")document.documentElement.setAttribute("data-theme",t);}catch(e){}})();`,
            }}
          />
          <header className="site-masthead">
            <SiteAnchor />
          </header>
          {children}
          <VisitTracker />
        </ClerkProvider>
      </body>
    </html>
  );
}
