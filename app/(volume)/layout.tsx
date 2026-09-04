import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Clementine Kay Shao",
  description: "Personal work by Clementine Kay Shao.",
};

export const viewport: Viewport = {
  themeColor: "#f6f1e8",
};

export default function VolumeLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <div className="volume">{children}</div>;
}
