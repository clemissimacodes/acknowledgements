// Pages moved out of app/(volume) keep the same theme wrapper they had there.
export default function VaultVolumeLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <div className="volume">{children}</div>;
}
